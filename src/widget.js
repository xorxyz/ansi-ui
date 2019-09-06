/**
 * widget.js - high-level interface for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

require('./widgets/ansiimage')
require('./widgets/bigtext')
require('./widgets/box')
require('./widgets/button')
require('./widgets/checkbox')
require('./widgets/element')
require('./widgets/filemanager')
require('./widgets/form')
require('./widgets/image')
require('./widgets/input')
require('./widgets/layout')
require('./widgets/line')
require('./widgets/list')
require('./widgets/listbar')
require('./widgets/listtable')
require('./widgets/loading')
require('./widgets/log')
require('./widgets/message')
require('./widgets/node')
require('./widgets/overlayimage')
require('./widgets/progressbar')
require('./widgets/prompt')
require('./widgets/question')
require('./widgets/radiobutton')
require('./widgets/radioset')
require('./widgets/screen')
require('./widgets/table')
require('./widgets/text')
require('./widgets/textarea')
require('./widgets/textbox')

var widget = module.exports

widget.classes = [
  'Node',
  'Screen',
  'Element',
  'Box',
  'Text',
  'Line',
  'ScrollableBox',
  'ScrollableText',
  'BigText',
  'List',
  'Form',
  'Input',
  'Textarea',
  'Textbox',
  'Button',
  'ProgressBar',
  'FileManager',
  'Checkbox',
  'RadioSet',
  'RadioButton',
  'Prompt',
  'Question',
  'Message',
  'Loading',
  'Listbar',
  'Log',
  'Table',
  'ListTable',
  'Image',
  'ANSIImage',
  'OverlayImage',
  'Layout'
]

widget.classes.forEach(function (name) {
  var file = name.toLowerCase()
  widget[name] = widget[file] = require('./widgets/' + file)
})

widget.aliases = {
  ListBar: 'Listbar',
  PNG: 'ANSIImage'
}

Object.keys(widget.aliases).forEach(function (key) {
  var name = widget.aliases[key]
  widget[key] = widget[name]
  widget[key.toLowerCase()] = widget[name]
})
