
var assert = require('assert')
var weak = require('weak')
var ref = require('../')

describe('Object', function () {

  var obj = {
      foo: 'bar'
    , test: Math.random()
    , now: new Date()
  }

  it('should write and read back an Object in a Buffer', function () {
    var buf = new Buffer(ref.sizeof.Object)
    ref.writeObject(buf, 0, obj)
    var out = ref.readObject(buf)
    assert.strictEqual(obj, out)
    assert.deepEqual(obj, out)
  })

  it('should retain references to written Objects', function () {
    var o_gc = false
    var buf_gc = false
    var o = { foo: 'bar' }
    var buf = new Buffer(ref.sizeof.Object)

    weak(o, function () { o_gc = true })
    weak(buf, function () { buf_gc = true })
    ref.writeObject(buf, 0, o)
    assert(!o_gc, '"o" has been garbage collected too soon')
    assert(!buf_gc, '"buf" has been garbage collected too soon')

    // try to GC `o`
    o = null
    gc()
    assert(!o_gc, '"o" has been garbage collected too soon')
    assert(!buf_gc, '"buf" has been garbage collected too soon')

    // now GC `buf`
    buf = null
    gc()
    assert(buf_gc, '"buf" has not been garbage collected')
    assert(o_gc, '"o" has not been garbage collected')
  })

})
