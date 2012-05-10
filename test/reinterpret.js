
var assert = require('assert')
var ref = require('../')

describe('reinterpret()', function () {

  beforeEach(gc)

  it('should return a new Buffer instance at the same address', function () {
    var buf = new Buffer('hello world')
    var small = buf.slice(0, 0)
    assert.strictEqual(0, small.length)
    assert.strictEqual(buf.address(), small.address())
    var reinterpreted = small.reinterpret(buf.length)
    assert.strictEqual(buf.address(), reinterpreted.address())
    assert.strictEqual(buf.length, reinterpreted.length)
    assert.strictEqual(buf.toString(), reinterpreted.toString())
  })

})
