/* ansi-ui Copyright (c) 2019 Diagonal Systems Inc. */

/**
 * blessed - a high-level terminal interface library for node.js
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

var Program = require('./program')
var Tput = require('./tput')
var widget = require('./widget')
var colors = require('./colors')
var unicode = require('./unicode')
var helpers = require('./helpers')

function blessed () {
  return blessed.program.apply(null, arguments)
}

blessed.program = blessed.Program = Program
blessed.tput = blessed.Tput = Tput
blessed.widget = widget
blessed.colors = colors
blessed.unicode = unicode
blessed.helpers = helpers

blessed.helpers.sprintf = blessed.tput.sprintf
blessed.helpers.tryRead = blessed.tput.tryRead
blessed.helpers.merge(blessed, blessed.helpers)

blessed.helpers.merge(blessed, blessed.widget)

module.exports = blessed
