
0.0.12 / 2012-05-30
===================

 - make the "char" and "uchar" types accept JS String values
 - make the synonym types (i.e. longlong is a synonym for int64) be distinct
   objects, rather than simple JS references
 - fix coersion of a string value of "Object"
 - added the `reinterpretUntilZeros()` function

0.0.11 / 2012-05-17
===================

 - always do string type coersion, like on `alloc()`
 - add a "bool" type, which works with JS `true`/`false` values

0.0.10 / 2012-05-15
===================

 - fix compiler error on Solaris
 - fix compiler errors on Windows

0.0.9 / 2012-05-13
==================

 - allow `ref.alloc()` to not have a value being set with it
 - add the `coerceType()` function (get a proper "type" instance from a string)
 - add the Utf8String type back over from node-ffi
 - conditionally extend SlowBuffer.prototype for node >= v0.7.9

0.0.8 / 2012-05-12
==================

 - make the `void` type "set()" function be a no-op instead of throwing
 - added some more test cases

0.0.7 / 2012-05-09
==================

 - added the `reinterpret()` function

0.0.6 / 2012-05-09
==================

 - add `alignof` mappings for the types
 - add an `Object` type
 - set the `alignment` property on the built-in types

0.0.5 / 2012-05-09
==================

 - quickly add get() and set() functions
 - use the `PRId64` and `PRIu64` snprintf types

0.0.4 / 2012-05-08
==================

 - README improvements; some API documentation
 - removed some leftover debugging statements

0.0.3 / 2012-05-08
==================

 - added `readCString()` function (to `Buffer.prototype` as well)
 - added `writeCString()` function (to `Buffer.prototype` as well)
 - added an `allocCString()` function
 - removed the `Utf8String` type; moved it to node-ffi
 - made `ref.NULL` be a 'void' type

0.0.2 / 2012-05-05
==================

 - Added missing includes for Linux, etc.

0.0.1 / 2012-05-04
==================

 - Initial release
