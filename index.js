
var debug = require('debug')('ref')

exports = module.exports = require('./build/Release/binding.node')

/**
 * Returns the "type" property of the given Buffer.
 * Creates a default type for the buffer when none exists.
 */

exports.getType = function getType (buffer) {
  if (!buffer.type) {
    debug('WARN: no "type" found on buffer, setting default "type"', buffer)
    buffer.type = {}
    buffer.type.size = buffer.length
    buffer.type.deref = function deref () {
      throw new Error('unknown "type"')
    }
  }
  return buffer.type
}

/**
 * Returns the level of indirection of the given buffer.
 * Sets it to the default level of 1 when none is set.
 */

exports.getIndirection = function getIndirection (buffer) {
  if (typeof buffer._indirection === 'undefined') {
    debug('WARN: no "_indirection" found on buffer, setting to 1', buffer)
    buffer._indirection = 1
  }
  return buffer._indirection | 0
}

/**
 * `ref()` acceps a Buffer instance and returns a new Buffer
 * instance that is "pointer" sized and has it's data pointing to the given
 * Buffer instance. Essentially the created Buffer is a "reference" to the
 * original pointer, equivalent to the following C code:
 *
 * ``` c
 * char *buf = buffer;
 * char **ref = &buf;
 * ```
 */

exports.ref = function ref (buffer) {
  var reference = new Buffer(exports.sizeof.pointer)
  exports.writePointer(reference, 0, buffer)
  reference.type = exports.getType(buffer)
  reference._indirection = exports.getIndirection(buffer) + 1
  return reference
}

/**
 * `deref()` acceps a Buffer instance and attempts to "dereference" it.
 * That is, first it checks the "_indirection" count, and if it's greater than
 * 0 then it merely returns another Buffer, but with one level less indirection.
 * When the buffer is at indirection 0, or undefined, then it checks for "type"
 * which should be an Object with it's own "get()" function.
 */

exports.deref = function deref (buffer) {
  var type = exports.getType(buffer)
  var indirection = exports.getIndirection(buffer)
  if (indirection > 1) {
    // need to create a deref'd Buffer
    var size = indirection === 2 ? type.size : exports.sizeof.pointer
    var reference = exports.readPointer(buffer, 0, size)
    reference.type = type
    reference._indirection = indirection - 1
    return reference
  } else {
    // need to check "type"
    return buffer.type.get(buffer)
  }
}

/**
 * "attach()" is meant for retaining references to Objects/Buffers in JS-land
 * from calls to "writeObject()" and "writePointer()". C-land doesn't retain the
 * source Buffer in "writePointer()", and "writeObject()", uses a weak reference
 * when writing the Object, so attaching afterwards in necessary. See below...
 */

exports._attach = function _attach (buf, obj) {
  if (!buf._refs) {
    buf._refs = []
  }
  buf._refs.push(obj)
}

/**
 * Overwrite the native "writeObject" function so that it keeps a ref to the
 * passed in Object in JS-land by adding it to the Bufer's _refs array.
 */

exports._writeObject = exports.writeObject
exports.writeObject = function writeObject (buf, offset, obj) {
  exports._writeObject(buf, offset, obj)
  exports._attach(buf, obj)
}

/**
 * Overwrite the native "writePointer" function so that it keeps a ref to the
 * passed in Buffer in JS-land by adding it to the Bufer's _refs array.
 */

exports._writePointer = exports.writePointer
exports.writePointer = function writePointer (buf, offset, ptr) {
  exports._writePointer(buf, offset, ptr)
  exports._attach(buf, ptr)
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

exports.types = {}
exports.types.char = {
    size: 1
  , get: function get (buf, offset) {
        return buf.readUInt8(offset || 0)
    }
}
