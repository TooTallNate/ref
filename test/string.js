
var assert = require('assert')
var ref = require('../')

describe('string', function () {

  it('should return "hello" for a Buffer containing "hello\\0world"', function () {
    var buf = new Buffer('hello\0world')
    assert.strictEqual('hello', buf.readCString())
  })

})
