/* eslint-env node, mocha */
require('chai')
  .use(require('chai-as-promised'))
  .should()
const nock = require('nock')
const { PassThrough } = require('stream')
const Promise = require('bluebird')
const { HttpGetReader } = require('../lib')

describe('HttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done) => {
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
    }).should.eventually.be.equal('').and.notify(done)
  })

  it('reads no data when server replies 404 HTTP', (done) => {
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
    }).should.eventually.be.equal('').and.notify(done)
  })

  it('reads data', (done) => {
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
    }).should.eventually.be.equal('data').and.notify(done)
  })

  it('reads data via transform', (done) => {
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
    }).should.eventually.be.equal('data').and.notify(done)
    reader.resume()
  })
})
