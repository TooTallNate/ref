
exports = module.exports = require('./build/Release/binding.node')

/**
 * The `ref()` function acceps a Buffer instance and returns a new Buffer
 * instance that is "pointer" sized and has it's data pointing to the given
 * Buffer instance. Essentially the created Buffer is a "reference" to the
 * original pointer.
 */

exports.ref = function ref (buffer) {
  var reference = new Buffer(exports.sizeof.pointer)
  exports.writePointer(reference, 0, buffer)
  return reference
}

/**
 * NULL_POINTER is essentially:
 *
 * ``` c
 * char **null_pointer;
 * *null_pointer = NULL;
 * ```
 */

exports.NULL_POINTER = exports.ref(exports.NULL)
