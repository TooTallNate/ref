
var assert = require('assert')
var ref = require('../')

describe('int64', function () {

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

})
