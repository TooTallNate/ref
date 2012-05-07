
var assert = require('assert')
var ref = require('../')

describe('C string', function () {

  it('should return "" for a Buffer containing "\\0"', function () {
    var buf = new Buffer('\0')
    assert.strictEqual('', buf.readCString(0))
  })

  it('should return "hello" for a Buffer containing "hello\\0world"', function () {
    var buf = new Buffer('hello\0world')
    assert.strictEqual('hello', buf.readCString(0))
  })

  describe('allocCString()', function () {

    it('should return a new Buffer containing the given string', function () {
      var buf = ref.allocCString('hello world')
      assert.strictEqual('hello world', buf.readCString())
    })

  })

})
