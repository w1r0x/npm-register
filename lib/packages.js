'use strict'

const co = require('co')
const s3 = require('./s3')
const url = require('url')
const path = require('path')
const npm = require('./npm')

function * save (pkg) {
  this.metric.profile({'s3.save_pkg': pkg.name})
  let data = new Buffer(JSON.stringify(pkg))
  yield s3.putBufferAsync(data, `/packages/${pkg.name}`, {
    'Content-Type': 'application/json'
  })
}

let refreshPkg = co.wrap(function * (npmPkg) {
  try {
    let s3Pkg = yield s3.download(`/packages/${npmPkg.name}`)
    if (!s3Pkg) {
      yield save(npmPkg).bind(this)
      return
    }
    s3Pkg = JSON.parse(s3Pkg)
    if (npmPkg._rev !== s3Pkg._rev) yield save(npmPkg).bind(this)
  } catch (err) { this.app.emit('error', err) }
})

function * get (name, etag) {
  let pkg = yield npm.get(name, etag)
  if (pkg === 304) return 304
  if (pkg === 404) {
    pkg = yield s3.download(`/packages/${name}`)
    if (!pkg) return 404
    this.metric.event({'s3.serve': name})
    return JSON.parse(pkg)
  }
  refreshPkg(pkg).bind(this)
  return pkg
}

function addShaToPath (p, sha) {
  let ext = path.extname(p)
  let filename = path.basename(p, ext)
  p = path.dirname(p)

  p = path.join(p, `${filename}/${sha}${ext}`)
  return p
}

function rewriteTarballURLs (pkg, host) {
  for (let version of Object.keys(pkg.versions)) {
    let dist = pkg.versions[version].dist
    let u = url.parse(dist.tarball)
    u.pathname = addShaToPath(u.pathname, dist.shasum)
    u.host = host
    dist.tarball = url.format(u)
  }
}

module.exports = {
  get: get,
  save
}
