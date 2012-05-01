
var ref = require('./build/Release/binding')

var b = Buffer('hello world')
var ad = ref.address(b)
console.error(ad, b)

var b = b.slice(1)
var ad = ref.address(b)
console.error(ad, b)

var b = b.slice(1)
var ad = ref.address(b)
console.error(ad, b)

var b = b.slice(1)
var ad = ref.address(b)
console.error(ad, b)

var b = b.slice(1)
var ad = ref.address(b)
console.error(ad, b)

var b = b.slice(1)
var ad = ref.address(b)
console.error(ad, b)
