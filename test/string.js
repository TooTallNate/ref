
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

  it('should throw on a Buffer containing no \\0 byte', function () {
    var buf = new Buffer('hello world')
    assert.throws(function () {
      buf.readCString(0)
    })
  })

})
