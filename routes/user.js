'use strict'

const r = require('koa-router')()
const parse = require('co-body')
const user = require('../lib/user')
const authorize = require('../middleware/authorize')

r.put('/-/user/:user', function * () {
  let token = yield user.login(yield parse(this))
  this.assert(token, 401, {error: 'invalid credentials'})

  this.status = 201
  this.body = {token}
})

r.get('/-/whoami', authorize, function * () {
  this.body = {username: this.username}
})

module.exports = r
