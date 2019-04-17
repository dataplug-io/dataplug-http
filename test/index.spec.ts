// Copyright (C) 2017-2019 Brainbean Apps OU (https://brainbeanapps.com).
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import 'ts-jest'
import * as dataplugHttp from '../src'

describe('dataplug-http', () => {
  it('has "HttpGetReader" class', () => {
    expect(dataplugHttp).toHaveProperty('HttpGetReader')
    expect(typeof dataplugHttp.HttpGetReader).toBe('function')
  })

  it('has "PagedHttpGetReader" class', () => {
    expect(dataplugHttp).toHaveProperty('PagedHttpGetReader')
    expect(typeof dataplugHttp.PagedHttpGetReader).toBe('function')
  })
})
