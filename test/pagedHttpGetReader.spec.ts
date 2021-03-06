// Copyright (C) 2017-2019 Brainbean Apps OU (https://brainbeanapps.com).
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import 'ts-jest'
import nock from 'nock'
import { Promise as BluebirdPromise } from 'bluebird'
import { PassThrough, Transform } from 'stream'
import { PagedHttpGetReader } from '../src'

describe('PagedHttpGetReader', () => {
  it('reads no data via HTTP with empty response', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200)

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data',
      (page: any) => false,
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('')
      .then(done)
  })

  it('reads no data when server replies 404 HTTP', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(404)

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data',
      (page: any) => false,
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', (chunk: any) => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('')
      .then(done)
  })

  it('reads data', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data',
      (page: any) => false,
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('reads data via transform', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data',
      (page: any) => false,
      {
        transformFactory: () => new PassThrough(),
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('reads data from 4 pages', done => {
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('reads data from 3 pages and 1 missing page', done => {
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('reads data from 4 pages via transform', done => {
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
      {
        transformFactory: () => new PassThrough(),
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('reads data from 3 pages and 1 missing page via transform', done => {
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
      {
        transformFactory: () => new PassThrough(),
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
  })

  it('handles error', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/no-data',
      (page: any) => false,
      {
        abortOnError: true,
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        reader.on('error', reject).on('end', resolve)
      }),
    )
      .rejects.toThrow(/No match for request/)
      .then(done)
    reader.resume()
  })

  it('handles error with 4 pages', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
      {
        abortOnError: true,
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        reader.on('error', reject).on('end', resolve)
      }),
    )
      .rejects.toThrow(/No match for request/)
      .then(done)
    reader.resume()
  })

  it('handles error via transform', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data')
      .reply(200, 'data')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/no-data/transform',
      (page: any) => false,
      {
        transformFactory: () => new PassThrough(),
        abortOnError: true,
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        reader.on('error', reject)
      }),
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data',
      (page: any) => false,
      {
        transformFactory: () =>
          new Transform({
            transform: (chunk, encoding, callback) => {
              callback(new Error('expected'), null)
            },
          }),
        abortOnError: true,
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        reader.on('error', reject).on('end', resolve)
      }),
    )
      .rejects.toThrow(/expected/)
      .then(done)
    reader.resume()
  })

  it('handles error with 4 pages via transform', done => {
    nock.cleanAll()
    nock('http://dataplug.io')
      .get('/data/1')
      .reply(200, 'd')
      .get('/data/2')
      .reply(200, 'a')
      .get('/data/4')
      .reply(200, 'ta')

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
      {
        transformFactory: () => new PassThrough(),
        abortOnError: true,
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        reader.on('error', reject).on('end', resolve)
      }),
    )
      .rejects.toThrow(/No match for request/)
      .then(done)
    reader.resume()
  })

  it('handles retry', done => {
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

    const reader = new PagedHttpGetReader(
      'http://dataplug.io/data/1',
      (page: any) => {
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
      },
      {
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
        },
      },
    )
    expect(
      new BluebirdPromise((resolve, reject) => {
        let data = ''
        reader
          .on('end', () => resolve(data))
          .on('error', reject)
          .on('data', chunk => {
            data += chunk
          })
      }),
    )
      .resolves.toEqual('data')
      .then(done)
    reader.resume()
  })
})
