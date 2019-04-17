/* eslint-env node, mocha */
import 'ts-jest'

import nock from 'nock'
import { PassThrough, Transform } from 'stream'
import { HttpGetReader } from '../lib'

const BPromise = require('bluebird')

describe('HttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => { data += chunk })
      })
    )
      .resolves.toEqual('')
      .then(done)
  })

  it('reads no data when server replies 404 HTTP', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => { data += chunk })
      })
    )
      .resolves.toEqual('')
      .then(done)
  })

  it('reads data', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => { data += chunk })
      })
    )
      .resolves.toEqual('data')
      .then(done)
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
    expect(
      new BPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('error', reject)
        transform
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => { data += chunk })
      })
    )
      .resolves.toEqual('data')
      .then(done)
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
    expect(
      new BPromise((resolve: any) => {
        reader
          .on('error', resolve)
      })
    )
      .resolves.toMatch(/No match for request/)
      .then(done)
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
    expect(
      new BPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => { data += chunk })
      })
    )
      .resolves.toEqual('')
      .then(done)
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
    expect(
      new BPromise((resolve: any) => {
        reader
          .on('error', resolve)
      })
    )
      .resolves.toMatch(/No match for request/)
      .then(done)
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
    expect(
      new BPromise((resolve: any) => {
        reader
          .on('error', resolve)
      })
    )
      .resolves.toMatch(/expected/)
      .then(done)
    reader.resume()
  })
})
