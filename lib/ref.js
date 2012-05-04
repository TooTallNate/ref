
var debug = require('debug')('ref')
  , assert = require('assert')
  , SlowBuffer = require('buffer').SlowBuffer

exports = module.exports = require('../build/Release/binding.node')

exports.cloneType = function cloneType (type) {
  return {
      size: type.size
    , indirection: type.indirection
    , get: type.get
    , set: type.set
  }
}

/**
 * Returns the "type" property of the given Buffer.
 * Creates a default type for the buffer when none exists.
 */

exports.getType = function getType (buffer) {
  if (!buffer.type) {
    debug('WARN: no "type" found on buffer, setting default "type"', buffer)
    buffer.type = {}
    buffer.type.size = buffer.length
    buffer.type.indirection = 1
    buffer.type.get = function get () {
      throw new Error('unknown "type"')
    }
  }
  return buffer.type
}

/**
 * Returns a new Buffer instance big enough to hold `type`,
 * with the given `value` written to it.
 *
 * ``` js
 * var int_with_4 = ref.alloc(ref.types.int, 4)
 * ```
 */

exports.alloc = function alloc (type, value) {
  var buffer
  assert(type.indirection > 0, '"indirection" level must be at lest 1')
  debug('allocating "type" with "value"', type, value)
  if (type.indirection === 1) {
    buffer = new Buffer(type.size)
    type.set(buffer, 0, value)
  } else {
    buffer = new Buffer(exports.sizeof.pointer)
    exports.writePointer(buffer, 0, value)
  }
  buffer.type = type
  return buffer
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
  debug('creating a reference to buffer', buffer)
  var type = exports.cloneType(exports.getType(buffer))
  type.indirection++
  return exports.alloc(type, buffer)
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
  var indirection = type.indirection
  assert(type.indirection > 0, '"indirection" level must be at lest 1')
  debug('dereferencing buffer', buffer, type, indirection)
  if (indirection === 1) {
    // need to check "type"
    return type.get(buffer)
  } else {
    // need to create a deref'd Buffer
    var size = indirection === 2 ? type.size : exports.sizeof.pointer
    var reference = exports.readPointer(buffer, 0, size)
    reference.type = exports.cloneType(type)
    reference.type.indirection--
    return reference
  }
}

/**
 * "attach()" is meant for retaining references to Objects/Buffers in JS-land
 * from calls to "writeObject()" and "writePointer()". C-land doesn't retain the
 * source Buffer in "writePointer()", and "writeObject()" uses a weak reference
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
  debug('writing Object to buffer', buf, offset, obj)
  exports._writeObject(buf, offset, obj)
  exports._attach(buf, obj)
}

/**
 * Overwrite the native "writePointer" function so that it keeps a ref to the
 * passed in Buffer in JS-land by adding it to the Bufer's _refs array.
 */

exports._writePointer = exports.writePointer
exports.writePointer = function writePointer (buf, offset, ptr) {
  debug('writing pointer to buffer', buf, offset, ptr)
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


/**
 * Types.
 */

exports.types = {}
exports.types.char = {
    size: exports.sizeof.char
  , indirection: 1
  , get: function get (buf, offset) {
      return buf.readUInt8(offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf.writeUInt8(val, offset || 0)
    }
}
exports.types.int32 = {
    size: exports.sizeof.int32
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readInt32' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeInt32' + exports.endianness](val, offset || 0)
    }
}


/**
 * Buffer convenience methods.
 */

Buffer.prototype.address = function address () {
  return exports.address(this)
}

Buffer.isNull = function isNull () {
  return exports.isNull(this)
}

Buffer.prototype.ref = function ref () {
  return exports.ref(this)
}

Buffer.prototype.deref = function deref () {
  return exports.deref(this)
}

Buffer.prototype.readObject = function readObject (offset) {
  return exports.readObject(this, offset)
}

Buffer.prototype.writeObject = function writeObject (obj, offset) {
  return exports.writeObject(this, offset, obj)
}

Buffer.prototype.readPointer = function readPointer (offset) {
  return exports.readPointer(this, offset)
}

Buffer.prototype.writePointer = function writePointer (ptr, offset) {
  return exports.writePointer(this, offset, ptr)
}

Buffer.prototype['readInt64' + exports.endianness] = function readInt64 (offset) {
  return exports.readInt64(this, offset)
}

Buffer.prototype['writeInt64' + exports.endianness] = function writeInt64 (val, offset) {
  return exports.writeInt64(this, offset, val)
}

/**
 * SlowBuffer convenience methods.
 */

SlowBuffer.prototype.address = Buffer.prototype.address
SlowBuffer.prototype.isNull = Buffer.prototype.isNull
SlowBuffer.prototype.ref = Buffer.prototype.ref
SlowBuffer.prototype.deref = Buffer.prototype.deref
SlowBuffer.prototype.readObject = Buffer.prototype.readObject
SlowBuffer.prototype.writeObject = Buffer.prototype.writeObject
SlowBuffer.prototype.readPointer = Buffer.prototype.readPointer
SlowBuffer.prototype.writePointer = Buffer.prototype.writePointer
SlowBuffer.prototype['readInt64' + exports.endianness] = Buffer.prototype['readInt64' + exports.endianness]
SlowBuffer.prototype['writeInt64' + exports.endianness] = Buffer.prototype['writeInt64' + exports.endianness]
