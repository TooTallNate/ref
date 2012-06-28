
var assert = require('assert')
var debug = require('debug')('ref')

exports = module.exports = require('bindings')('binding')

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
 * @param {Object} type
 * @return {Object} The new "type" object with its `indirection` incremented by 1.
 */

exports.refType = function refType (type) {
  var _type = exports.coerceType(type)
  var rtn = Object.create(_type)
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
 * @param {Object} type
 * @return {Object} The new "type" object with its `indirection` decremented by 1.
 */

exports.derefType = function derefType (type) {
  var _type = exports.coerceType(type)
  var rtn = Object.getPrototypeOf(_type)
  if (rtn.indirection !== _type.indirection - 1) {
    rtn = Object.create(_type)
    rtn.indirection--
  }
  return rtn
}

/**
 * Coerces a "type" object from a String or a real "type" object. So:
 *
 *   * "int" gets coerced into `ref.types.int`.
 *   * "int *" gets translated into `ref.refType(ref.types.int)`
 *   * `ref.types.int` gets translated into `ref.types.int` (itself)
 *
 * @param {Object|String} type
 * @return {Object} A "type" object
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
      rtn = exports.refType(exports.types.void) // void *
    } else if (rtn === 'string') {
      rtn = exports.types.CString // special char * type
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
 *
 * @param {Buffer} buffer The Buffer instance to get the "type" object from.
 * @return {Object} The "type" object from the given Buffer.
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
 *
 * @param {Buffer} buffer The Buffer instance to read from.
 * @param {Number} offset (optional) The offset on the Buffer to start reading from. Defaults to 0.
 * @param {Object} type (optional) The "type" object to use when reading. Defaults to calling `getType()` on the buffer.
 * @return {?} Whatever value the "type" used when reading returns.
 */

exports.get = function get (buffer, offset, type) {
  if (!offset) {
    offset = 0
  }
  if (type) {
    type = exports.coerceType(type)
  } else {
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
 *
 * @param {Buffer} buffer The Buffer instance to write to.
 * @param {Number} offset The offset on the Buffer to start writing to.
 * @param {?} value The value to write to the Buffer instance.
 * @param {Object} type (optional) The "type" object to use when reading. Defaults to calling `getType()` on the buffer.
 * @return {undefined}
 */

exports.set = function set (buffer, offset, value, type) {
  if (!offset) {
    offset = 0
  }
  if (type) {
    type = exports.coerceType(type)
  } else {
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
 *
 * @param {Object} type The "type" object to allocate.
 * @param {?} value (optional) The initial value set on the returned Buffer.
 * @return {Buffer} A new Buffer instance with it's `type` set to "type", and (optionally) "value" written to it.
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
 *
 * @param {String} string The JS string to be converted to a C string.
 * @param {String} encoding (optional) The encoding to use for the C string. Defaults to 'utf8'.
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
 * proper length.
 *
 * @param {Buffer} buffer The Buffer instance to write to.
 * @param {Number} offset The offset of the buffer to begin writing at.
 * @param {String} string The JS String to write that will be written to the buffer.
 * @param {String} encoding (optional) The encoding to read the C string as. Defaults to 'utf8'.
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

exports['readInt64' + exports.endianness] = exports.readInt64
exports['readUInt64' + exports.endianness] = exports.readUInt64
exports['writeInt64' + exports.endianness] = exports.writeInt64
exports['writeUInt64' + exports.endianness] = exports.writeUInt64

var opposite = exports.endianness == 'LE' ? 'BE' : 'LE'
var int64temp = new Buffer(exports.sizeof.int64)
var uint64temp = new Buffer(exports.sizeof.uint64)

exports['readInt64' + opposite] = function (buffer, offset) {
  for (var i = 0; i < exports.sizeof.int64; i++) {
    int64temp[i] = buffer[offset + exports.sizeof.int64 - i - 1]
  }
  return exports.readInt64(int64temp, 0)
}
exports['readUInt64' + opposite] = function (buffer, offset) {
  for (var i = 0; i < exports.sizeof.uint64; i++) {
    uint64temp[i] = buffer[offset + exports.sizeof.uint64 - i - 1]
  }
  return exports.readUInt64(uint64temp, 0)
}
exports['writeInt64' + opposite] = function (buffer, offset, value) {
  exports.writeInt64(int64temp, 0, value)
  for (var i = 0; i < exports.sizeof.int64; i++) {
    buffer[offset + i] = int64temp[exports.sizeof.int64 - i - 1]
  }
}
exports['writeUInt64' + opposite] = function (buffer, offset, value) {
  exports.writeUInt64(uint64temp, 0, value)
  for (var i = 0; i < exports.sizeof.uint64; i++) {
    buffer[offset + i] = uint64temp[exports.sizeof.uint64 - i - 1]
  }
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
 *
 * @param {Buffer} buffer A Buffer instance to create a reference to.
 * @return {Buffer} A new Buffer instance pointing to "buffer".
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
 *
 * @param {Buffer} buffer A Buffer instance to read a reference from.
 * @return {?} The returned value after dereferencing "buffer".
 */

exports.deref = function deref (buffer) {
  debug('dereferencing buffer', buffer)
  return exports.get(buffer)
}

/**
 * `attach()` is meant for retaining references to Objects/Buffers in JS-land
 * from calls to `_writeObject()` and `_writePointer()`. C-land doesn't retain the
 * source Buffer in `writePointer()`, and `writeObject()` uses a weak reference
 * when writing the Object, so attaching afterwards in necessary. See below...
 *
 * @private true
 */

exports._attach = function _attach (buf, obj) {
  if (!buf._refs) {
    buf._refs = []
  }
  buf._refs.push(obj)
}

/**
 * The private `writeObject()` function does the actual writing of the given
 * Object to the given Buffer instance. This version does not _attach_ the Object
 * to the Buffer, which is potentially unsafe.
 *
 * @private true
 */

exports._writeObject = exports.writeObject

/**
 * Overwrite the native "writeObject" function so that it keeps a ref to the
 * passed in Object in JS-land by adding it to the Bufer's _refs array.
 */

exports.writeObject = function writeObject (buf, offset, obj) {
  debug('writing Object to buffer', buf, offset, obj)
  exports._writeObject(buf, offset, obj)
  exports._attach(buf, obj)
}

/**
 * The private `writePointer()` function does the actual writing of the given
 * pointer Buffer to the target Buffer instance. This version does not _attach_
 * the pointer Buffer to the target Buffer, which is potentially unsafe.
 *
 * @private true
 */

exports._writePointer = exports.writePointer

/**
 * Overwrite the native "writePointer" function so that it keeps a ref to the
 * passed in Buffer in JS-land by adding it to the Bufer's _refs array.
 */

exports.writePointer = function writePointer (buf, offset, ptr) {
  debug('writing pointer to buffer', buf, offset, ptr)
  exports._writePointer(buf, offset, ptr)
  exports._attach(buf, ptr)
}

/**
 * Overwrite the native "reinterpret" function so that the reinterpreted buffer
 * retains a reference to the original buffer, so that it doesn't get GC'd while
 * the reinterpreted buffer is still watching it.
 *
 * @private true
 */

exports._reinterpret = exports.reinterpret

/**
 * Returns a new Buffer instance with the specified size.
 */

exports.reinterpret = function reinterpret (buffer, size) {
  debug('reinterpreting buffer to "%d" bytes', size)
  var rtn = exports._reinterpret(buffer, size)
  exports._attach(rtn, buffer)
  return rtn
}

/**
 * Accepts a `Buffer` instance and a number of `NULL` bytes to read from the
 * pointer. This function will scan past the boundary of the Buffer's `length`
 * until it finds `size` number of aligned `NULL` bytes.
 *
 * This private version does not "attach" the original `Buffer` to the returned
 * `Buffer`, which could be potentially dangerous. Use with caution!
 *
 * @private true
 */

exports._reinterpretUntilZeros = exports.reinterpretUntilZeros

/**
 * Accepts a `Buffer` instance and a number of `NULL` bytes to read from the
 * pointer. This function will scan past the boundary of the Buffer's `length`
 * until it finds `size` number of aligned `NULL` bytes.
 *
 * This is useful for finding the end of NUL-termintated array or C string. For
 * example, the `readCString()` function _could_ be implemented like:
 *
 * ``` js
 * function readCString (buf) {
 *   return ref.reinterpretUntilZeros(buf, 1).toString('utf8')
 * }
 * ```
 *
 */

exports.reinterpretUntilZeros = function reinterpretUntilZeros (buffer, size) {
  debug('reinterpreting buffer to until "%d" NULL (0) bytes are found', size)
  var rtn = exports._reinterpretUntilZeros(buffer, size)
  exports._attach(rtn, buffer)
  return rtn
}

/**
 * Here are all the built-in "types" in ref's Type System. All of the built-in
 * types read and write "native endianness" when multi-byte types are used.
 *
 * @section types
 */

var types = exports.types = {}

/**
 * The `void` type.
 */

types.void = {
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

/**
 * The `int8` type.
 */

types.int8 = {
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

/**
 * The `uint8` type.
 */

types.uint8 = {
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

/**
 * The `int16` type.
 */

types.int16 = {
    size: exports.sizeof.int16
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readInt16' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeInt16' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `uint16` type.
 */

types.uint16 = {
    size: exports.sizeof.uint16
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt16' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt16' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `int32` type.
 */

types.int32 = {
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
 * The `uint32` type.
 */

types.uint32 = {
    size: exports.sizeof.uint32
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt32' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt32' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `int64` type.
 */

types.int64 = {
    size: exports.sizeof.int64
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readInt64' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeInt64' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `uint64` type.
 */

types.uint64 = {
    size: exports.sizeof.uint64
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readUInt64' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeUInt64' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `float` type.
 */

types.float = {
    size: exports.sizeof.float
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readFloat' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeFloat' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `double` type.
 */

types.double = {
    size: exports.sizeof.double
  , indirection: 1
  , get: function get (buf, offset) {
      return buf['readDouble' + exports.endianness](offset || 0)
    }
  , set: function set (buf, offset, val) {
      return buf['writeDouble' + exports.endianness](val, offset || 0)
    }
}

/**
 * The `Object` type. This can be used to read/write regular JS Objects
 * into raw memory.
 */

types.Object = {
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
 * The `CString` (a.k.a `"string"`) type.
 *
 * CStrings are a kind of weird thing. We say it's `sizeof(char *)`, and
 * `indirection` level of 1, which means that we have to return a Buffer that
 * is pointer sized, and points to a some utf8 string data, so we have to create
 * a 2nd "in-between" buffer.
 */

types.CString = {
    size: exports.sizeof.pointer
  , alignment: exports.alignof.pointer
  , indirection: 1
  , get: function get (buf, offset) {
      var _buf = buf.readPointer(offset)
      if (_buf.isNull()) {
        return null
      }
      return _buf.readCString(0)
    }
  , set: function set (buf, offset, val) {
      var _buf = exports.allocCString(val)
      return buf.writePointer(_buf, offset)
    }
}

// alias Utf8String
var utfstringwarned = false
Object.defineProperty(types, 'Utf8String', {
    enumerable: false
  , configurable: true
  , get: function () {
      if (!utfstringwarned) {
        utfstringwarned = true
        console.error('"Utf8String" type is deprecated, use "CString" instead')
      }
      return types.CString
    }
})

/**
 * The `bool` type.
 *
 * Variable-length (1-byte 99% of the time) type that can hold `true` or
 * `false` values.
 */
types.bool = types;

/**
 * The `byte` type.
 */
types.byte = types;

/**
 * The `char` type.
 */
types.char = types;

/**
 * The `uchar` type.
 */
types.uchar = types;

/**
 * The `short` type.
 */
types.short = types;

/**
 * The `ushort` type.
 */
types.ushort = types;

/**
 * The `int` type.
 */
types.int = types;

/**
 * The `uint` type.
 */
types.uint = types;

/**
 * The `long` type.
 */
types.long = types;

/**
 * The `ulong` type.
 */
types.ulong = types;

/**
 * The `longlong` type.
 */
types.longlong = types;

/**
 * The `ulonglong` type.
 */
types.ulonglong = types;

/**
 * The `size_t` type.
 */
types.size_t = types;

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

// make the `bool` type work with JS true/false values
exports.types.bool.get = (function (_get) {
  return function get (buf, offset) {
    return _get(buf, offset) ? true : false
  }
})(exports.types.bool.get)
exports.types.bool.set = (function (_set) {
  return function set (buf, offset, val) {
    if (typeof val !== 'number') {
      val = val ? 1 : 0
    }
    return _set(buf, offset, val)
  }
})(exports.types.bool.set)

/*!
 * Set the `name` property of the types. Used for debugging...
 */

Object.keys(exports.types).forEach(function (name) {
  exports.types[name].name = name
})

/*!
 * Set the `type` property of the `NULL` pointer Buffer object.
 */

exports.NULL.type = exports.types.void

/**
 * `NULL_POINTER` is a Buffer pointing to `NULL`. So it's equivalent to the
 * following C code:
 *
 * ``` c
 * char *null_pointer;
 * null_pointer = NULL;
 * ```
 */

exports.NULL_POINTER = exports.ref(exports.NULL)

/*!
 * This `char *` type is used by "allocCString()" above.
 */

var charPtrType = exports.refType(exports.types.char)

/**
 * `ref` adds a few convenience methods added to `Buffer.prototype`.
 *
 * @section buffer
 */

/**
 * Calls `ref.address()` on the Buffer instance.
 *
 * @return {Number} The memory address of the Buffer.
 */

Buffer.prototype.address = function address () {
  return exports.address(this)
}

/**
 * Calls `ref.isNull()` on the Buffer instance.
 *
 * @return {Boolean} `true` if the memory address of the Buffer is NULL,
 * `false` otherwise.
 */


Buffer.prototype.isNull = function isNull () {
  return exports.isNull(this)
}

/**
 * Calls `ref.ref()` on the Buffer instance.
 *
 * @return {Buffer} A new "pointer" `Buffer` instance pointing to this `Buffer`.
 */

Buffer.prototype.ref = function ref () {
  return exports.ref(this)
}

/**
 * Calls `ref.deref()` on the Buffer instance.
 *
 * @return {?} The dereferenced value from this Buffer.
 */

Buffer.prototype.deref = function deref () {
  return exports.deref(this)
}

/**
 * Calls `ref.readObject()` on the Buffer instance.
 *
 * @param {Number} offset The offset of the Buffer to read the Object from.
 * @return {Object} The JavaScript object that was written to the specified memory
 * address in the Buffer.
 */

Buffer.prototype.readObject = function readObject (offset) {
  return exports.readObject(this, offset)
}

/**
 * Calls `ref.writeObject()` on the Buffer instance.
 *
 * @param {Object} obj The Object to write.
 * @param {Number} offset The offet of the Buffer to write the Object at.
 */

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

Buffer.prototype.readInt64BE = function readInt64BE (offset) {
  return exports.readInt64BE(this, offset)
}

Buffer.prototype.writeInt64BE = function writeInt64BE (val, offset) {
  return exports.writeInt64BE(this, offset, val)
}

Buffer.prototype.readUInt64BE = function readUInt64BE (offset) {
  return exports.readUInt64BE(this, offset)
}

Buffer.prototype.writeUInt64BE = function writeUInt64BE (val, offset) {
  return exports.writeUInt64BE(this, offset, val)
}

Buffer.prototype.readInt64LE = function readInt64LE (offset) {
  return exports.readInt64LE(this, offset)
}

Buffer.prototype.writeInt64LE = function writeInt64LE (val, offset) {
  return exports.writeInt64LE(this, offset, val)
}

Buffer.prototype.readUInt64LE = function readUInt64LE (offset) {
  return exports.readUInt64LE(this, offset)
}

Buffer.prototype.writeUInt64LE = function writeUInt64LE (val, offset) {
  return exports.writeUInt64LE(this, offset, val)
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

  /*!
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
  SlowBuffer.prototype.readInt64BE = Buffer.prototype.readInt64BE
  SlowBuffer.prototype.writeInt64BE = Buffer.prototype.writeInt64BE
  SlowBuffer.prototype.readUInt64BE = Buffer.prototype.readUInt64BE
  SlowBuffer.prototype.writeUInt64BE = Buffer.prototype.writeUInt64BE
  SlowBuffer.prototype.readInt64LE = Buffer.prototype.readInt64LE
  SlowBuffer.prototype.writeInt64LE = Buffer.prototype.writeInt64LE
  SlowBuffer.prototype.readUInt64LE = Buffer.prototype.readUInt64LE
  SlowBuffer.prototype.writeUInt64LE = Buffer.prototype.writeUInt64LE
}
