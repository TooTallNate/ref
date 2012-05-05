
var assert = require('assert')
var ref = require('../')

describe('int64', function () {

  var JS_MAX_INT = +9007199254740992
  var JS_MIN_INT = -9007199254740992

  it('should allow simple ints to be written and read', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    var val = 123456789
    ref.writeInt64(buf, 0, val)
    var rtn = ref.readInt64(buf, 0)
    assert.equal(val, rtn)
  })

  it('should allow INT64_MAX to be written and read', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    var val = '9223372036854775807'
    ref.writeInt64(buf, 0, val)
    var rtn = ref.readInt64(buf, 0)
    assert.equal(val, rtn)
  })

  it('should return a Number when reading JS_MIN_INT', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    ref.writeInt64(buf, 0, JS_MIN_INT)
    var rtn = ref.readInt64(buf, 0)
    assert.equal('number', typeof rtn)
    assert.equal(JS_MIN_INT, rtn)
  })

  it('should return a Number when reading JS_MAX_INT', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    ref.writeInt64(buf, 0, JS_MAX_INT)
    var rtn = ref.readInt64(buf, 0)
    assert.equal('number', typeof rtn)
    assert.equal(JS_MAX_INT, rtn)
  })

  it('should return a String when reading JS_MAX_INT+1', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    var plus_one = '9007199254740993'
    ref.writeInt64(buf, 0, plus_one)
    var rtn = ref.readInt64(buf, 0)
    assert.equal('string', typeof rtn)
    assert.equal(plus_one, rtn)
  })

  it('should return a String when reading JS_MIN_INT-1', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    var minus_one = '-9007199254740993'
    ref.writeInt64(buf, 0, minus_one)
    var rtn = ref.readInt64(buf, 0)
    assert.equal('string', typeof rtn)
    assert.equal(minus_one, rtn)
  })

  it('should return a Number when reading 0, even when written as a String', function () {
    var buf = new Buffer(ref.sizeof.longlong)
    var zero = '0'
    ref.writeInt64(buf, 0, zero)
    var rtn = ref.readInt64(buf, 0)
    assert.equal('number', typeof rtn)
    assert.equal(0, rtn)
  })

  it('should read the same value from a "ref()"d buffer as the original address', function () {
    var buf = new Buffer('test')
    var test = ref.ref(buf)
    assert.equal(ref.readUInt64(test), ref.address(buf))
  })

})
