/* eslint-env node, mocha */
require('chai')
  .should()
const dataplugHttp = require('../lib')

describe('dataplug-http', () => {
  it('has "HttpGetReader" class', () => {
    dataplugHttp
      .should.have.property('HttpGetReader')
      .that.is.an('function')
  })
})
