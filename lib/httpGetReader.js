const { Readable } = require('stream')
const request = require('request')

/**
 * Reads data from HTTP service URL, optionally altering the data using specified Transform
 */
class HttpGetReader extends Readable {
  /**
   * @constructor
   * @param {string} url HTTP service URL
   * @param {Transform} transform Transform to alter data with
   */
  constructor (url, transform = undefined, query = undefined, headers = undefined) {
    super({
      objectMode: transform ? transform.readableObjectMode : false
    })

    this._url = url
    this._transform = transform
    this._query = query
    this._headers = headers
    this._request = null
    this._source = null

    this._onRequestErrorHandler = (...args) => this._onRequestError(...args)
    this._onRequestEndHandler = (...args) => this._onRequestEnd(...args)
    this._onRequestDataHandler = (...args) => this._onRequestData(...args)
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

    const requestOptions = {
      url: this._url,
      qs: this._query || {},
      headers: this._headers || {},
      gzip: true
    }
    this._request = request(requestOptions)
    this._request
      .on('data', this._onRequestDataHandler)
      .on('error', this._onRequestErrorHandler)
      .on('end', this._onRequestEndHandler)
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
    this.emit('error', error)
  }

  /**
   * Handles request response
   */
  _onRequestEnd (response) {
    // console.log('request end')
    if (!this._transform) {
      this.push(null)
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
    // console.log('transform end')
    this.push(null)
  }

  /**
   * Handles transform data
   */
  _onTransformData (chunk) {
    // console.log('transform chunk', chunk)
    this.push(chunk)
  }
}

module.exports = HttpGetReader
