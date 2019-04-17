/* eslint-env node, mocha */
import 'ts-jest'
const dataplugHttp = require('../lib')

describe('dataplug-http', () => {
  it('has "HttpGetReader" class', () => {
    expect(dataplugHttp).toHaveProperty('HttpGetReader')
    expect(typeof dataplugHttp).toBe('function')
  })

  it('has "PagedHttpGetReader" class', () => {
    expect(dataplugHttp).toHaveProperty('PagedHttpGetReader')
    expect(typeof dataplugHttp.PagedHttpGetReader).toBe('function')
  })
})
