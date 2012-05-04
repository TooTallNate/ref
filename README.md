ref
===
### Turn Buffer instances into "pointers"


This module is inspired by the old `Pointer` class from node-ffi, but with the
intent of using Node's fast `Buffer` instances instead of a slow C++ `Pointer`
class. These two concepts were previously very similar, but now this module
brings over the functionality that Pointers had and Buffers are missing, so
now Buffers are a lot more powerful.

#### Features:

 * Get the memory address of any `Buffer` instance
 * Read/write JavaScript Objects to `Buffer` instances
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


Example
-------

``` js
var ref = require('ref')

// so we can all agree that a buffer with the int value written
// to it could be represented as an "int *"
var buf = new Buffer(4)
buf.writeInt32LE(12345)

// first, what is the memory address of the buffer?
console.log(buf.address())

// using `ref`, you can do that, and gain magic abilities!
buf.type = ref.types.int32

// now we can dereference to use the value, and get the "meaningful" value
console.log(buf.deref())  // <- 12345


// you can also get references to the original buffer if you need it.
// this buffer could be thought of as an "int **"
var one = buf.ref()

// and you can dereference all the way back down to an int
console.log(one.deref().deref())  // <- 12345
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
