'use strict'

const user = require('../lib/user')

function * authorize (next) {
  if (this.headers.authorization) {
    let token = this.headers.authorization.split(' ')[1]
    this.username = yield user.getUserFromToken(token)
  }
  this.assert(this.username, 401)
  yield next
}

module.exports = authorize
