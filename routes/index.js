'use strict'

const router = require('koa-router')()
const user = require('./user')

router.get('/-/ping', function * () {
  this.body = {}
})

router.use(user.routes(), user.allowedMethods())

module.exports = router
