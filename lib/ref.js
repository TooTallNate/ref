
var debug = require('debug')('ref')
  , assert = require('assert')
  , SlowBuffer = require('buffer').SlowBuffer

exports = module.exports = require('../build/Release/binding.node')

/**
 * Returns a distinct clone of the given type.
 * Mostly used internally by `ref`.
 */

exports.cloneType = function cloneType (type) {
  return {
      size: type.size
    , indirection: type.indirection
    , get: type.get
    , set: type.set
  }
}

/**
 * Returns a new clone of the given "type" object, with its
 * "indirection" level incremented by 1.
 *
 * So for example, to create a type representing a `void *`:
 *
 * ``` js
 * var voidPtrType = ref.refType(ref.types.void)
 * ```
 *
 * Used internally by `ref()`.
 */

exports.refType = function refType (type) {
  var rtn = exports.cloneType(type)
  rtn.indirection++
  return rtn
}

/**
 * Returns a new clone of the given "type" object, with its
 * "indirection" level decremented by 1.
 *
 * Used internally by `deref()`.
 */

exports.derefType = function derefType (type) {
  var rtn = exports.cloneType(type)
  rtn.indirection--
  return rtn
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
      throw new Error('unknown "type"; cannot get()')
    }
    buffer.type.set = function set () {
      throw new Error('unknown "type"; cannot set()')
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
  debug('allocating type with "value"', value)
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
 * Returns a new Buffer instance with the given String written to it in the
 * given encoding (defaults to 'utf8'). The Buffer is 1 byte longer than the
 * string itself, and is NUL terminated.
 */

exports.allocCString = function allocCString (string, encoding) {
  var _typeof = typeof string
  if (string === null || _typeof === 'undefined') {
    return exports.NULL
  }
  assert.equal('string', _typeof, 'expected a "string" as the first argument')
  if (!encoding) {
    encoding = 'utf8'
  }
  var size = Buffer.byteLength(string, encoding) + 1
  var buf = new Buffer(size)
  buf.write(string, 0, size, encoding)
  buf[buf.length - 1] = 0   // NUL terminate
  buf.type = charPtrType
  return buf
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
  var type = exports.refType(exports.getType(buffer))
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
    reference.type = exports.derefType(type)
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
 * Types.
 */

exports.types = {}
exports.types.void = {
    size: 0
  , indirection: 1
  , get: function get (buf, offset) {
      return null
    }
  , set: function set (buf, offset, val) {
      throw new TypeError('cannot set "void" type')
    }
}
exports.types.int8 = {
    size: exports.sizeof.int8
  , indirection: 1
  , get: function get (buf, offset) {
      return buf.readInt8(offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf.writeInt8(val, offset || 0)
    }
}
exports.types.uint8 = {
    size: exports.sizeof.uint8
  , indirection: 1
  , get: function get (buf, offset) {
      return buf.readUInt8(offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf.writeUInt8(val, offset || 0)
    }
}
exports.types.int16 = {
    size: exports.sizeof.int16
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readInt16' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeInt16' + exports.endianness](val, offset || 0)
    }
}
exports.types.uint16 = {
    size: exports.sizeof.uint16
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt16' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt16' + exports.endianness](val, offset || 0)
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
exports.types.uint32 = {
    size: exports.sizeof.uint32
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt32' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt32' + exports.endianness](val, offset || 0)
    }
}
exports.types.int64 = {
    size: exports.sizeof.int64
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readInt64' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeInt64' + exports.endianness](val, offset || 0)
    }
}
exports.types.uint64 = {
    size: exports.sizeof.uint64
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt64' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt64' + exports.endianness](val, offset || 0)
    }
}
exports.types.float = {
    size: exports.sizeof.float
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readFloat' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeFloat' + exports.endianness](val, offset || 0)
    }
}
exports.types.double = {
    size: exports.sizeof.double
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readDouble' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeDouble' + exports.endianness](val, offset || 0)
    }
}

// "typedef"s for the variable-sized types
;[ 'byte', 'char', 'uchar', 'short', 'ushort', 'int', 'uint', 'long', 'ulong'
, 'longlong', 'ulonglong', 'size_t' ].forEach(function (name) {
  var unsigned = name === 'byte' || name === 'size_t' || name[0] === 'u'
  var size = exports.sizeof[name]
  assert(size >= 1 && size <= 8)
  var type = 'int' + (size * 8)
  if (unsigned) {
    type = 'u' + type
  }
  exports.types[name] = exports.types[type]
  assert(exports.types[name])
})


/**
 * NULL_POINTER is essentially:
 *
 * ``` c
 * char **null_pointer;
 * *null_pointer = NULL;
 * ```
 */

exports.NULL.type = exports.types.void
exports.NULL_POINTER = exports.ref(exports.NULL)

/**
 * This `char *` type is used by "allocCString()" above.
 */

var charPtrType = exports.refType(exports.types.char)


/**
 * Buffer convenience methods.
 */

Buffer.prototype.address = function address () {
  return exports.address(this)
}

Buffer.prototype.isNull = function isNull () {
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

Buffer.prototype.readPointer = function readPointer (offset, size) {
  return exports.readPointer(this, offset, size)
}

Buffer.prototype.writePointer = function writePointer (ptr, offset) {
  return exports.writePointer(this, offset, ptr)
}

Buffer.prototype.readCString = function readCString (offset) {
  return exports.readCString(this, offset)
}

Buffer.prototype['readInt64' + exports.endianness] = function readInt64 (offset) {
  return exports.readInt64(this, offset)
}

Buffer.prototype['writeInt64' + exports.endianness] = function writeInt64 (val, offset) {
  return exports.writeInt64(this, offset, val)
}

Buffer.prototype['readUInt64' + exports.endianness] = function readUInt64 (offset) {
  return exports.readUInt64(this, offset)
}

Buffer.prototype['writeUInt64' + exports.endianness] = function writeUInt64 (val, offset) {
  return exports.writeUInt64(this, offset, val)
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
SlowBuffer.prototype.readCString = Buffer.prototype.readCString
SlowBuffer.prototype['readInt64' + exports.endianness] = Buffer.prototype['readInt64' + exports.endianness]
SlowBuffer.prototype['writeInt64' + exports.endianness] = Buffer.prototype['writeInt64' + exports.endianness]
SlowBuffer.prototype['readUInt64' + exports.endianness] = Buffer.prototype['readUInt64' + exports.endianness]
SlowBuffer.prototype['writeUInt64' + exports.endianness] = Buffer.prototype['writeUInt64' + exports.endianness]
