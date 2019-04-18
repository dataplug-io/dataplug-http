// Copyright (C) 2017-2019 Brainbean Apps OU (https://brainbeanapps.com).
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import 'ts-jest'
import nock from 'nock'
import { Promise as BluebirdPromise } from 'bluebird'
import { PassThrough, Transform } from 'stream'
import { HttpGetReader } from '../src'

describe('HttpGetReader', () => {
  it('reads no data via HTTP with empty response', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
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

  it('reads no data when server replies 404 HTTP', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
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

  it('reads data', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/data')
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
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

  it('reads data via transform', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new PassThrough()
    const reader = new HttpGetReader('http://dataplug.io/data', {
      transform
    })
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
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

  it('handles error', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/no-data', {
      abortOnError: true
    })
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
        reader
          .on('error', reject)
          .on('end', resolve)
      })
    )
      .rejects.toThrow(/No match for request/)
      .then(done)
    reader.resume()
  })

  it('handles error (no-abort)', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/no-data', {
      abortOnError: false
    })
    expect(
      new BluebirdPromise((resolve: any, reject: any) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => {
            data += chunk
          })
      })
    )
      .resolves.toEqual('')
      .then(done)
    reader.resume()
  })

  it('handles error with transform', done => {
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
      new BluebirdPromise((resolve: any, reject: any) => {
        reader
          .on('error', reject)
          .on('end', resolve)
      })
    )
      .rejects.toThrow(/No match for request/)
      .then(done)
    reader.resume()
  })

  it('handles error in transform', done => {
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
      new BluebirdPromise((resolve: any, reject: any) => {
        reader
          .on('error', reject)
          .on('end', resolve)
      })
    )
      .rejects.toThrow(/expected/)
      .then(done)
    reader.resume()
  })
})
