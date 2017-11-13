const _ = require('lodash')
const check = require('check-types')
const { Transform, Readable } = require('stream')
const request = require('request')
const logger = require('winston')
const { URL } = require('url')

/**
 * Reads data from HTTP service URL, optionally altering the data using specified Transform
 */
class HttpGetReader extends Readable {
  /**
   * @constructor
   * @param {string|URL} url HTTP service URL
   * @param {Transform} [transform=undefined] Transform to alter data with
   * @param {Object} [query=undefined] Query parameters
   * @param {Object} [headers=undefined] Headers
   */
  constructor (url, transform = undefined, query = undefined, headers = undefined) {
    check.assert(check.any([
      check.instance(url, URL),
      check.nonEmptyString(url)
    ]))
    check.assert.maybe.instance(transform, Transform)
    check.assert.maybe.object(query)
    check.assert.maybe.object(headers)

    super({
      objectMode: transform && transform._readableState ? transform._readableState.objectMode : false
    })

    this._url = url
    this._transform = transform
    this._query = query ? _.cloneDeep(query) : null
    this._headers = headers ? _.cloneDeep(headers) : null
    this._request = null
    this._source = null

    this._onRequestErrorHandler = (...args) => this._onRequestError(...args)
    this._onRequestEndHandler = (...args) => this._onRequestEnd(...args)
    this._onRequestDataHandler = (...args) => this._onRequestData(...args)
    this._onRequestResponseHandler = (...args) => this._onRequestResponse(...args)
    this._onTransformErrorHandler = (...args) => this._onTransformError(...args)
    this._onTransformEndHandler = (...args) => this._onTransformEnd(...args)
    this._onTransformDataHandler = (...args) => this._onTransformData(...args)
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
    const options = {
      url: this._url,
      qs: this._query || {},
      headers: this._headers || {},
      gzip: true
    }

    logger.log('verbose', 'Starting HTTP GET request to \'%s\'', options.url)
    logger.log('debug', 'Headers:', options.headers)
    logger.log('debug', 'Query:', options.qs)

    this._request = request(options)
    this._request
      .on('data', this._onRequestDataHandler)
      .on('error', this._onRequestErrorHandler)
      .on('end', this._onRequestEndHandler)
      .on('response', this._onRequestResponseHandler)
    if (this._transform) {
      this._request.pipe(this._transform)
        .on('data', this._onTransformDataHandler)
        .on('error', this._onTransformErrorHandler)
        .on('end', this._onTransformEndHandler)
    }
  }

  /**
   * Handles request error
   */
  _onRequestError (error) {
    logger.log('error', 'Error while making HTTP GET request to \'%s\':', this._url, error)

    this.emit('error', error)
  }

  /**
   * Handles request end
   */
  _onRequestEnd () {
    logger.log('verbose', 'HTTP GET request to \'%s\' complete', this._url)

    if (!this._transform) {
      this.push(null)
      this._detachFromStreams()
    }
  }

  /**
   * Handles request data
   */
  _onRequestData (chunk) {
    logger.log('verbose', 'Received data while making HTTP GET request to \'%s\'', this._url)
    logger.log('debug', 'Chunk:', chunk)

    if (!this._transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles request response
   */
  _onRequestResponse (response) {
    logger.log('verbose', 'Received response while making HTTP GET request to \'%s\'', this._url)
    logger.log('debug', 'Response HTTP version:', response.httpVersion)
    logger.log('debug', 'Response headers:', response.headers)
    logger.log('debug', 'Response status code:', response.statusCode)
    logger.log('debug', 'Response status message:', response.statusMessage)
  }

  /**
   * Handles transform error
   */
  _onTransformError (error) {
    logger.log('error', 'Error while transforming data from HTTP GET request to \'%s\':', this._url, error)

    this.emit('error', error)
  }

  /**
   * Handles transform end
   */
  _onTransformEnd () {
    logger.log('verbose', 'Transformation of data from HTTP GET request to \'%s\' ended', this._url)

    this.push(null)
    this._detachFromStreams()
  }

  /**
   * Handles transform data
   */
  _onTransformData (chunk) {
    logger.log('verbose', 'Transformed data from HTTP GET request to \'%s\'', this._url)
    logger.log('debug', 'Chunk:', chunk)

    this.push(chunk)
  }

  /**
   * Detach from streams
   */
  _detachFromStreams () {
    logger.log('verbose', 'Detaching from streams of HTTP GET request to \'%s\'', this._url)

    if (this._request) {
      this._request.removeListener('data', this._onRequestDataHandler)
      this._request.removeListener('error', this._onRequestErrorHandler)
      this._request.removeListener('end', this._onRequestEndHandler)
      this._request.removeListener('response', this._onRequestResponseHandler)
    }
    if (this._transform) {
      this._transform.removeListener('data', this._onTransformDataHandler)
      this._transform.removeListener('error', this._onTransformErrorHandler)
      this._transform.removeListener('end', this._onTransformEndHandler)
    }
  }
}

module.exports = HttpGetReader
