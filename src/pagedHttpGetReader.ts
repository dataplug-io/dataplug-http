// Copyright (C) 2017-2019 Brainbean Apps OU (https://brainbeanapps.com).
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import _ from 'lodash'
import { Readable } from 'stream'
import Promise from 'bluebird'
import request from 'request'
import logger from 'winston'
import { URL } from 'url'
import HttpGetReader from'./httpGetReader'

/**
 * Reads data from HTTP service URL that supports pagination, optionally altering the data using specified Transform
 */
export default class PagedHttpGetReader extends Readable {

  private url: string | URL
  private nextPage: any
  private options: any

  private query: any
  private headers: any
  private request: any
  private transform: any

  private onRequestErrorHandler: (err: Error) => void
  private onRequestCloseHandler: () => void
  private onRequestEndHandler: () => void
  private onRequestDataHandler: (chunck: any) => void
  private onRequestResponseHandler: (response: any) => void
  private onTransformErrorHandler: (err: Error) => void
  private onTransformCloseHandler: () => void
  private onTransformEndHandler: () => void
  private onTransformDataHandler: (chunck: any) => void
  private onTransformCompleteHandler: (data: any) => void

  /**
   * @constructor
   * @param {string|URL} url HTTP service URL
   * @param {PagedHttpGetReader~NextPageFunctor} nextPage Next-page functor
   * @param {PagedHttpGetReader~Options} [options=] Options
   */
  constructor (url: string | URL, nextPage: any, options: any = undefined) {
    options = Object.assign({}, {
      transformFactory: undefined,
      query: undefined,
      headers: undefined,
      responseHandler: HttpGetReader.defaultResponseHandler,
      abortOnError: false
    }, options)

    const transform = options.transformFactory ? options.transformFactory() : null
    super({
      objectMode: transform && transform._readableState ? transform._readableState.objectMode : false
    })

    this.url = url
    this.nextPage = nextPage
    this.options = options

    this.query = options.query ? _.cloneDeep(options.query) : null
    this.headers = options.headers ? _.cloneDeep(options.headers) : null
    this.request = null
    this.transform = null

    this.onRequestErrorHandler = (...args) => this.onRequestError(...args)
    this.onRequestCloseHandler = (...args) => this.onRequestClose(...args)
    this.onRequestEndHandler = (...args) => this.onRequestEnd(...args)
    this.onRequestDataHandler = (...args) => this.onRequestData(...args)
    this.onRequestResponseHandler = (...args) => this.onRequestResponse(...args)
    this.onTransformErrorHandler = (...args) => this.onTransformError(...args)
    this.onTransformCloseHandler = (...args) => this.onTransformClose(...args)
    this.onTransformEndHandler = (...args) => this.onTransformEnd(...args)
    this.onTransformDataHandler = (...args) => this.onTransformData(...args)
    this.onTransformCompleteHandler = (...args) => this.onTransformComplete(...args)

    this.once('read', () => {
      this._safeStartRequest()
    })
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_read_size_1
   * @override
   */
  _read (size: any) {
    this.emit('read')
  }

  /**
   * https://nodejs.org/api/stream.html#stream_readable_destroy_err_callback
   */
  _destroy (err: Error, callback: (err: Error) => void) {
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
      qs: this.query || {},
      headers: this.headers || {},
      gzip: true
    }

    logger.log('verbose', `Starting paged HTTP GET request to ${options.url}`)
    logger.log('debug', 'Headers', options.headers)
    logger.log('debug', 'Query', options.qs)

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
      logger.log('error', `Error while starting HTTP GET request to '${this.url}'`, error)
      this.emit('error', error)

      this.detachFromStreams()
      this.push(null)
    }
  }

  /**
   * Handles request error
   */
  private onRequestError (error: Error): void {
    logger.log('error', `Error while making paged HTTP GET request to '${this.url}'`, error)

    if (this.options.abortOnError) {
      this.emit('error', error)
    } else {
      if (!this.transform) {
        this.proceedToNextPage(null)
      } else {
        this.transform.end()
      }
    }
  }

  /**
   * Handles request close
   */
  private onRequestClose (): void {
    if (!this.transform) {
      this.proceedToNextPage(null)
    } else {
      this.transform.end()
    }
  }

  /**
   * Handles request end
   */
  private onRequestEnd (): void {
    logger.log('verbose', `Paged HTTP GET request to ${this.url} complete`)

    if (!this.transform) {
      this.proceedToNextPage(null)
    } else {
      this.transform.end()
    }
  }

  /**
   * Handles request data
   */
  private onRequestData (chunk: any): void {
    logger.log('debug', `Received data while making paged HTTP GET request to ${this.url}`)
    logger.log('silly', 'Chunk', _.toString(chunk))

    if (!this.transform) {
      this.push(chunk)
    }
  }

  /**
   * Handles request response
   */
  private onRequestResponse (response: any): void {
    logger.log('debug', `Received response while making paged HTTP GET request to ${this.url}`)
    logger.log('debug', 'Response HTTP version', response.httpVersion)
    logger.log('debug', 'Response headers', response.headers)
    logger.log('debug', 'Response status code', response.statusCode)
    logger.log('debug', 'Response status message', response.statusMessage)

    let shouldProcessData: boolean
    try {
      shouldProcessData = this.options.responseHandler(response, this.request)
    } catch (error) {
      logger.log('error', `Error while handling response to HTTP GET request to '${this.url}'`, error)

      this.emit('error', error)
      this.detachFromStreams()
      this.push(null)
      return
    }

    if (_.isBoolean(shouldProcessData) && shouldProcessData) {
      logger.log('debug', `Processing response data from paged HTTP GET request to ${this.url}`)
      this.request
        .on('data', this.onRequestDataHandler)
        .on('close', this.onRequestCloseHandler)
        .on('end', this.onRequestEndHandler)
      if (this.options.transformFactory) {
        this.transform = this.options.transformFactory()
        this.transform
          .on('data', this.onTransformDataHandler)
          .on('error', this.onTransformErrorHandler)
          .on('close', this.onTransformCloseHandler)
          .on('end', this.onTransformEndHandler)
          .on('complete', this.onTransformCompleteHandler)
        this.request
          .pipe(this.transform)
      }
    } else {
      this.detachFromStreams()
      logger.log('debug', `Going to retry paged HTTP GET request to ${this.url}`)
      Promise.resolve(shouldProcessData)
        .then((shouldProcessData) => {
          if (shouldProcessData) {
            throw new Error('responseHandler should not return promised true')
          }

          logger.log('debug', `Retrying paged HTTP GET request to ${this.url}`)
          this._startRequest()
        })
        .catch((error) => {
          logger.log('error', `Error while waiting for retrying of paged HTTP GET request to '${this.url}'`, error)

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
    logger.log('error', `Error while transforming data from paged HTTP GET request to '${this.url}'`, error)

    if (this.options.abortOnError) {
      this.emit('error', error)
    } else {
      this.transform.end()
    }
  }

  /**
   * Handles transform close
   */
  private onTransformClose (): void {
    this.transform.end()
  }

  /**
   * Handles transform end
   */
  private onTransformEnd (): void {
    logger.log('verbose', `Transformation of data from paged HTTP GET request to ${this.url} ended`)

    this.proceedToNextPage(null)
  }

  /**
   * Handles transform data
   */
  private onTransformData (chunk: any): void {
    logger.log('debug', `Transformed data from paged HTTP GET request to ${this.url}`)
    logger.log('silly', 'Chunk', chunk)

    this.push(chunk)
  }

  /**
   * Handles complete data from transform
   */
  private onTransformComplete (data: any): void {
    logger.log('verbose', `Transformation of data from paged HTTP GET request to ${this.url} is complete`)
    logger.log('silly', 'Data', data)

    this.proceedToNextPage(data)
  }

  /**
   * Detach from streams
   */
  private detachFromStreams (): void {
    logger.log('verbose', `Detaching from streams of paged HTTP GET request to ${this.url}`)

    if (this.request) {
      this.request.removeListener('data', this.onRequestDataHandler)
      this.request.removeListener('error', this.onRequestErrorHandler)
      this.request.removeListener('close', this.onRequestCloseHandler)
      this.request.removeListener('end', this.onRequestEndHandler)
      this.request.removeListener('response', this.onRequestResponseHandler)
      this.request = null
    }

    if (this.transform) {
      this.transform.removeListener('data', this.onTransformDataHandler)
      this.transform.removeListener('error', this.onTransformErrorHandler)
      this.transform.removeListener('close', this.onTransformCloseHandler)
      this.transform.removeListener('end', this.onTransformEndHandler)
      this.transform.removeListener('complete', this.onTransformCompleteHandler)
      this.transform = null
    }
  }

  /**
   * Proceed to next page
   *
   * @param {} data Data from current page
   */
  private proceedToNextPage (data: any): void {
    this.detachFromStreams()

    logger.log('verbose', `Checking existence of next page of paged HTTP GET request to ${this.url}`)

    let page = {
      url: this.url,
      query: this.query,
      headers: this.headers
    }
    Promise.try(() => this.nextPage(page, data))
      .then((hasNextPage) => {
        if (!hasNextPage) {
          logger.log('verbose', `No page to proceed to of paged HTTP GET request to ${this.url}`)

          this.push(null)
          return
        }

        logger.log('verbose', `Proceeding to next page of paged HTTP GET request to ${this.url}`)

        this.url = page.url
        this.query = page.query
        this.headers = page.headers
        this._startRequest()
      })
    .catch((error) => {
      logger.log('error', `Error in PagedHttpGetReader while checking existence of next page of paged HTTP GET request to ${this.url}`, error)
      this.push(null)
    })
  }
}
