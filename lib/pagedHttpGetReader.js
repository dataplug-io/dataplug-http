const _ = require('lodash')
const check = require('check-types')
const { Readable } = require('stream')
const request = require('request')
const { URL } = require('url')

/**
 * Reads data from HTTP service URL that supports pagination, optionally altering the data using specified Transform
 */
class PagedHttpGetReader extends Readable {
  /**
   * @constructor
   * @param {string|URL} url HTTP service URL
   * @param {PagedHttpGetReader~NextPageFunctor} nextPage Next-page functor
   * @param {PagedHttpGetReader~TransformFactory} [transformFactory=undefined] Factory that instanciates Transform to alter data with
   * @param {Object} [query=undefined] Query parameters
   * @param {Object} [headers=undefined] Headers
   */
  constructor (url, nextPage, transformFactory = undefined, query = undefined, headers = undefined) {
    check.assert(check.any([
      check.instance(url, URL),
      check.nonEmptyString(url)
    ]))
    check.assert.function(nextPage)
    check.assert.maybe.function(transformFactory)
    check.assert.maybe.object(query)
    check.assert.maybe.object(headers)

    const transform = transformFactory ? transformFactory() : null
    super({
      objectMode: transform && transform._readableState ? transform._readableState.objectMode : false
    })

    this._url = url
    this._nextPage = nextPage
    this._transformFactory = transformFactory
    this._query = query ? _.cloneDeep(query) : null
    this._headers = headers ? _.cloneDeep(headers) : null
    this._request = null
    this._transform = transform
    this._source = null

    this._onRequestErrorHandler = (...args) => this._onRequestError(...args)
    this._onRequestEndHandler = (...args) => this._onRequestEnd(...args)
    this._onRequestDataHandler = (...args) => this._onRequestData(...args)
    this._onTransformErrorHandler = (...args) => this._onTransformError(...args)
    this._onTransformEndHandler = (...args) => this._onTransformEnd(...args)
    this._onTransformDataHandler = (...args) => this._onTransformData(...args)
    this._onTransformCompleteHandler = (...args) => this._onTransformComplete(...args)
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_read_size_1
   * @override
   */
  _read (size) {
    if (this._request) {
      return
    }

    this._startRequest()
  }

  /**
   * Starts the request
   */
  _startRequest () {
    // console.error('start request')
    const options = {
      url: this._url,
      qs: this._query || {},
      headers: this._headers || {},
      gzip: true
    }

    // console.error('options', options)

    this._request = request(options)
    this._request
      .on('data', this._onRequestDataHandler)
      .on('error', this._onRequestErrorHandler)
      .on('end', this._onRequestEndHandler)
    if (this._transformFactory) {
      this._transform = this._transformFactory()
      this._request.pipe(this._transform)
        .on('data', this._onTransformDataHandler)
        .on('error', this._onTransformErrorHandler)
        .on('end', this._onTransformEndHandler)
        .on('complete', this._onTransformCompleteHandler)
    }
  }

  /**
   * Handles request error
   */
  _onRequestError (error) {
    this.emit('error', error)
  }

  /**
   * Handles request response
   */
  _onRequestEnd (response) {
    // console.log('request end')
    if (!this._transform) {
      this._proceedToNextPage()
    }
  }

  /**
   * Handles request data
   */
  _onRequestData (chunk) {
    // console.log('request chunk', chunk)
    if (!this._transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles transform error
   */
  _onTransformError (error) {
    this.emit('error', error)
  }

  /**
   * Handles transform response
   */
  _onTransformEnd (response) {
    // console.error('transform end')
    this._proceedToNextPage()
  }

  /**
   * Handles transform data
   */
  _onTransformData (chunk) {
    // console.log('transform chunk', chunk)
    this.push(chunk)
  }

  /**
   * Handles complete data from transform
   */
  _onTransformComplete (data) {
    // console.error('transform complete', data)
    this._proceedToNextPage(data)
  }

  /**
   * Detach from streams
   */
  _detachFromStreams () {
    if (this._request) {
      this._request.removeListener('data', this._onRequestDataHandler)
      this._request.removeListener('error', this._onRequestErrorHandler)
      this._request.removeListener('end', this._onRequestEndHandler)
    }
    if (this._transform) {
      this._transform.removeListener('data', this._onTransformDataHandler)
      this._transform.removeListener('error', this._onTransformErrorHandler)
      this._transform.removeListener('end', this._onTransformEndHandler)
      this._transform.removeListener('complete', this._onTransformCompleteHandler)
    }
  }

  /**
   * Proceed to next page
   *
   * @param {} data Data from current page
   */
  _proceedToNextPage (data) {
    // console.error('proceedToNextPage')

    this._detachFromStreams()

    let page = {
      url: this._url,
      query: this._query,
      headers: this._headers
    }
    if (!this._nextPage(page, data)) {
      this.push(null)
      return
    }

    this._url = page.url
    this._query = page.query
    this._headers = page.headers
    this._startRequest()
  }
}

/**
 * @typedef PagedHttpGetReader~Page
 * @property {string} url Page URL
 * @property {Object} query Page query parameters
 * @property {Object} headers Page headers
 */

/**
 * @callback PagedHttpGetReader~NextPageFunctor
 * @param {PagedHttpGetReader~Page} page Page details
 * @param {} [data=undefined] Optionally, data from previous request, if available
 * @return {boolean} True if there's next page, false otherwise
 */

/**
 * @callback PagedHttpGetReader~TransformFactory
 * @return {Transform} Instance of the transform
 */

module.exports = PagedHttpGetReader
