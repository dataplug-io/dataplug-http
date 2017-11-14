/* eslint-env node, mocha */
require('chai')
  .use(require('chai-as-promised'))
  .should()
const nock = require('nock')
const { PassThrough, Transform } = require('stream')
const Promise = require('bluebird')
const logger = require('winston')
const { PagedHttpGetReader } = require('../lib')

logger.clear()

describe('PagedHttpGetReader', () => {
  it('reads no data via HTTP with empty response', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page) => false)
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page) => false)
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page) => false)
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page) => false, () => new PassThrough())
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

  it('reads data from 4 pages', (done) => {
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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

  it('reads data from 3 pages and 1 missing page', (done) => {
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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

  it('reads data from 4 pages via transform', (done) => {
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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
    }, () => new PassThrough())
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

  it('reads data from 3 pages and 1 missing page via transform', (done) => {
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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
    }, () => new PassThrough())
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

  it('handles error', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader('http://dataplug.io/no-data', (page) => false)
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

  it('handles error with 4 pages', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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
    new Promise((resolve, reject) => {
      const captured = {}
      let data = ''
      reader
        .on('end', () => {
          data.should.be.equal('data')
          resolve(captured.error)
        })
        .on('error', (error) => {
          captured.error = error
        })
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })

  it('handles error via transform', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader('http://dataplug.io/no-data/transform', (page) => false, () => new PassThrough())
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

    const reader = new PagedHttpGetReader('http://dataplug.io/data', (page) => false, () => new Transform({
      transform: (chunk, encoding, callback) => {
        callback(new Error('expected'), null)
      }
    }))
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

  it('handles error with 4 pages via transform', (done) => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader('http://dataplug.io/data/1', (page) => {
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
    }, () => new PassThrough())
    new Promise((resolve, reject) => {
      const captured = {}
      let data = ''
      reader
        .on('end', () => {
          data.should.be.equal('data')
          resolve(captured.error)
        })
        .on('error', (error) => {
          captured.error = error
        })
        .on('data', (chunk) => { data += chunk })
    })
      .should.eventually.be.match(/No match for request/)
      .and.notify(done)
    reader.resume()
  })
})
