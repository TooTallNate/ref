
var assert = require('assert')
var ref = require('../')

describe('ref(), deref()', function () {

  beforeEach(gc)

  it('should work 1 layer deep', function () {
    var test = new Buffer('one layer deep')
    var one = ref.ref(test)
    var _test = ref.deref(one)
    assert.equal(test.length, _test.length)
    assert.equal(test.toString(), _test.toString())
  })

  it('should work 2 levels deep', function () {
    var test = new Buffer('two layers deep')
    var one = ref.ref(test)
    var two = ref.ref(one)
    var _one = ref.deref(two)
    var _test = ref.deref(_one)
    assert.equal(ref.address(one), ref.address(_one))
    assert.equal(ref.address(test), ref.address(_test))
    assert.equal(one.length, _one.length)
    assert.equal(test.length, _test.length)
    assert.equal(test.toString(), _test.toString())
  })

  it('should throw when derefing a Buffer with no "type"', function () {
    var test = new Buffer('two layers deep')
    var r = ref.ref(test)
    var _test = ref.deref(r)
    assert.throws(function () {
      ref.deref(_test)
    }, 'unknown "type"')
  })

})
