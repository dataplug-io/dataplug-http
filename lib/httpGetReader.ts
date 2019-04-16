import _ from 'lodash'
import { Readable } from 'stream'
import request from 'request'
import logger from 'winston'
import { URL } from 'url'

/**
 * Reads data from HTTP service URL, optionally altering the data using specified Transform
 */
export default class HttpGetReader extends Readable {

  private url: string | URL
  private options: any
  private request: any

  private onRequestErrorHandler: (err: Error) => void
  private onRequestCloseHandler: () => void
  private onRequestEndHandler: () => void
  private onRequestDataHandler: (chunck: any) => void
  private onRequestResponseHandler: (response: any) => void
  private onTransformErrorHandler: (err: Error) => void
  private onTransformCloseHandler: () => void
  private onTransformEndHandler: () => void
  private onTransformDataHandler: (chunck: any) => void

  /**
   * @constructor
   * @param {string|URL} url HTTP service URL
   * @param {HttpGetReader~Options} [options=] Options
   */
  constructor (url: string | URL, options: any = undefined) {

    options = Object.assign({}, {
      transform: undefined,
      query: undefined,
      headers: undefined,
      responseHandler: HttpGetReader.defaultResponseHandler,
      abortOnError: false
    }, options)

    super({
      objectMode: options.transform && options.transform._readableState
        ? options.transform._readableState.objectMode
        : false
    })

    this.url = url
    this.options = options

    this.request = null

    this.onRequestErrorHandler = (...args: any) => this.onRequestError(...args)
    this.onRequestCloseHandler = (...args) => this.onRequestClose(...args)
    this.onRequestEndHandler = (...args) => this.onRequestEnd(...args)
    this.onRequestDataHandler = (...args) => this.onRequestData(...args)
    this.onRequestResponseHandler = (...args) => this.onRequestResponse(...args)
    this.onTransformErrorHandler = (...args) => this.onTransformError(...args)
    this.onTransformCloseHandler = (...args) => this.onTransformClose(...args)
    this.onTransformEndHandler = (...args) => this.onTransformEnd(...args)
    this.onTransformDataHandler = (...args) => this.onTransformData(...args)

    this.once('read', () => {
      this._safeStartRequest()
    })
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_read_size_1
   * @override
   */
  _read (size: any): void {
    this.emit('read')
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_destroy_err_callback
   */
  _destroy (err: any, callback: (err: any) => void): void {
    // Detach from current stream
    if (this.request) {
      const capturedRequest = this.request
      this.detachFromStreams()
      capturedRequest.destroy(err)
    }

    callback(err)
  }

  /**
   * Starts the request
   */
  _startRequest (): void {
    const options = {
      url: this.url,
      qs: this.options.query || {},
      headers: this.options.headers || {},
      gzip: true
    }

    logger.log('verbose', 'Starting HTTP GET request to \'%s\'', options.url)
    logger.log('debug', 'Headers:', options.headers)
    logger.log('debug', 'Query:', options.qs)

    this.request = request(options)
    this.request
      .on('error', this.onRequestErrorHandler)
      .on('close', this.onRequestCloseHandler)
      .on('response', this.onRequestResponseHandler)
  }

  /**
   * Safely starts the request
   */
  _safeStartRequest (): void {
    try {
      this._startRequest()
    } catch (error) {
      logger.log('error', 'Error while starting HTTP GET request to \'%s\':', this.url, error)
      this.emit('error', error)

      this.detachFromStreams()
      this.push(null)
    }
  }

  /**
   * Handles request error
   */
  private onRequestError (error: any = undefined): void {
    logger.log('error', 'Error while making HTTP GET request to \'%s\':', this.url, error)

    if (this.options.abortOnError) {
      this.emit('error', error)
    } else {
      if (!this.options.transform) {
        this.detachFromStreams()
        this.push(null)
      } else {
        this.options.transform.end()
      }
    }
  }

  /**
   * Handles request close
   */
  private onRequestClose (): void {
    if (!this.options.transform) {
      this.detachFromStreams()
      this.push(null)
    } else {
      this.options.transform.end()
    }
  }

  /**
   * Handles request end
   */
  private onRequestEnd (): void {
    logger.log('verbose', 'HTTP GET request to \'%s\' complete', this.url)

    if (!this.options.transform) {
      this.detachFromStreams()
      this.push(null)
    } else {
      this.options.transform.end()
    }
  }

  /**
   * Handles request data
   */
  private onRequestData (chunk: any): void {
    logger.log('debug', 'Received data while making HTTP GET request to \'%s\'', this.url)
    logger.log('silly', 'Chunk:', _.toString(chunk))

    if (!this.options.transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles request response
   */
  private onRequestResponse (response: any): void {
    logger.log('debug', 'Received response while making HTTP GET request to \'%s\'', this.url)
    logger.log('debug', 'Response HTTP version:', response.httpVersion)
    logger.log('debug', 'Response headers:', response.headers)
    logger.log('debug', 'Response status code:', response.statusCode)
    logger.log('debug', 'Response status message:', response.statusMessage)

    let shouldProcessData: boolean
    try {
      shouldProcessData = this.options.responseHandler(response, this.request)
    } catch (error) {
      logger.log('error', 'Error while handling response to HTTP GET request to \'%s\':', this.url, error)

      this.emit('error', error)
      this.detachFromStreams()
      this.push(null)
      return
    }

    if (shouldProcessData) {
      logger.log('debug', 'Processing response data from paged HTTP GET request to \'%s\'', this.url)
      this.request
        .on('data', this.onRequestDataHandler)
        .on('close', this.onRequestCloseHandler)
        .on('end', this.onRequestEndHandler)
      if (this.options.transform) {
        this.options.transform
          .on('data', this.onTransformDataHandler)
          .on('error', this.onTransformErrorHandler)
          .on('close', this.onTransformCloseHandler)
          .on('end', this.onTransformEndHandler)
        this.request
          .pipe(this.options.transform)
      }
    } else {
      this.detachFromStreams()
      logger.log('debug', 'Going to retry HTTP GET request to \'%s\'', this.url)
      Promise.resolve(shouldProcessData)
        .then((shouldProcessData) => {
          if (shouldProcessData) {
            throw new Error('responseHandler should not return promised true')
          }

          logger.log('debug', 'Retrying HTTP GET request to \'%s\'', this.url)
          this._startRequest()
        })
        .catch((error) => {
          logger.log('error', 'Error while waiting for retrying of HTTP GET request to \'%s\':', this.url, error)

          this.emit('error', error)
          this.detachFromStreams()
          this.push(null)
        })
    }
  }

  /**
   * Handles transform error
   */
  private onTransformError (error: Error): void {
    logger.log('error', 'Error while transforming data from HTTP GET request to \'%s\':', this.url, error)

    if (this.options.abortOnError) {
      this.emit('error', error)
    } else {
      this.options.transform.end()
    }
  }

  /**
   * Handles transform close
   */
  private onTransformClose (): void {
    this.push(null)
    this.detachFromStreams()
  }

  /**
   * Handles transform end
   */
  private onTransformEnd (): void {
    logger.log('verbose', 'Transformation of data from HTTP GET request to \'%s\' ended', this.url)

    this.push(null)
    this.detachFromStreams()
  }

  /**
   * Handles transform data
   */
  private onTransformData (chunk: any): void {
    logger.log('debug', 'Transformed data from HTTP GET request to \'%s\'', this.url)
    logger.log('silly', 'Chunk:', chunk)

    this.push(chunk)
  }

  /**
   * Detach from streams
   */
  private detachFromStreams (): void {
    logger.log('verbose', 'Detaching from streams of HTTP GET request to \'%s\'', this.url)

    if (this.request) {
      this.request.removeListener('data', this.onRequestDataHandler)
      this.request.removeListener('error', this.onRequestErrorHandler)
      this.request.removeListener('close', this.onRequestCloseHandler)
      this.request.removeListener('end', this.onRequestEndHandler)
      this.request.removeListener('response', this.onRequestResponseHandler)
      this.request = null
    }    

    if (this.options.transform) {
      this.options.transform.removeListener('data', this.onTransformDataHandler)
      this.options.transform.removeListener('error', this.onTransformErrorHandler)
      this.options.transform.removeListener('close', this.onTransformCloseHandler)
      this.options.transform.removeListener('end', this.onTransformEndHandler)
      this.options.transform = null
    }
  }

  /**
   * Default response handler
   */
  static defaultResponseHandler (response: any, request: any): boolean {
    if (response.statusCode === 200 || response.statusCode === 404) {
      return true
    }

    if (response.statusCode === 429) {
      return false
    }

    throw new Error(`HTTP ${response.method} request failed with ${response.statusCode}: ${response.statusMessage || 'no details'}`)
  }
}
