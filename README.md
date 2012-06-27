ref
===
### Turn Buffer instances into "pointers"
[![Build Status](https://secure.travis-ci.org/TooTallNate/ref.png)](http://travis-ci.org/TooTallNate/ref)


This module is inspired by the old `Pointer` class from node-ffi, but with the
intent of using Node's fast `Buffer` instances instead of a slow C++ `Pointer`
class. These two concepts were previously very similar, but now this module
brings over the functionality that Pointers had and Buffers are missing, so
now Buffers are a lot more powerful.

### Features:

 * Get the memory address of any `Buffer` instance
 * Read/write references to JavaScript Objects into `Buffer` instances
 * Read/write `Buffer` instances' memory addresses to other `Buffer` instances
 * Read/write `int64_t` and `uint64_t` data values (Numbers or Strings)
 * A "type" convention, so that you can specify a buffer as an `int *`,
   and reference/dereference at will.
 * Offers a buffer instance representing the `NULL` pointer


Installation
------------

Install with `npm`:

``` bash
$ npm install ref
```


Examples
--------

#### referencing and derefencing

``` js
var ref = require('ref')

// so we can all agree that a buffer with the int value written
// to it could be represented as an "int *"
var buf = new Buffer(4)
buf.writeInt32LE(12345, 0)

// first, what is the memory address of the buffer?
console.log(buf.address())  // ← 140362165284824

// using `ref`, you can set the "type", and gain magic abilities!
buf.type = ref.types.int

// now we can dereference to get the "meaningful" value
console.log(buf.deref())  // ← 12345


// you can also get references to the original buffer if you need it.
// this buffer could be thought of as an "int **"
var one = buf.ref()

// and you can dereference all the way back down to an int
console.log(one.deref().deref())  // ← 12345
```


Additions to `Buffer.prototype`
-------------------------------

`ref` extends Node's core `Buffer` instances with some useful additions:

---

#### `Buffer#address()` → Number

Returns the memory address of the Buffer instance.

---

#### `Buffer#isNull()` → Boolean

Returns `true` if the Buffer's memory address is NULL, `false` otherwise.

---

#### `Buffer#ref()` → Buffer

Returns a new Buffer instance that is referencing this Buffer. That is, the new
Buffer is "pointer" sized, and points to the memory address of this Buffer.

The returned Buffer's `type` property gets set properly as well, with an
`indirection` level increased by 1.

---

#### `Buffer#deref()` → ???

Returns the dereferenced value from the Buffer instance. This depends on the
`type` property being set to a proper "type" instance (see below).

The returned value can be another Buffer, or pretty much be anything else,
depending on the `get()` function of the "type" instance and current
`indirection` level of the Buffer.

---

#### `Buffer#readObject(Number offset)` → Object

Returns the JS `Object` that has previously been written to the Buffer at the
given offset using `writeObject()`.

---

#### `Buffer#writeObject(Object obj, Number offset)` → undefined

Writes the given JS `Object` to the Buffer at the given offset. Make sure that at
least `ref.sizeof.Object` bytes are available in the Buffer after the specified
offset. The object can later be retrieved using `readObject()`.

`obj` gets "attached" to the buffer instance, so that the written object won't
be garbage collected until the target buffer does.

---

#### `Buffer#readPointer(Number offset, Number size)` → Buffer

Returns a new Buffer instance pointing to the address specified in this Buffer at
the given offset. The `size` is the length of the returned Buffer, which defaults
to 0.

---

#### `Buffer#writePointer(Buffer pointer, Number offset)` → undefined

Writes the given Buffer's memory address to this Buffer at the given offset. Make
sure that at least `ref.sizeof.pointer` bytes are available in the Buffer after
the specified offset. The Buffer can later be retrieved again using
`readPointer()`.

`pointer` gets "attached" to the buffer instance, so that the written pointer
won't be garbage collected until the target buffer does.

---

#### `Buffer#readCString(Number offset)` → String

Returns a JS String from read from the Buffer at the given offset. The C String is
read up til the first NULL byte, which indicates the end of the C String.

This function can read beyond the length of a Buffer, and reads up until the first
NULL byte regardless.

---

#### `Buffer#writeCString(String string, Number offset, String encoding)` → undefined

Writes `string` as a C String (i.e. NULL terminated) to this Buffer at the given
offset. `encoding` is optional and defaults to `utf8`.

---

#### `Buffer#readInt64LE(Number offset)` → Number|String

Returns a Number or String representation of the 64-bit int read from this Buffer
at the given offset. If the returned value will fit inside a Number without losing
precision, then a Number is returned, otherwise a String is returned.

---

#### `Buffer#writeInt64LE(Number|String value, Number offset)` → undefined

Writes an value as a `int64_t` to this Buffer at the given offset. `value` may be
either a Number or a String representing the 64-bit int value. Ensure that at
least `ref.sizeof.int64` (always 8) bytes are available in the Buffer after the
given offset.

---

#### `Buffer#readUInt64LE(Number offset)` → Number|String

Returns a Number or String representation of the 64-bit unsigned int read from
this Buffer at the given offset. If the returned value will fit inside a
Number without losing precision, then a Number is returned, otherwise a String
is returned.

---

#### `Buffer#writeUInt64LE(Number|String value, Number offset)` → undefined

Writes an value as a `int64_t` to this Buffer at the given offset. `value` may be
either a Number or a String representing the 64-bit unsigned int value. Ensure
that at least `ref.sizeof.uint64` (always 8) bytes are available in the Buffer
after the given offset.

---

#### `Buffer#readInt64BE(Number offset)` → Number|String

Returns a Number or String representation of the 64-bit int read from this Buffer
at the given offset. If the returned value will fit inside a Number without losing
precision, then a Number is returned, otherwise a String is returned.

---

#### `Buffer#writeInt64BE(Number|String value, Number offset)` → undefined

Writes an value as a `int64_t` to this Buffer at the given offset. `value` may be
either a Number or a String representing the 64-bit int value. Ensure that at
least `ref.sizeof.int64` (always 8) bytes are available in the Buffer after the
given offset.

---

#### `Buffer#readUInt64BE(Number offset)` → Number|String

Returns a Number or String representation of the 64-bit unsigned int read from
this Buffer at the given offset. If the returned value will fit inside a
Number without losing precision, then a Number is returned, otherwise a String
is returned.

---

#### `Buffer#writeUInt64BE(Number|String value, Number offset)` → undefined

Writes an value as a `int64_t` to this Buffer at the given offset. `value` may be
either a Number or a String representing the 64-bit unsigned int value. Ensure
that at least `ref.sizeof.uint64` (always 8) bytes are available in the Buffer
after the given offset.

---

#### `Buffer#reinterpret(Number size)` → Buffer

Returns a new Buffer instance with the exact same memory address as the target
buffer, only you can specifiy the size of the returned buffer as well.

The original buffer instance gets "attached" to the new buffer instance, so that
the original buffer won't be garbage collected until the new buffer does.

__Warning:__ This function is potentially _dangerous_! There are only a small few
use-cases where it _really_ needs to be used (i.e. resizing a Buffer returned from
an FFI'd `malloc()` call), but otherwise, try to avoid it!


Built-in "types"
----------------

`ref` comes with all the basic fixed-size C types that you are probably familiar with:

| **Name**     | **Description**
|:-------------|:-----------------------------------------------------
| `void`       | A `void` type. Derefs to `null`
| `int8`       | Signed 8-bit Integer
| `uint8`      | Unsigned 8-bit Integer
| `int16`      | Signed 16-bit Integer
| `uint16`     | Unsigned 16-bit Integer
| `int32`      | Signed 32-bit Integer
| `uint32`     | Unsigned 32-bit Integer
| `int64`      | Signed 64-bit Integer
| `uint64`     | Unsigned 64-bit Integer
| `float`      | Single Precision Floating Point Number (float)
| `double`     | Double Precision Floating Point Number (double)
| `Object`     | A type capable of reading/writing references to JS objects
| `CString`    | NULL-terminated String (char *)

In addition to the basic types, there are type aliases for common C types.

| **Name**     | **Description**
|:-------------|:-----------------------------------------------------
| `bool`       | bool. Returns/accepts JS `true`/`false` values
| `byte`       | unsigned char
| `char`       | char
| `uchar`      | unsigned char
| `short`      | short
| `ushort`     | unsigned short
| `int`        | int
| `uint`       | unsigned int
| `long`       | long
| `ulong`      | unsigned long
| `longlong`   | long long
| `ulonglong`  | unsigned long long
| `size_t`     | platform-dependent, usually pointer size


The "type" interface
--------------------

You can easily define your own "type" objects at attach to `Buffer` instances.
It just needs to be a regular JavaScript Object that contains the following
properties:

| **Name**      | **Data Type**                    | **Description**
|:--------------|:---------------------------------|:----------------------------------
| `size`        | Number                           | The size in bytes required to hold this type.
| `indirection` | Number                           | The current level of indirection of the buffer. Usually this would be _1_, and gets incremented on Buffers from `ref()` calls. A value of less than or equal to _0_ is invalid.
| `get`         | Function (buffer, offset)        | The function to invoke when dereferencing this type when the indirection level is _1_.
| `set`         | Function (buffer, offset, value) | The function to invoke when setting a value to a buffer instance.
| `name`        | String                           | _(optional)_ The name to use during debugging for this type.
| `alignment`   | Number                           | _(optional)_ The alignment of this type when placed in a struct. Defaults to the type's `size`.

For example, you could define a "bigint" type that dereferences into a
[`bigint`](https://github.com/substack/node-bigint) instance:

``` js
var ref = require('ref')
var bigint = require('bigint')

// define the "type" instance according to the spec
var BigintType = {
    size: ref.sizeof.int64
  , indirection: 1
  , get: function (buffer, offset) {
      // return a bigint instance from the buffer
      return bigint.fromBuffer(buffer)
    }
  , set: function (buffer, offset, value) {
      // 'value' would be a bigint instance
      var val = value.toString()
      return ref.writeInt64(buffer, offset || 0, val)
    }
}

// now we can create instances of the type from existing buffers.
// "buf" is some Buffer instance returned from some external data
// source, which should contain "bigint" binary data.
buf.type = BigintType

// and now you can create "bigint" instances using this generic "types" API
var val = buf.deref()
            .add('1234')
            .sqrt()
            .shiftLeft(5)
```


License
-------

(The MIT License)

Copyright (c) 2012 Nathan Rajlich &lt;nathan@tootallnate.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
