var assert = require('assert')
var ref = require('../')

describe('iojs3issue', function () {
    it('should not crash', function() {
        for (var i = 0; i < 10; i++) {
            gc()
            var buf = new Buffer(8)
            buf.fill(0)
            var buf2 = ref.ref(buf)
            var buf3 = ref.deref(buf2)
        }
    })
    it('should crash', function() {
        for (var i = 0; i < 10; i++) {
            gc()
            var buf = new Buffer(7)
            buf.fill(0)
            var buf2 = ref.ref(buf)
            var buf3 = ref.deref(buf2)
        }
    })
})