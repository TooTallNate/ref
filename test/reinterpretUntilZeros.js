
var assert = require('assert')
var weak = require('weak')
var ref = require('../')

describe('reinterpretUntilZeros()', function () {

  beforeEach(gc)

  it('should return a new Buffer instance up until the first 0', function () {
    var buf = new Buffer('hello\0world')
    var buf2 = buf.reinterpretUntilZeros(1)
    assert.equal(buf2.length, 'hello'.length)
    assert.equal(buf2.toString(), 'hello')
  })

  it('should return a new Buffer instance up until the first 2-byte sequence of 0s', function () {
    var str = 'hello world'
    var buf = new Buffer(50)
    var len = buf.write(str, 'ucs2')
    buf.writeInt16LE(0, len) // NULL terminate the string

    var buf2 = buf.reinterpretUntilZeros(2)
    assert.equal(str.length, buf2.length / 2)
    assert.equal(buf2.toString('ucs2'), str)
  })

})
