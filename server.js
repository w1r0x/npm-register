'use strict'

const opbeat = require('opbeat').start()
const config = require('./config')
const app = require('koa')()
const router = require('./routes')
const fs = require('fs')
const packages = require('./lib/packages')
const path = require('path')

app.name = 'elephant'
app.port = config.port

app.use(require('./middleware/logger'))
app.use(require('koa-compress')())
app.use(require('koa-static')(__dirname + '/public'))

app.on('error', (err, ctx) => {
  metric.event('error', err.stack)
  opbeat.captureError(err, {
    user: {username: ctx.username},
    request: ctx.req
  })
})

app.use(function * (next) {
  try {
    yield next
    if (this.status === 404 && !this.body) this.throw(404, 'not found')
  } catch (err) {
    this.status = err.status || 500
    this.body = {error: err.message}
    this.app.emit('error', err, this)
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

module.exports = app
if (!module.parent) {
  app.listen(app.port, function () {
    console.error(`${app.name} listening on port ${app.port} [${app.env}]`)
  })
}
return

// get package metadata
app.use(r.get('/:name', function * (name) {
  let etag = this.req.headers['if-none-match']
  let pkg = yield packages(this.metric).get(name, etag)
  if (pkg === 304) {
    this.status = 304
    return
  }
  if (pkg === 404) {
    this.status = 404
    this.body = {error: 'no such package available'}
    return
  }
  let cloudfront = this.headers['user-agent'] === 'Amazon CloudFront'
  packages(this.metric).rewriteTarballURLs(pkg, cloudfront ? config.cloudfrontHost : this.headers.host)
  this.set('ETag', pkg.etag)
  this.set('Cache-Control', `public, max-age=${config.cache.packageTTL}`)
  this.body = pkg
}))

module.exports = app
if (!module.parent) {
  app.listen(app.port, function () {
    console.error(`${app.name} listening on port ${app.port} [${app.env}]`)
  })
}
