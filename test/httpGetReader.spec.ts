/* eslint-env node, mocha */
import nock from 'nock'
import { PassThrough, Transform } from 'stream'
import logger from 'winston'
import { HttpGetReader } from '../lib'

require('chai')
  .use(require('chai-as-promised'))
  .should()

const BPromise = require('bluebird')

logger.clear()

describe('HttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new HttpGetReader('http://dataplug.io/data')
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk: any) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
  })

  it('reads no data when server replies 404 HTTP', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new HttpGetReader('http://dataplug.io/data')
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk: any) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
  })

  it('reads data', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/data')
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk: any) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new PassThrough()
    const reader = new HttpGetReader('http://dataplug.io/data', {
      transform
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('error', reject)
      transform
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk: any) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
    reader.resume()
  })

  it('handles error', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/no-data', {
      abortOnError: true
    })
    new BPromise((resolve: any) => {
      reader
        .on('error', resolve)
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles error (no-abort)', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/no-data', {
      abortOnError: false
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk: any) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
    reader.resume()
  })

  it('handles error with transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new PassThrough()
    const reader = new HttpGetReader('http://dataplug.io/no-data/transform', {
      transform,
      abortOnError: true
    })
    new BPromise((resolve: any) => {
      reader
        .on('error', resolve)
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles error in transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new Transform({
      transform: (chunk: any, encoding: string, callback: (error: Error, smth: any) => void) => {
        callback(new Error('expected'), null)
      }
    })
    const reader = new HttpGetReader('http://dataplug.io/data', {
      transform,
      abortOnError: true
    })
    new BPromise((resolve: any) => {
      reader
        .on('error', resolve)
    })
      .should.eventually.be.match(/expected/)
      .and.notify(done)
    reader.resume()
  })
})
