
/**
 * Module dependencies.
 */

var fs = require('fs')
var dox = require('dox')
var jade = require('jade')

fs.readFile(__dirname + '/../lib/ref.js', 'utf8', function (err, data) {
  if (err) throw err

  var docs = dox.parseComments(data)

  fs.readFile(__dirname + '/index.jade', 'utf8', function (err, template) {
    if (err) throw err

    template = jade.compile(template)
    var html = template({ docs: docs })

    fs.writeFile(__dirname + '/index.html', html, function (err) {
      if (err) throw err
    })
  })
})
