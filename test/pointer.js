
var assert = require('assert')
var weak = require('weak')
var ref = require('../')

describe('pointer', function () {

  var test = new Buffer('hello world')

  it('should write and read back a pointer (Buffer) in a Buffer', function () {
    var buf = new Buffer(ref.sizeof.pointer)
    ref.writePointer(buf, 0, test)
    var out = ref.readPointer(buf, 0, test.length)
    assert.strictEqual(out.length, test.length)
    for (var i = 0, l = out.length; i < l; i++) {
      assert.strictEqual(out[i], test[i])
    }
    assert.strictEqual(ref.address(out), ref.address(test))
  })

})
