/* eslint-env node, mocha */
import nock from 'nock'
import { PassThrough, Transform } from 'stream'
import logger from 'winston'
import { PagedHttpGetReader } from '../lib'

require('chai')
  .use(require('chai-as-promised'))
  .should()

const BPromise = require('bluebird')

logger.clear()

describe('PagedHttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page: any) => false)
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('')
      .and.notify(done)
  })

  it('reads no data when server replies 404 HTTP', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page: any) => false)
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page: any) => false)
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page: any) => false, {
      transformFactory: () => new PassThrough()
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data from 4 pages', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/3')
      .reply(200, 't')
      .get('/data/4')
      .reply(200, 'a')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data from 3 pages and 1 missing page', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/3')
      .reply(404)
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data from 4 pages via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/3')
      .reply(200, 't')
      .get('/data/4')
      .reply(200, 'a')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    }, {
      transformFactory: () => new PassThrough()
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('reads data from 3 pages and 1 missing page via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/3')
      .reply(404)
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    }, {
      transformFactory: () => new PassThrough()
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
  })

  it('handles error', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader('http://dataplug.io/no-data', (page: any) => false, {
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

  it('handles error with 4 pages', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    }, {
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

  it('handles error via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader('http://dataplug.io/no-data/transform', (page: any) => false, {
      transformFactory: () => new PassThrough(),
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page: any) => false, {
      transformFactory: () => new Transform({
        transform: (chunk, encoding, callback) => {
          callback(new Error('expected'), null)
        }
      }),
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

  it('handles error with 4 pages via transform', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    }, {
      transformFactory: () => new PassThrough(),
      abortOnError: true
    })
    new BPromise((resolve) => {
      reader
        .on('error', resolve)
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles retry', (done: any) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/3')
      .reply(429)
      .get('/data/4')
      .reply(200, 'a')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page: any) => {
      if (page && page.url === 'http://dataplug.io/data/1') {
        page.url = 'http://dataplug.io/data/2'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/2') {
        page.url = 'http://dataplug.io/data/3'
        return true
      } else if (page && page.url === 'http://dataplug.io/data/3') {
        page.url = 'http://dataplug.io/data/4'
        return true
      }
      return false
    }, {
      transformFactory: () => new PassThrough(),
      responseHandler: (response: any) => {
        if (response.statusCode === 429) {
          nock.cleanAll()
          nock('http://dataplug.io')
            .get('/data/1')
            .reply(200, 'd')
            .get('/data/2')
            .reply(200, 'a')
            .get('/data/3')
            .reply(200, 't')
            .get('/data/4')
            .reply(200, 'a')
          return false
        }

        return true
      }
    })
    new BPromise((resolve: any, reject: any) => {
      let data = ''
      reader
        .on('end', () => resolve(data))
        .on('error', reject)
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.equal('data')
      .and.notify(done)
    reader.resume()
  })
})
