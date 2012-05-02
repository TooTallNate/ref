
var assert = require('assert')
var ref = require('../')

describe('sizeof', function () {

  Object.keys(ref.sizeof).forEach(function (type) {

    it('sizeof(' + type + ') should be >= 1', function () {
      var size = ref.sizeof[type]
      assert.equal('number', typeof size)
      assert(size >= 1)
    })

  })

})
