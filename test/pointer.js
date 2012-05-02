
var assert = require('assert')
var weak = require('weak')
var ref = require('../')

describe('pointer', function () {

  var test = new Buffer('hello world')

  beforeEach(gc)

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

  it('should retain references to a written pointer in a Buffer', function () {
    var child_gc = false
    var parent_gc = false
    var child = new Buffer('a pointer holding some data...')
    var parent = new Buffer(ref.sizeof.pointer)

    weak(child, function () { child_gc = true })
    weak(parent, function () { parent_gc = true })
    ref.writePointer(parent, 0, child)
    assert(!child_gc, '"child" has been garbage collected too soon')
    assert(!parent_gc, '"parent" has been garbage collected too soon')

    // try to GC `child`
    child = null
    gc()
    assert(!child_gc, '"child" has been garbage collected too soon')
    assert(!parent_gc, '"parent" has been garbage collected too soon')

    // now GC `parent`
    parent = null
    gc()
    assert(parent_gc, '"parent" has not been garbage collected')
    assert(child_gc, '"child" has not been garbage collected')
  })

  it('should work 2 levels deep', function () {
    var one = ref.ref(test)
    var two = ref.ref(one)
    var _one = ref.readPointer(two, 0, ref.sizeof.pointer)
    var _test = ref.readPointer(_one, 0, test.length)
    assert.equal(ref.address(one), ref.address(_one))
    assert.equal(ref.address(test), ref.address(_test))
    assert.equal(test.toString(), _test.toString())
  })

})
