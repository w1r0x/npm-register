'use strict'

const r = require('koa-router')()
const s3 = require('../lib/s3')
const path = require('path')
const npm = require('../lib/npm')
const config = require('../config')

function * get (name, filename, sha) {
  let key = `/tarballs/${name}/${filename}/${sha}`
  let tarball = yield s3.stream(key)

  if (!tarball) {
    console.error(`saving ${key} to s3`)
    tarball = yield npm.getTarball(name, filename + path.extname(sha))
    yield s3.putStreamAsync(tarball, key, {
      'content-length': tarball.headers['content-length'],
      'content-type': tarball.headers['content-type']
    })
    tarball = yield s3.stream(key)
  }

  this.assert(tarball, 404)
  this.set('Content-Length', tarball.size)
  this.set('Cache-Control', `public, max-age=${config.cache.tarballTTL}`)
}

r.get('/:name/-/:filename/:sha', function * (name, filename, sha) {
  yield get(name, filename, sha).bind(this)
})

r.get('/:scope/:name/-/:filename/:sha', function * (scope, name, filename, sha) {
  yield get(`${scope}/${name}`, filename, sha).bind(this)
})

r.get('/:name/-/:filename', function * (name, filename) {
  let ext = path.extname(filename)
  filename = path.basename(filename, ext)
  this.redirect(`/${name}/-/${filename}/a${ext}`)
})

r.put('/:name', function * () {
  this.authenticated()
  let pkg = yield parse(this)
  try {
    yield packages(this.metric).upload(pkg)
    this.body = yield packages(this.metric).get(pkg.name)
  } catch (err) {
    if (err === packages(this.metric).errors.versionExists) {
      this.body = {error: err.toString()}
      this.status = 409
    } else {
      throw err
    }
  }
})

module.exports = r
