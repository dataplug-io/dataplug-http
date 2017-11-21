const _ = require('lodash')
const check = require('check-types')
const { Readable } = require('stream')
const Promise = require('bluebird')
const request = require('request')
const logger = require('winston')
const { URL } = require('url')
const HttpGetReader = require('./httpGetReader')

/**
 * Reads data from HTTP service URL that supports pagination, optionally altering the data using specified Transform
 */
class PagedHttpGetReader extends Readable {
  /**
   * @constructor
   * @param {string|URL} url HTTP service URL
   * @param {PagedHttpGetReader~NextPageFunctor} nextPage Next-page functor
   * @param {PagedHttpGetReader~Options} [options=] Options
   */
  constructor (url, nextPage, options = undefined) {
    check.assert(check.any([
      check.instance(url, URL),
      check.nonEmptyString(url)
    ]))
    check.assert.function(nextPage)
    check.assert.maybe.object(options)

    options = Object.assign({}, PagedHttpGetReader.DEFAULT_OPTIONS, options)

    const transform = options.transformFactory ? options.transformFactory() : null
    super({
      objectMode: transform && transform._readableState ? transform._readableState.objectMode : false
    })

    this._url = url
    this._nextPage = nextPage
    this._options = options

    this._query = options.query ? _.cloneDeep(options.query) : null
    this._headers = options.headers ? _.cloneDeep(options.headers) : null
    this._request = null
    this._transform = null
    this._source = null

    this._onRequestErrorHandler = (...args) => this._onRequestError(...args)
    this._onRequestEndHandler = (...args) => this._onRequestEnd(...args)
    this._onRequestDataHandler = (...args) => this._onRequestData(...args)
    this._onRequestResponseHandler = (...args) => this._onRequestResponse(...args)
    this._onTransformErrorHandler = (...args) => this._onTransformError(...args)
    this._onTransformEndHandler = (...args) => this._onTransformEnd(...args)
    this._onTransformDataHandler = (...args) => this._onTransformData(...args)
    this._onTransformCompleteHandler = (...args) => this._onTransformComplete(...args)

    this.once('read', () => {
      this._safeStartRequest()
    })
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_read_size_1
   * @override
   */
  _read (size) {
    this.emit('read')
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_destroy_err_callback
   */
  _destroy (err, callback) {
    // Detach from current stream
    if (this._request) {
      const capturedRequest = this._request
      this._detachFromStreams()
      capturedRequest.destroy(err)
    }

    callback(err)
  }

  /**
   * Starts the request
   */
  _startRequest () {
    const options = {
      url: this._url,
      qs: this._query || {},
      headers: this._headers || {},
      gzip: true
    }

    logger.log('verbose', 'Starting paged HTTP GET request to \'%s\'', options.url)
    logger.log('debug', 'Headers:', options.headers)
    logger.log('debug', 'Query:', options.qs)

    this._request = request(options)
    this._request
      .on('error', this._onRequestErrorHandler)
      .on('response', this._onRequestResponseHandler)
  }

  /**
   * Safely starts the request
   */
  _safeStartRequest () {
    try {
      this._startRequest()
    } catch (error) {
      logger.log('error', 'Error while starting HTTP GET request to \'%s\':', this._url, error)
      this.emit('error', error)

      this._detachFromStreams()
      this.push(null)
    }
  }

  /**
   * Handles request error
   */
  _onRequestError (error) {
    logger.log('error', 'Error while making paged HTTP GET request to \'%s\':', this._url, error)

    if (this._options.abortOnError) {
      this.emit('error', error)
    } else {
      if (!this._transform) {
        this._proceedToNextPage()
      } else {
        this._transform.end()
      }
    }
  }

  /**
   * Handles request end
   */
  _onRequestEnd () {
    logger.log('verbose', 'Paged HTTP GET request to \'%s\' complete', this._url)

    if (!this._transform) {
      this._proceedToNextPage()
    } else {
      this._transform.end()
    }
  }

  /**
   * Handles request data
   */
  _onRequestData (chunk) {
    logger.log('debug', 'Received data while making paged HTTP GET request to \'%s\'', this._url)
    logger.log('silly', 'Chunk:', _.toString(chunk))

    if (!this._transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles request response
   */
  _onRequestResponse (response) {
    logger.log('debug', 'Received response while making paged HTTP GET request to \'%s\'', this._url)
    logger.log('debug', 'Response HTTP version:', response.httpVersion)
    logger.log('debug', 'Response headers:', response.headers)
    logger.log('debug', 'Response status code:', response.statusCode)
    logger.log('debug', 'Response status message:', response.statusMessage)

    let shouldProcessData
    try {
      shouldProcessData = this._options.responseHandler(response, this._request)
    } catch (error) {
      logger.log('error', 'Error while handling response to HTTP GET request to \'%s\':', this._url, error)

      this.emit('error', error)
      this._detachFromStreams()
      this.push(null)
      return
    }

    if (_.isBoolean(shouldProcessData) && shouldProcessData) {
      logger.log('debug', 'Processing response data from paged HTTP GET request to \'%s\'', this._url)
      this._request
        .on('data', this._onRequestDataHandler)
        .on('end', this._onRequestEndHandler)
      if (this._options.transformFactory) {
        this._transform = this._options.transformFactory()
        this._transform
          .on('data', this._onTransformDataHandler)
          .on('error', this._onTransformErrorHandler)
          .on('end', this._onTransformEndHandler)
          .on('complete', this._onTransformCompleteHandler)
        this._request
          .pipe(this._transform)
      }
    } else {
      this._detachFromStreams()
      logger.log('debug', 'Going to retry paged HTTP GET request to \'%s\'', this._url)
      Promise.resolve(shouldProcessData)
        .then((shouldProcessData) => {
          if (shouldProcessData) {
            throw new Error('responseHandler should not return promised true')
          }

          logger.log('debug', 'Retrying paged HTTP GET request to \'%s\'', this._url)
          this._startRequest()
        })
        .catch((error) => {
          logger.log('error', 'Error while waiting for retrying of paged HTTP GET request to \'%s\':', this._url, error)

          this.emit('error', error)
          this._detachFromStreams()
          this.push(null)
        })
    }
  }

  /**
   * Handles transform error
   */
  _onTransformError (error) {
    logger.log('error', 'Error while transforming data from paged HTTP GET request to \'%s\':', this._url, error)

    if (this._options.abortOnError) {
      this.emit('error', error)
    } else {
      this._transform.end()
    }
  }

  /**
   * Handles transform end
   */
  _onTransformEnd () {
    logger.log('verbose', 'Transformation of data from paged HTTP GET request to \'%s\' ended', this._url)

    this._proceedToNextPage()
  }

  /**
   * Handles transform data
   */
  _onTransformData (chunk) {
    logger.log('debug', 'Transformed data from paged HTTP GET request to \'%s\'', this._url)
    logger.log('silly', 'Chunk:', chunk)

    this.push(chunk)
  }

  /**
   * Handles complete data from transform
   */
  _onTransformComplete (data) {
    logger.log('verbose', 'Transformation of data from paged HTTP GET request to \'%s\' is complete', this._url)
    logger.log('silly', 'Data:', data)

    this._proceedToNextPage(data)
  }

  /**
   * Detach from streams
   */
  _detachFromStreams () {
    logger.log('verbose', 'Detaching from streams of paged HTTP GET request to \'%s\'', this._url)

    if (this._request) {
      this._request.removeListener('data', this._onRequestDataHandler)
      this._request.removeListener('error', this._onRequestErrorHandler)
      this._request.removeListener('end', this._onRequestEndHandler)
      this._request.removeListener('response', this._onRequestResponseHandler)
      this._request = null
    }

    if (this._transform) {
      this._transform.removeListener('data', this._onTransformDataHandler)
      this._transform.removeListener('error', this._onTransformErrorHandler)
      this._transform.removeListener('end', this._onTransformEndHandler)
      this._transform.removeListener('complete', this._onTransformCompleteHandler)
      this._transform = null
    }
  }

  /**
   * Proceed to next page
   *
   * @param {} data Data from current page
   */
  _proceedToNextPage (data) {
    this._detachFromStreams()

    logger.log('verbose', 'Checking existence of next page of paged HTTP GET request to \'%s\'', this._url)

    let page = {
      url: this._url,
      query: this._query,
      headers: this._headers
    }
    Promise.try(() => this._nextPage(page, data))
      .then((hasNextPage) => {
        if (!hasNextPage) {
          logger.log('verbose', 'No page to proceed to of paged HTTP GET request to \'%s\'', this._url)

          this.push(null)
          return
        }

        logger.log('verbose', 'Proceeding to next page of paged HTTP GET request to \'%s\'', this._url)

        this._url = page.url
        this._query = page.query
        this._headers = page.headers
        this._startRequest()
      })
    .catch((error) => {
      logger.log('error', 'Error in PagedHttpGetReader while checking existence of next page of paged HTTP GET request to \'%s\'', this._url, error)
      this.push(null)
    })
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
 * @typedef PagedHttpGetReader~Options
 * @property {PagedHttpGetReader~TransformFactory} [transformFactory] Factory that instanciates Transform to alter data with
 * @property {Object} [query] Query parameters
 * @property {Object} [headers] Headers
 * @property {PagedHttpGetReader~ResponseHandler} [responseHandler] Response handler functor
 * @property {boolean} [abortOnError] True to abort the stream on error, false to ignore
 */
PagedHttpGetReader.DEFAULT_OPTIONS = {
  transformFactory: undefined,
  query: undefined,
  headers: undefined,
  responseHandler: HttpGetReader.defaultResponseHandler,
  abortOnError: false
}

/**
 * @callback PagedHttpGetReader~TransformFactory
 * @return {Transform} Instance of the transform
 */

/**
 * @callback PagedHttpGetReader~ResponseHandler
 * @param {} response
 * @param {} request
 * @return {} Truthy to process data, falsy to retry request
 */

module.exports = PagedHttpGetReader
