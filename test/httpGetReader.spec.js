/* eslint-env node, mocha */
require('chai')
  .use(require('chai-as-promised'))
  .should()
const nock = require('nock')
const { PassThrough, Transform } = require('stream')
const Promise = require('bluebird')
const logger = require('winston')
const { HttpGetReader } = require('../lib')

logger.clear()

describe('HttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new HttpGetReader('http://dataplug.io/data')
    new Promise((resolve, reject) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
  })

  it('reads no data when server replies 404 HTTP', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new HttpGetReader('http://dataplug.io/data')
    new Promise((resolve, reject) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
  })

  it('reads data', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/data')
    new Promise((resolve, reject) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data via transform', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new PassThrough()
    const reader = new HttpGetReader('http://dataplug.io/data', transform)
    new Promise((resolve, reject) => {
      let data = ''
      reader
        .on('error', reject)
      transform
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
    reader.resume()
  })

  it('handles error', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new HttpGetReader('http://dataplug.io/no-data')
    new Promise((resolve, reject) => {
      const captured = {}
      reader
        .on('end', () => resolve(captured.error))
        .on('error', (error) => {
          captured.error = error
        })
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles error with transform', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new PassThrough()
    const reader = new HttpGetReader('http://dataplug.io/no-data/transform', transform)
    new Promise((resolve, reject) => {
      const captured = {}
      reader
        .on('end', () => resolve(captured.error))
        .on('error', (error) => {
          captured.error = error
        })
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles error in transform', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const transform = new Transform({
      transform: (chunk, encoding, callback) => {
        callback(new Error('expected'), null)
      }
    })
    const reader = new HttpGetReader('http://dataplug.io/data', transform)
    new Promise((resolve, reject) => {
      const captured = {}
      reader
        .on('end', () => resolve(captured.error))
        .on('error', (error) => {
          captured.error = error
        })
    })
      .should.eventually.be.match(/expected/)
      .and.notify(done)
    reader.resume()
  })
})
