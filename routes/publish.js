'use strict'

const r = require('koa-router')()
const s3 = require('../lib/s3')
const path = require('path')
const parse = require('co-body')
const crypto = require('crypto')
const authorize = require('../middleware/authorize')
const packages = require('../lib/packages')

function * upload (pkg) {
  let existing = yield packages.get(pkg.name)
  if (existing !== 404) {
    if (Object.keys(existing.versions).includes(pkg['dist-tags'].latest)) this.throw(409, 'version exists')
    pkg.versions = Object.assign({}, existing.versions, pkg.versions)
  }
  pkg.etag = Math.random().toString()
  let attachments = pkg._attachments
  delete pkg._attachments
  for (let filename of Object.keys(attachments)) {
    let attachment = attachments[filename]
    let data = new Buffer(JSON.stringify(attachment.data), 'base64')

    let hash = crypto.createHash('sha1')
    hash.update(data)
    let sha = hash.digest('hex')
    let ext = path.extname(filename)
    filename = path.basename(filename, ext)

    yield s3.putBufferAsync(data, `/tarballs/${pkg.name}/${filename}/${sha}${ext}`, {
      'Content-Type': attachment.content_type,
      'Content-Length': attachment.length
    })
  }
  yield packages.savePkg(pkg).bind(this)
}

r.put('/:name', authorize, function * () {
  let pkg = yield parse(this)
  yield upload(pkg).bind(this)
  this.body = yield packages.get(pkg.name).bind(this)
})

module.exports = r
