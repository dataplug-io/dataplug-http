const _ = require('lodash')
const check = require('check-types')
const { Readable } = require('stream')
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
   * @param {HttpGetReader~Options} [options=] Options
   */
  constructor (url, options = undefined) {
    check.assert(check.any([
      check.instance(url, URL),
      check.nonEmptyString(url)
    ]))
    check.assert.maybe.object(options)

    options = Object.assign({}, HttpGetReader.DEFAULT_OPTIONS, options)

    super({
      objectMode: options.transform && options.transform._readableState ? options.transform._readableState.objectMode : false
    })

    this._url = url
    this._options = options

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
   * https://nodejs.org/api/stream.html#stream_readable_destroy_err_callback
   */
  _destroy (err, callback) {
    // Detach from current stream
    if (this._request) {
      this._detachFromStreams()
      this._request.destroy(err)
    }

    callback(err)
  }

  /**
   * Starts the request
   */
  _startRequest () {
    const options = {
      url: this._url,
      qs: this._options.query || {},
      headers: this._options.headers || {},
      gzip: true
    }

    logger.log('verbose', 'Starting HTTP GET request to \'%s\'', options.url)
    logger.log('debug', 'Headers:', options.headers)
    logger.log('debug', 'Query:', options.qs)

    this._request = request(options)
    this._request
      .on('error', this._onRequestErrorHandler)
      .on('response', this._onRequestResponseHandler)
  }

  /**
   * Handles request error
   */
  _onRequestError (error) {
    logger.log('error', 'Error while making HTTP GET request to \'%s\':', this._url, error)

    if (this._options.abortOnError) {
      this.emit('error', error)
    } else {
      if (!this._transform) {
        this._detachFromStreams()
        this.push(null)
      } else {
        this._transform.end()
      }
    }
  }

  /**
   * Handles request end
   */
  _onRequestEnd () {
    logger.log('verbose', 'HTTP GET request to \'%s\' complete', this._url)

    if (!this._transform) {
      this._detachFromStreams()
      this.push(null)
    } else {
      this._transform.end()
    }
  }

  /**
   * Handles request data
   */
  _onRequestData (chunk) {
    logger.log('debug', 'Received data while making HTTP GET request to \'%s\'', this._url)
    logger.log('silly', 'Chunk:', _.toString(chunk))

    if (!this._transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles request response
   */
  _onRequestResponse (response) {
    logger.log('debug', 'Received response while making HTTP GET request to \'%s\'', this._url)
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
      if (this._options.transform) {
        this._options.transform
          .on('data', this._onTransformDataHandler)
          .on('error', this._onTransformErrorHandler)
          .on('end', this._onTransformEndHandler)
        this._request
          .pipe(this._options.transform)
      }
    } else {
      this._detachFromStreams()
      logger.log('debug', 'Going to retry HTTP GET request to \'%s\'', this._url)
      Promise.resolve(shouldProcessData)
        .then((shouldProcessData) => {
          if (shouldProcessData) {
            throw new Error('responseHandler should not return promised true')
          }

          logger.log('debug', 'Retrying HTTP GET request to \'%s\'', this._url)
          this._startRequest()
        })
        .catch((error) => {
          logger.log('error', 'Error while waiting for retrying of HTTP GET request to \'%s\':', this._url, error)

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
    logger.log('error', 'Error while transforming data from HTTP GET request to \'%s\':', this._url, error)

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
    logger.log('verbose', 'Transformation of data from HTTP GET request to \'%s\' ended', this._url)

    this.push(null)
    this._detachFromStreams()
  }

  /**
   * Handles transform data
   */
  _onTransformData (chunk) {
    logger.log('debug', 'Transformed data from HTTP GET request to \'%s\'', this._url)
    logger.log('silly', 'Chunk:', _.toString(chunk))

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

  /**
   * Default response handler
   */
  static defaultResponseHandler (response, request) {
    if (response.statusCode === 200 || response.statusCode === 404) {
      return true
    }

    if (response.statusCode === 429) {
      return false
    }

    throw new Error(`HTTP ${response.method} request failed with ${response.statusCode}: ${response.statusMessage || 'no details'}`)
  }
}

/**
 * @typedef HttpGetReader~Options
 * @property {Transform} [transform] Transform to alter data with
 * @property {Object} [query] Query parameters
 * @property {Object} [headers] Headers
 * @property {HttpGetReader~ResponseHandler} [responseHandler] Response handler functor
 * @property {boolean} [abortOnError] True to abort the stream on error, false to ignore
 */
HttpGetReader.DEFAULT_OPTIONS = {
  transform: undefined,
  query: undefined,
  headers: undefined,
  responseHandler: HttpGetReader.defaultResponseHandler,
  abortOnError: false
}

/**
 * @callback HttpGetReader~ResponseHandler
 * @param {} response
 * @param {} request
 * @return {} Truthy to process data, falsy to retry request
 */

module.exports = HttpGetReader
