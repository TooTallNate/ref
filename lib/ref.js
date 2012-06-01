
var debug = require('debug')('ref')
  , assert = require('assert')

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
  var _type = exports.coerceType(type)
  var rtn = exports.cloneType(_type)
  rtn.indirection++
  if (_type.name) {
    rtn.name = _type.name + '*'
  }
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
 * Coerces a "type" object from a String or a real "type" object.
 * So:
 *   "int" gets coerced into `ref.types.int`.
 *   "int *" gets translated into `ref.refType(ref.types.int)`
 *   `ref.types.int` gets translated into `ref.types.int` (itself)
 */

exports.coerceType = function coerceType (type) {
  var rtn = type
  if (typeof rtn === 'string') {
    rtn = exports.types[type]
    if (rtn) return rtn

    // strip whitespace
    rtn = type.replace(/\s+/g, '').toLowerCase()
    if (rtn === 'pointer') {
      // legacy "pointer" being used :(
      //console.warn('type of "pointer" should not be used...')
      //console.trace()
      rtn = exports.refType(exports.types.void) // void *
    } else if (rtn === 'string') {
      rtn = exports.types.Utf8String // special char * type
    } else {
      var refCount = 0
      rtn = rtn.replace(/\*/g, function () {
        refCount++
        return ''
      })
      // allow string names to be passed in
      rtn = exports.types[rtn]
      if (refCount > 0) {
        assert(rtn && 'size' in rtn && 'indirection' in rtn
            , 'could not determine a proper "type" from: ' + JSON.stringify(type))
        for (var i = 0; i < refCount; i++) {
          rtn = exports.refType(rtn)
        }
      }
    }
  }
  assert(rtn && 'size' in rtn && 'indirection' in rtn
      , 'could not determine a proper "type" from: ' + JSON.stringify(type))
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
  return exports.coerceType(buffer.type)
}

/**
 * Calls the `get()` function of the Buffer's current "type" (or the
 * passed in type when present) at the given offset. This function handles
 * checking the "indirection" level and returning a proper "dereferenced"
 * Bufffer instance when necessary.
 */

exports.get = function get (buffer, offset, type) {
  if (!offset) {
    offset = 0
  }
  if (!type) {
    type = exports.getType(buffer)
  }
  debug('get(): (offset: %d)', offset, buffer)
  assert(type.indirection > 0, '"indirection" level must be at least 1')
  if (type.indirection === 1) {
    // need to check "type"
    return type.get(buffer, offset)
  } else {
    // need to create a deref'd Buffer
    var size = type.indirection === 2 ? type.size : exports.sizeof.pointer
    var reference = exports.readPointer(buffer, offset, size)
    reference.type = exports.derefType(type)
    return reference
  }
}

/**
 * Calls the `set()` function of the given Buffer's "type" (or the given
 * "type" object if present) at the given offset with the given "value" to set.
 */

exports.set = function set (buffer, offset, value, type) {
  if (!offset) {
    offset = 0
  }
  if (!type) {
    type = exports.getType(buffer)
  }
  debug('set(): (offset: %d)', offset, buffer, value)
  assert(type.indirection > 0, '"indirection" level must be at least 1')
  if (type.indirection === 1) {
    type.set(buffer, offset, value)
  } else {
    exports.writePointer(buffer, offset, value)
  }
}


/**
 * Returns a new Buffer instance big enough to hold `type`,
 * with the given `value` written to it.
 *
 * ``` js
 * var intBuf = ref.alloc(ref.types.int)
 * var int_with_4 = ref.alloc(ref.types.int, 4)
 * ```
 */

exports.alloc = function alloc (_type, value) {
  var type = exports.coerceType(_type)
  debug('allocating Buffer for type with "size"', type.size)
  var size
  if (type.indirection === 1) {
    size = type.size
  } else {
    size = exports.sizeof.pointer
  }
  var buffer = new Buffer(size)
  buffer.type = type
  if (arguments.length >= 2) {
    debug('setting value on allocated buffer', value)
    exports.set(buffer, 0, value, type)
  }
  return buffer
}

/**
 * Returns a new Buffer instance with the given String written to it in the
 * given encoding (defaults to 'utf8'). The Buffer is 1 byte longer than the
 * string itself, and is NUL terminated.
 */

exports.allocCString = function allocCString (string, encoding) {
  if (string === null || typeof string === 'undefined') {
    return exports.NULL
  }
  var size = Buffer.byteLength(string, encoding) + 1
  var buffer = new Buffer(size)
  exports.writeCString(buffer, 0, string, encoding)
  buffer.type = charPtrType
  return buffer
}

/**
 * Writes the given string as a C String (NULL terminated) to the given buffer
 * at the given offset. "encoding" is optional and defaults to 'utf8'.
 *
 * Unlike `readCString()`, this function requires the buffer to actually have the
 * proper length
 */

exports.writeCString = function writeCString (buffer, offset, string, encoding) {
  assert(Buffer.isBuffer(buffer), 'expected a Buffer as the first argument')
  assert.equal('string', typeof string, 'expected a "string" as the third argument')
  if (!offset) {
    offset = 0
  }
  if (!encoding) {
    encoding = 'utf8'
  }
  var size = buffer.length - offset
  var len = buffer.write(string, offset, size, encoding)
  buffer.writeUInt8(0, offset + len)  // NUL terminate
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
 * That is, first it checks the "indirection" count, and if it's greater than
 * 0 then it merely returns another Buffer, but with one level less indirection.
 * When the buffer is at indirection 0, or undefined, then it checks for "type"
 * which should be an Object with it's own "get()" function.
 */

exports.deref = function deref (buffer) {
  debug('dereferencing buffer', buffer)
  return exports.get(buffer)
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
 * Overwrite the native "reinterpret" function so that the reinterpreted buffer
 * retains a reference to the original buffer, so that it doesn't get GC'd while
 * the reinterpreted buffer is still watching it.
 */

exports._reinterpret = exports.reinterpret
exports.reinterpret = function reinterpret (buffer, size) {
  debug('reinterpreting buffer to "%d" bytes', size)
  var rtn = exports._reinterpret(buffer, size)
  exports._attach(rtn, buffer)
  return rtn
}

/**
 */

exports._reinterpretUntilZeros = exports.reinterpretUntilZeros
exports.reinterpretUntilZeros = function reinterpretUntilZeros (buffer, size) {
  debug('reinterpreting buffer to until %d NULL bytes are found', size)
  var rtn = exports._reinterpretUntilZeros(buffer, size)
  exports._attach(rtn, buffer)
  return rtn
}


/**
 * Types.
 */

exports.types = {}
exports.types.void = {
    size: 0
  , indirection: 1
  , get: function get (buf, offset) {
      debug('getting `void` type (returns `null`)')
      return null
    }
  , set: function set (buf, offset, val) {
      debug('setting `void` type (no-op)')
    }
}
exports.types.int8 = {
    size: exports.sizeof.int8
  , indirection: 1
  , get: function get (buf, offset) {
      return buf.readInt8(offset || 0)
    }
  , set: function set (buf, offset, val) {
      if (typeof val === 'string') {
        val = val.charCodeAt(0)
      }
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
      if (typeof val === 'string') {
        val = val.charCodeAt(0)
      }
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
exports.types.Object = {
    size: exports.sizeof.Object
  , indirection: 1
  , get: function get (buf, offset) {
      return buf.readObject(offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf.writeObject(val, offset || 0)
    }
}

/**
 * Utf8Strings are a kind of weird thing. We say it's a sizeof(char *),
 * so that means that we have to return a Buffer that is pointer sized, and points
 * to a some utf8 string data, so we have to create a 2nd "in-between" buffer.
 *
 * Really, people should just use a proper `char *` type.
 * This is only here for legacy purposes...
 */

exports.types.Utf8String = {
    size: exports.sizeof.pointer
  , indirection: 1
  , get: function get (buf, offset) {
      var _buf = buf.readPointer(offset)
      return _buf.readCString(0)
    }
  , set: function set (buf, offset, val) {
      var _buf = exports.allocCString(val)
      return buf.writePointer(_buf, offset)
    }
}


// "typedef"s for the variable-sized types
;[ 'bool', 'byte', 'char', 'uchar', 'short', 'ushort', 'int', 'uint', 'long'
, 'ulong', 'longlong', 'ulonglong', 'size_t' ].forEach(function (name) {
  var unsigned = name === 'bool'
              || name === 'byte'
              || name === 'size_t'
              || name[0] === 'u'
  var size = exports.sizeof[name]
  assert(size >= 1 && size <= 8)
  var typeName = 'int' + (size * 8)
  if (unsigned) {
    typeName = 'u' + typeName
  }
  var type = exports.types[typeName]
  assert(type)
  exports.types[name] = Object.create(type)
})

// set the "alignment" property on the built-in types
Object.keys(exports.alignof).forEach(function (name) {
  if (name === 'pointer') return
  exports.types[name].alignment = exports.alignof[name]
  assert(exports.types[name].alignment > 0)
})

// make the `Utf8String` type have the correct 'alignment' property
exports.types.Utf8String.alignment = exports.alignof.pointer

// make the `bool` type work with JS true/false values
exports.types.bool.get = (function (_get) {
  return function get (buf, offset) {
    return _get(buf, offset) ? true : false
  }
})(exports.types.bool.get)
exports.types.bool.set = (function (_set) {
  return function set (buf, offset, val) {
    return _set(buf, offset, val ? 1 : 0)
  }
})(exports.types.bool.set)

/**
 * Set the "name" of the types. Used for debugging...
 */

Object.keys(exports.types).forEach(function (name) {
  exports.types[name].name = name
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

Buffer.prototype.writeCString = function writeCString (string, offset, encoding) {
  return exports.writeCString(this, offset, string, encoding)
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

Buffer.prototype.reinterpret = function reinterpret (size) {
  return exports.reinterpret(this, size)
}

Buffer.prototype.reinterpretUntilZeros = function reinterpretUntilZeros (size) {
  return exports.reinterpretUntilZeros(this, size)
}

// does SlowBuffer inherit from Buffer? (node >= v0.7.9)
if (!(exports.NULL instanceof Buffer)) {
  debug('extending SlowBuffer\'s prototype since it doesn\'t inherit from Buffer.prototype')

  /**
   * SlowBuffer convenience methods.
   */

  var SlowBuffer = require('buffer').SlowBuffer

  SlowBuffer.prototype.address = Buffer.prototype.address
  SlowBuffer.prototype.isNull = Buffer.prototype.isNull
  SlowBuffer.prototype.ref = Buffer.prototype.ref
  SlowBuffer.prototype.deref = Buffer.prototype.deref
  SlowBuffer.prototype.readObject = Buffer.prototype.readObject
  SlowBuffer.prototype.writeObject = Buffer.prototype.writeObject
  SlowBuffer.prototype.readPointer = Buffer.prototype.readPointer
  SlowBuffer.prototype.writePointer = Buffer.prototype.writePointer
  SlowBuffer.prototype.readCString = Buffer.prototype.readCString
  SlowBuffer.prototype.writeCString = Buffer.prototype.writeCString
  SlowBuffer.prototype.reinterpret = Buffer.prototype.reinterpret
  SlowBuffer.prototype.reinterpretUntilZeros = Buffer.prototype.reinterpretUntilZeros
  SlowBuffer.prototype['readInt64' + exports.endianness] = Buffer.prototype['readInt64' + exports.endianness]
  SlowBuffer.prototype['writeInt64' + exports.endianness] = Buffer.prototype['writeInt64' + exports.endianness]
  SlowBuffer.prototype['readUInt64' + exports.endianness] = Buffer.prototype['readUInt64' + exports.endianness]
  SlowBuffer.prototype['writeUInt64' + exports.endianness] = Buffer.prototype['writeUInt64' + exports.endianness]
}
