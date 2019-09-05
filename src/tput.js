/* ansi-ui Copyright (c) 2019 Diagonal Systems Inc. */

/**
 * tput.js - parse and compile terminfo caps to javascript.
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

// Resources:
//   $ man term
//   $ man terminfo
//   http://invisible-island.net/ncurses/man/term.5.html
//   https://en.wikipedia.org/wiki/Terminfo

// Todo:
// - xterm's XT (set-title capability?) value should
//   be true (at least tmux thinks it should).
//   It's not parsed as true. Investigate.
// - Possibly switch to other method of finding the
//   extended data string table: i += h.symOffsetCount * 2;

/**
 * Modules
 */



var assert = require('assert')
var path = require('path')
var fs = require('fs')
var cp = require('child_process')

/**
 * Tput
 */

function Tput (options) {
  if (!(this instanceof Tput)) {
    return new Tput(options)
  }

  options = options || {}
  if (typeof options === 'string') {
    options = { terminal: options }
  }

  this.options = options
  this.terminal = options.terminal ||
    options.term ||
    process.env.TERM ||
    (process.platform === 'win32' ? 'windows-ansi' : 'xterm')

  this.terminal = this.terminal.toLowerCase()

  this.debug = options.debug
  this.padding = options.padding
  this.extended = options.extended
  this.printf = options.printf
  this.termcap = options.termcap
  this.error = null

  this.terminfoPrefix = options.terminfoPrefix
  this.terminfoFile = options.terminfoFile
  this.termcapFile = options.termcapFile

  if (options.terminal || options.term) {
    this.setup()
  }
}

Tput.prototype.setup = function () {
  this.error = null
  try {
    if (this.termcap) {
      try {
        this.injectTermcap()
      } catch (e) {
        if (this.debug) throw e
        this.error = new Error('Termcap parse error.')
        this._useInternalCap(this.terminal)
      }
    } else {
      try {
        this.injectTerminfo()
      } catch (e) {
        if (this.debug) throw e
        this.error = new Error('Terminfo parse error.')
        this._useInternalInfo(this.terminal)
      }
    }
  } catch (e) {
    // If there was an error, fallback
    // to an internally stored terminfo/cap.
    if (this.debug) throw e
    this.error = new Error('Terminfo not found.')
    this._useXtermInfo()
  }
}

Tput.prototype.term = function (is) {
  return this.terminal.indexOf(is) === 0
}

Tput.prototype._debug = function () {
  if (!this.debug) return
  return console.log.apply(console, arguments)
}

/**
 * Fallback
 */

Tput.prototype._useVt102Cap = function () {
  return this.injectTermcap('vt102')
}

Tput.prototype._useXtermCap = function () {
  return this.injectTermcap(__dirname + '/../usr/xterm.termcap')
}

Tput.prototype._useXtermInfo = function () {
  return this.injectTerminfo(__dirname + '/../usr/xterm')
}

Tput.prototype._useInternalInfo = function (name) {
  name = path.basename(name)
  return this.injectTerminfo(__dirname + '/../usr/' + name)
}

Tput.prototype._useInternalCap = function (name) {
  name = path.basename(name)
  return this.injectTermcap(__dirname + '/../usr/' + name + '.termcap')
}

/**
 * Terminfo
 */

Tput.ipaths = [
  process.env.TERMINFO || '',
  (process.env.TERMINFO_DIRS || '').split(':'),
  (process.env.HOME || '') + '/.terminfo',
  '/usr/share/terminfo',
  '/usr/share/lib/terminfo',
  '/usr/lib/terminfo',
  '/usr/local/share/terminfo',
  '/usr/local/share/lib/terminfo',
  '/usr/local/lib/terminfo',
  '/usr/local/ncurses/lib/terminfo',
  '/lib/terminfo'
]

Tput._infoBuffer = new Buffer("GgElACYADwCdAakFeHRlcm0tMjU2Y29sb3J8eHRlcm0gd2l0aCAyNTYgY29sb3JzAAABAAABAAAAAQAAAAABAQAAAAAAAAABAAABAAEBAAAAAAAAAAABAFAACAAYAP//////////////////////////AAH/fwAABAAGAAgAGQAeACYAKgAuAP//OQBKAEwAUABXAP//WQBmAP//agBuAHgAfAD/////gACEAIkAjgD/////lwCcAP//oQCmAKsAsAC5AL0AxAD//80A0gDYAN4A////////8AD///////8CAf//BgH///////8IAf//DQH//////////xEBFQEbAR8BIwEnAS0BMwE5AT8BRQFJAf//TgH//1IBVwFcAWABZwH//24BcgF6Af////////////////////////////+CAYsB/////5QBnQGmAa8BuAHBAcoB0wHcAeUB////////7gHyAfcB///8Af8B/////xECFAIfAiICJAInAnkC//98Av///////////////34C//////////+CAv//twL/////uwLBAv/////////////////////////////HAssC///////////////////////////////////////////////////////////////////PAv/////WAv//////////3QLkAusC//////IC///5Av///////wAD/////////////wcDDQMTAxoDIQMoAy8DNwM/A0cDTwNXA18DZwNvA3YDfQOEA4sDkwObA6MDqwOzA7sDwwPLA9ID2QPgA+cD7wP3A/8DBwQPBBcEHwQnBC4ENQQ8BEMESwRTBFsEYwRrBHMEewSDBIoEkQSYBP////////////////////////////////////////////////////////////+dBKgErQS1BLkE///CBP//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////IAX///////8kBWMF////////////////////////////////////////////////////////////////////////////////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", 'base64');

Tput.prototype.readTerminfo = function() {
  this.terminal = "xterm-256color";
  return this.parseTerminfo(Tput._infoBuffer, "/usr/share/terminfo/x/xterm-256color");
}

Tput._prefix =
Tput.prototype._prefix = function (term) {
  // If we have a terminfoFile, or our
  // term looks like a filename, use it.
  if (term) {
    if (~term.indexOf(path.sep)) {
      return term
    }
    if (this.terminfoFile) {
      return this.terminfoFile
    }
  }

  var paths = Tput.ipaths.slice()
  var file

  if (this.terminfoPrefix) {
    paths.unshift(this.terminfoPrefix)
  }

  // Try exact matches.
  file = this._tprefix(paths, term)
  if (file) return file

  // Try similar matches.
  file = this._tprefix(paths, term, true)
  if (file) return file

  // Not found.
  throw new Error('Terminfo directory not found.')
}

Tput._tprefix =
Tput.prototype._tprefix = function (prefix, term, soft) {
  if (!prefix) return

  var file,
    dir,
    i,
    sdiff,
    sfile,
    list

  if (Array.isArray(prefix)) {
    for (i = 0; i < prefix.length; i++) {
      file = this._tprefix(prefix[i], term, soft)
      if (file) return file
    }
    return
  }

  var find = function (word) {
    var file, ch

    file = path.resolve(prefix, word[0])
    try {
      fs.statSync(file)
      return file
    } catch (e) {
      ;
    }

    ch = word[0].charCodeAt(0).toString(16)
    if (ch.length < 2) ch = '0' + ch

    file = path.resolve(prefix, ch)
    try {
      fs.statSync(file)
      return file
    } catch (e) {
      ;
    }
  }

  if (!term) {
    // Make sure the directory's sub-directories
    // are all one-letter, or hex digits.
    // return find('x') ? prefix : null;
    try {
      dir = fs.readdirSync(prefix).filter(function (file) {
        return file.length !== 1 && !/^[0-9a-fA-F]{2}$/.test(file)
      })
      if (!dir.length) {
        return prefix
      }
    } catch (e) {
      ;
    }
    return
  }

  term = path.basename(term)
  dir = find(term)

  if (!dir) return

  if (soft) {
    try {
      list = fs.readdirSync(dir)
    } catch (e) {
      return
    }

    list.forEach(function (file) {
      if (file.indexOf(term) === 0) {
        var diff = file.length - term.length
        if (!sfile || diff < sdiff) {
          sdiff = diff
          sfile = file
        }
      }
    })

    return sfile && (soft || sdiff === 0)
      ? path.resolve(dir, sfile)
      : null
  }

  file = path.resolve(dir, term)
  try {
    fs.statSync(file)
    return file
  } catch (e) {
    ;
  }
}

/**
 * Terminfo Parser
 * All shorts are little-endian
 */

Tput.prototype.parseTerminfo = function (data, file) {
  var info = {}
  var extended
  var l = data.length
  var i = 0
  var v
  var o

  var h = info.header = {
    dataSize: data.length,
    headerSize: 12,
    magicNumber: (data[1] << 8) | data[0],
    namesSize: (data[3] << 8) | data[2],
    boolCount: (data[5] << 8) | data[4],
    numCount: (data[7] << 8) | data[6],
    strCount: (data[9] << 8) | data[8],
    strTableSize: (data[11] << 8) | data[10]
  }

  h.total = h.headerSize +
    h.namesSize +
    h.boolCount +
    h.numCount * 2 +
    h.strCount * 2 +
    h.strTableSize

  i += h.headerSize

  // Names Section
  var names = data.toString('ascii', i, i + h.namesSize - 1)
  var parts = names.split('|')
  var name = parts[0]
  var desc = parts.pop()

  info.name = name
  info.names = parts
  info.desc = desc

  info.dir = path.resolve(file, '..', '..')
  info.file = file

  i += h.namesSize - 1

  // Names is nul-terminated.
  assert.equal(data[i], 0)
  i++

  // Booleans Section
  // One byte for each flag
  // Same order as <term.h>
  info.bools = {}
  l = i + h.boolCount
  o = 0
  for (; i < l; i++) {
    v = Tput.bools[o++]
    info.bools[v] = data[i] === 1
  }

  // Null byte in between to make sure numbers begin on an even byte.
  if (i % 2) {
    assert.equal(data[i], 0)
    i++
  }

  // Numbers Section
  info.numbers = {}
  l = i + h.numCount * 2
  o = 0
  for (; i < l; i += 2) {
    v = Tput.numbers[o++]
    if (data[i + 1] === 0xff && data[i] === 0xff) {
      info.numbers[v] = -1
    } else {
      info.numbers[v] = (data[i + 1] << 8) | data[i]
    }
  }

  // Strings Section
  info.strings = {}
  l = i + h.strCount * 2
  o = 0
  for (; i < l; i += 2) {
    v = Tput.strings[o++]
    if (data[i + 1] === 0xff && data[i] === 0xff) {
      info.strings[v] = -1
    } else {
      info.strings[v] = (data[i + 1] << 8) | data[i]
    }
  }

  // String Table
  Object.keys(info.strings).forEach(function (key) {
    if (info.strings[key] === -1) {
      delete info.strings[key]
      return
    }

    // Workaround: fix an odd bug in the screen-256color terminfo where it tries
    // to set -1, but it appears to have {0xfe, 0xff} instead of {0xff, 0xff}.
    // TODO: Possibly handle errors gracefully below, as well as in the
    // extended info. Also possibly do: `if (info.strings[key] >= data.length)`.
    if (info.strings[key] === 65534) {
      delete info.strings[key]
      return
    }

    var s = i + info.strings[key]
    var j = s

    while (data[j]) j++

    assert(j < data.length)

    info.strings[key] = data.toString('ascii', s, j)
  })

  // Extended Header
  if (this.extended !== false) {
    i--
    i += h.strTableSize
    if (i % 2) {
      assert.equal(data[i], 0)
      i++
    }
    l = data.length
    if (i < l - 1) {
      try {
        extended = this.parseExtended(data.slice(i))
      } catch (e) {
        if (this.debug) {
          throw e
        }
        return info
      }
      info.header.extended = extended.header;
      ['bools', 'numbers', 'strings'].forEach(function (key) {
        merge(info[key], extended[key])
      })
    }
  }

  return info
}

/**
 * Extended Parsing
 */

// Some data to help understand:

// For xterm, non-extended header:
// { dataSize: 3270,
//   headerSize: 12,
//   magicNumber: 282,
//   namesSize: 48,
//   boolCount: 38,
//   numCount: 15,
//   strCount: 413,
//   strTableSize: 1388,
//   total: 2342 }

// For xterm, header:
// Offset: 2342
// { header:
//    { dataSize: 928,
//      headerSize: 10,
//      boolCount: 2,
//      numCount: 1,
//      strCount: 57,
//      strTableSize: 117,
//      lastStrTableOffset: 680,
//      total: 245 },

// For xterm, layout:
// { header: '0 - 10', // length: 10
//   bools: '10 - 12', // length: 2
//   numbers: '12 - 14', // length: 2
//   strings: '14 - 128', // length: 114 (57 short)
//   symoffsets: '128 - 248', // length: 120 (60 short)
//   stringtable: '248 - 612', // length: 364
//   sym: '612 - 928' } // length: 316
//
// How lastStrTableOffset works:
//   data.length - h.lastStrTableOffset === 248
//     (sym-offset end, string-table start)
//   364 + 316 === 680 (lastStrTableOffset)
// How strTableSize works:
//   h.strCount + [symOffsetCount] === h.strTableSize
//   57 + 60 === 117 (strTableSize)
//   symOffsetCount doesn't actually exist in the header. it's just implied.
// Getting the number of sym offsets:
//   h.symOffsetCount = h.strTableSize - h.strCount;
//   h.symOffsetSize = (h.strTableSize - h.strCount) * 2;

Tput.prototype.parseExtended = function (data) {
  var info = {}
  var l = data.length
  var i = 0

  var h = info.header = {
    dataSize: data.length,
    headerSize: 10,
    boolCount: (data[i + 1] << 8) | data[i + 0],
    numCount: (data[i + 3] << 8) | data[i + 2],
    strCount: (data[i + 5] << 8) | data[i + 4],
    strTableSize: (data[i + 7] << 8) | data[i + 6],
    lastStrTableOffset: (data[i + 9] << 8) | data[i + 8]
  }

  // h.symOffsetCount = h.strTableSize - h.strCount;

  h.total = h.headerSize +
    h.boolCount +
    h.numCount * 2 +
    h.strCount * 2 +
    h.strTableSize

  i += h.headerSize

  // Booleans Section
  // One byte for each flag
  var _bools = []
  l = i + h.boolCount
  for (; i < l; i++) {
    _bools.push(data[i] === 1)
  }

  // Null byte in between to make sure numbers begin on an even byte.
  if (i % 2) {
    assert.equal(data[i], 0)
    i++
  }

  // Numbers Section
  var _numbers = []
  l = i + h.numCount * 2
  for (; i < l; i += 2) {
    if (data[i + 1] === 0xff && data[i] === 0xff) {
      _numbers.push(-1)
    } else {
      _numbers.push((data[i + 1] << 8) | data[i])
    }
  }

  // Strings Section
  var _strings = []
  l = i + h.strCount * 2
  for (; i < l; i += 2) {
    if (data[i + 1] === 0xff && data[i] === 0xff) {
      _strings.push(-1)
    } else {
      _strings.push((data[i + 1] << 8) | data[i])
    }
  }

  // Pass over the sym offsets and get to the string table.
  i = data.length - h.lastStrTableOffset
  // Might be better to do this instead if the file has trailing bytes:
  // i += h.symOffsetCount * 2;

  // String Table
  var high = 0
  _strings.forEach(function (offset, k) {
    if (offset === -1) {
      _strings[k] = ''
      return
    }

    var s = i + offset
    var j = s

    while (data[j]) j++

    assert(j < data.length)

    // Find out where the string table ends by
    // getting the highest string length.
    if (high < j - i) {
      high = j - i
    }

    _strings[k] = data.toString('ascii', s, j)
  })

  // Symbol Table
  // Add one to the highest string length because we didn't count \0.
  i += high + 1
  l = data.length

  var sym = []
  var j

  for (; i < l; i++) {
    j = i
    while (data[j]) j++
    sym.push(data.toString('ascii', i, j))
    i = j
  }

  // Identify by name
  j = 0

  info.bools = {}
  _bools.forEach(function (bool) {
    info.bools[sym[j++]] = bool
  })

  info.numbers = {}
  _numbers.forEach(function (number) {
    info.numbers[sym[j++]] = number
  })

  info.strings = {}
  _strings.forEach(function (string) {
    info.strings[sym[j++]] = string
  })

  // Should be the very last bit of data.
  assert.equal(i, data.length)

  return info
}

Tput.prototype.compileTerminfo = function (term) {
  return this.compile(this.readTerminfo(term))
}

Tput.prototype.injectTerminfo = function (term) {
  return this.inject(this.compileTerminfo(term))
}

/**
 * Compiler - terminfo cap->javascript
 */

Tput.prototype.compile = function (info) {
  var self = this

  if (!info) {
    throw new Error('Terminal not found.')
  }

  this.detectFeatures(info)

  this._debug(info)

  info.all = {}
  info.methods = {};

  ['bools', 'numbers', 'strings'].forEach(function (type) {
    Object.keys(info[type]).forEach(function (key) {
      info.all[key] = info[type][key]
      info.methods[key] = self._compile(info, key, info.all[key])
    })
  })

  Tput.bools.forEach(function (key) {
    if (info.methods[key] == null) info.methods[key] = false
  })

  Tput.numbers.forEach(function (key) {
    if (info.methods[key] == null) info.methods[key] = -1
  })

  Tput.strings.forEach(function (key) {
    if (!info.methods[key]) info.methods[key] = noop
  })

  Object.keys(info.methods).forEach(function (key) {
    if (!Tput.alias[key]) return
    Tput.alias[key].forEach(function (alias) {
      info.methods[alias] = info.methods[key]
    })
    // Could just use:
    // Object.keys(Tput.aliasMap).forEach(function(key) {
    //   info.methods[key] = info.methods[Tput.aliasMap[key]];
    // });
  })

  return info
}

Tput.prototype.inject = function (info) {
  var self = this
  var methods = info.methods || info

  Object.keys(methods).forEach(function (key) {
    if (typeof methods[key] !== 'function') {
      self[key] = methods[key]
      return
    }
    self[key] = function () {
      var args = Array.prototype.slice.call(arguments)
      return methods[key].call(self, args)
    }
  })

  this.info = info
  this.all = info.all
  this.methods = info.methods
  this.bools = info.bools
  this.numbers = info.numbers
  this.strings = info.strings

  if (!~info.names.indexOf(this.terminal)) {
    this.terminal = info.name
  }

  this.features = info.features
  Object.keys(info.features).forEach(function (key) {
    if (key === 'padding') {
      if (!info.features.padding && self.options.padding !== true) {
        self.padding = false
      }
      return
    }
    self[key] = info.features[key]
  })
}

// See:
// ~/ncurses/ncurses/tinfo/lib_tparm.c
// ~/ncurses/ncurses/tinfo/comp_scan.c
Tput.prototype._compile = function (info, key, str) {
  var v

  this._debug('Compiling %s: %s', key, JSON.stringify(str))

  switch (typeof str) {
    case 'boolean':
      return str
    case 'number':
      return str
    case 'string':
      break
    default:
      return noop
  }

  if (!str) {
    return noop
  }

  // See:
  // ~/ncurses/progs/tput.c - tput() - L149
  // ~/ncurses/progs/tset.c - set_init() - L992
  if (key === 'init_file' || key === 'reset_file') {
    try {
      str = fs.readFileSync(str, 'utf8')
      if (this.debug) {
        v = ('return ' + JSON.stringify(str) + ';')
          .replace(/\x1b/g, '\\x1b')
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n')
        process.stdout.write(v + '\n')
      }
      return function () { return str }
    } catch (e) {
      return noop
    }
  }

  var tkey = info.name + '.' + key
  var header = 'var v, dyn = {}, stat = {}, stack = [], out = [];'
  var footer = ';return out.join("");'
  var code = header
  var val = str
  var buff = ''
  var cap
  var ch
  var fi
  var then
  var els
  var end

  function read (regex, no) {
    cap = regex.exec(val)
    if (!cap) return
    val = val.substring(cap[0].length)
    ch = cap[1]
    if (!no) clear()
    return cap
  }

  function stmt (c) {
    if (code[code.length - 1] === ',') {
      code = code.slice(0, -1)
    }
    code += c
  }

  function expr (c) {
    code += c + ','
  }

  function echo (c) {
    if (c === '""') return
    expr('out.push(' + c + ')')
  }

  function print (c) {
    buff += c
  }

  function clear () {
    if (buff) {
      echo(JSON.stringify(buff).replace(/\\u00([0-9a-fA-F]{2})/g, '\\x$1'))
      buff = ''
    }
  }

  while (val) {
    // Ignore newlines
    if (read(/^\n /, true)) {
      continue
    }

    // '^A' -> ^A
    if (read(/^\^(.)/i, true)) {
      if (!(ch >= ' ' && ch <= '~')) {
        this._debug('%s: bad caret char.', tkey)
        // NOTE: ncurses appears to simply
        // continue in this situation, but
        // I could be wrong.
        print(cap[0])
        continue
      }
      if (ch === '?') {
        ch = '\x7f'
      } else {
        ch = ch.charCodeAt(0) & 31
        if (ch === 0) ch = 128
        ch = String.fromCharCode(ch)
      }
      print(ch)
      continue
    }

    // 3 octal digits -> character
    if (read(/^\\([0-7]{3})/, true)) {
      print(String.fromCharCode(parseInt(ch, 8)))
      continue
    }

    // '\e' -> ^[
    // '\n' -> \n
    // '\r' -> \r
    // '\0' -> \200 (special case)
    if (read(/^\\([eEnlrtbfs\^\\,:0]|.)/, true)) {
      switch (ch) {
        case 'e':
        case 'E':
          ch = '\x1b'
          break
        case 'n':
          ch = '\n'
          break
        case 'l':
          ch = '\x85'
          break
        case 'r':
          ch = '\r'
          break
        case 't':
          ch = '\t'
          break
        case 'b':
          ch = '\x08'
          break
        case 'f':
          ch = '\x0c'
          break
        case 's':
          ch = ' '
          break
        case '^':
          ch = '^'
          break
        case '\\':
          ch = '\\'
          break
        case ',':
          ch = ','
          break
        case ':':
          ch = ':'
          break
        case '0':
          ch = '\x80'
          break
        case 'a':
          ch = '\x07'
          break
        default:
          this._debug('%s: bad backslash char.', tkey)
          ch = cap[0]
          break
      }
      print(ch)
      continue
    }

    // $<5> -> padding
    // e.g. flash_screen: '\u001b[?5h$<100/>\u001b[?5l',
    if (read(/^\$<(\d+)([*\/]{0,2})>/, true)) {
      if (this.padding) print(cap[0])
      continue
    }

    // %%   outputs `%'
    if (read(/^%%/, true)) {
      print('%')
      continue
    }

    // %[[:]flags][width[.precision]][doxXs]
    //   as in printf, flags are [-+#] and space.  Use a `:' to allow the
    //   next character to be a `-' flag, avoiding interpreting "%-" as an
    //   operator.
    // %c   print pop() like %c in printf
    // Example from screen terminfo:
    //   S0: "\u001b(%p1%c"
    // %d   print pop()
    // "Print (e.g., "%d") is a special case."
    // %s   print pop() like %s in printf
    if (read(/^%((?::-|[+# ]){1,4})?(\d+(?:\.\d+)?)?([doxXsc])/)) {
      if (this.printf || cap[1] || cap[2] || ~'oxX'.indexOf(cap[3])) {
        echo('sprintf("' + cap[0].replace(':-', '-') + '", stack.pop())')
      } else if (cap[3] === 'c') {
        echo('(v = stack.pop(), isFinite(v) ' +
          '? String.fromCharCode(v || 0200) : "")')
      } else {
        echo('stack.pop()')
      }
      continue
    }

    // %p[1-9]
    //   push i'th parameter
    if (read(/^%p([1-9])/)) {
      expr('(stack.push(v = params[' + (ch - 1) + ']), v)')
      continue
    }

    // %P[a-z]
    //   set dynamic variable [a-z] to pop()
    if (read(/^%P([a-z])/)) {
      expr('dyn.' + ch + ' = stack.pop()')
      continue
    }

    // %g[a-z]
    //   get dynamic variable [a-z] and push it
    if (read(/^%g([a-z])/)) {
      expr('(stack.push(dyn.' + ch + '), dyn.' + ch + ')')
      continue
    }

    // %P[A-Z]
    //   set static variable [a-z] to pop()
    if (read(/^%P([A-Z])/)) {
      expr('stat.' + ch + ' = stack.pop()')
      continue
    }

    // %g[A-Z]
    //   get static variable [a-z] and push it
    //   The  terms  "static"  and  "dynamic" are misleading.  Historically,
    //   these are simply two different sets of variables, whose values are
    //   not reset between calls to tparm.  However, that fact is not
    //   documented in other implementations.  Relying on it will adversely
    //   impact portability to other implementations.
    if (read(/^%g([A-Z])/)) {
      expr('(stack.push(v = stat.' + ch + '), v)')
      continue
    }

    // %'c' char constant c
    // NOTE: These are stored as c chars, exemplified by:
    // cursor_address: "\u001b=%p1%' '%+%c%p2%' '%+%c"
    if (read(/^%'(.)'/)) {
      expr('(stack.push(v = ' + ch.charCodeAt(0) + '), v)')
      continue
    }

    // %{nn}
    //   integer constant nn
    if (read(/^%\{(\d+)\}/)) {
      expr('(stack.push(v = ' + ch + '), v)')
      continue
    }

    // %l   push strlen(pop)
    if (read(/^%l/)) {
      expr('(stack.push(v = (stack.pop() || "").length || 0), v)')
      continue
    }

    // %+ %- %* %/ %m
    //   arithmetic (%m is mod): push(pop() op pop())
    // %& %| %^
    //   bit operations (AND, OR and exclusive-OR): push(pop() op pop())
    // %= %> %<
    //   logical operations: push(pop() op pop())
    if (read(/^%([+\-*\/m&|\^=><])/)) {
      if (ch === '=') ch = '==='
      else if (ch === 'm') ch = '%'
      expr('(v = stack.pop(),' +
        ' stack.push(v = (stack.pop() ' + ch + ' v) || 0),' +
        ' v)')
      continue
    }

    // %A, %O
    //   logical AND and OR operations (for conditionals)
    if (read(/^%([AO])/)) {
      // Are we supposed to store the result on the stack?
      expr('(stack.push(v = (stack.pop() ' +
        (ch === 'A' ? '&&' : '||') +
        ' stack.pop())), v)')
      continue
    }

    // %! %~
    //   unary operations (logical and bit complement): push(op pop())
    if (read(/^%([!~])/)) {
      expr('(stack.push(v = ' + ch + 'stack.pop()), v)')
      continue
    }

    // %i   add 1 to first two parameters (for ANSI terminals)
    if (read(/^%i/)) {
      // Are these supposed to go on the stack in certain situations?
      // ncurses doesn't seem to put them on the stack, but xterm.user6
      // seems to assume they're on the stack for some reason. Could
      // just be a bad terminfo string.
      // user6: "\u001b[%i%d;%dR" - possibly a termcap-style string.
      // expr('(params[0] |= 0, params[1] |= 0, params[0]++, params[1]++)');
      expr('(params[0]++, params[1]++)')
      continue
    }

    // %? expr %t thenpart %e elsepart %;
    //   This forms an if-then-else.  The %e elsepart is optional.  Usually
    //   the %? expr part pushes a value onto the stack, and %t pops it from
    //   the stack, testing if it is nonzero (true).  If it is zero (false),
    //   control passes to the %e (else) part.
    //   It is possible to form else-if's a la Algol 68:
    //     %? c1 %t b1 %e c2 %t b2 %e c3 %t b3 %e c4 %t b4 %e %;
    //   where ci are conditions, bi are bodies.
    if (read(/^%\?/)) {
      end = -1
      stmt(';if (')
      continue
    }

    if (read(/^%t/)) {
      end = -1
      // Technically this is supposed to pop everything off the stack that was
      // pushed onto the stack after the if statement, see man terminfo.
      // Right now, we don't pop anything off. This could cause compat issues.
      // Perhaps implement a "pushed" counter from the time the if statement
      // is added, to the time the then statement is added, and pop off
      // the appropriate number of elements.
      // while (pushed--) expr('stack.pop()');
      stmt(') {')
      continue
    }

    // Terminfo does elseif's like
    // this: %?[expr]%t...%e[expr]%t...%;
    if (read(/^%e/)) {
      fi = val.indexOf('%?')
      then = val.indexOf('%t')
      els = val.indexOf('%e')
      end = val.indexOf('%;')
      if (end === -1) end = Infinity
      if (then !== -1 && then < end &&
          (fi === -1 || then < fi) &&
          (els === -1 || then < els)) {
        stmt('} else if (')
      } else {
        stmt('} else {')
      }
      continue
    }

    if (read(/^%;/)) {
      end = null
      stmt('}')
      continue
    }

    buff += val[0]
    val = val.substring(1)
  }

  // Clear the buffer of any remaining text.
  clear()

  // Some terminfos (I'm looking at you, atari-color), don't end an if
  // statement. It's assumed terminfo will automatically end it for
  // them, because they are a bunch of lazy bastards.
  if (end != null) {
    stmt('}')
  }

  // Add the footer.
  stmt(footer)

  // Optimize and cleanup generated code.
  v = code.slice(header.length, -footer.length)
  if (!v.length) {
    code = 'return "";'
  } else if (v = /^out\.push\(("(?:[^"]|\\")+")\)$/.exec(v)) {
    code = 'return ' + v[1] + ';'
  } else {
    // Turn `(stack.push(v = params[0]), v),out.push(stack.pop())`
    // into `out.push(params[0])`.
    code = code.replace(
      /\(stack\.push\(v = params\[(\d+)\]\), v\),out\.push\(stack\.pop\(\)\)/g,
      'out.push(params[$1])')

    // Remove unnecessary variable initializations.
    v = code.slice(header.length, -footer.length)
    if (!~v.indexOf('v = ')) code = code.replace('v, ', '')
    if (!~v.indexOf('dyn')) code = code.replace('dyn = {}, ', '')
    if (!~v.indexOf('stat')) code = code.replace('stat = {}, ', '')
    if (!~v.indexOf('stack')) code = code.replace('stack = [], ', '')

    // Turn `var out = [];out.push("foo"),` into `var out = ["foo"];`.
    code = code.replace(
      /out = \[\];out\.push\(("(?:[^"]|\\")+")\),/,
      'out = [$1];')
  }

  // Terminfos `wyse350-vb`, and `wy350-w`
  // seem to have a few broken strings.
  if (str === '\u001b%?') {
    code = 'return "\\x1b";'
  }

  if (this.debug) {
    v = code
      .replace(/\x1b/g, '\\x1b')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
    process.stdout.write(v + '\n')
  }

  try {
    if (this.options.stringify && code.indexOf('return ') === 0) {
      return new Function('', code)()
    }
    return this.printf || ~code.indexOf('sprintf(')
      ? new Function('sprintf, params', code).bind(null, sprintf)
      : new Function('params', code)
  } catch (e) {
    console.error('')
    console.error('Error on %s:', tkey)
    console.error(JSON.stringify(str))
    console.error('')
    console.error(code.replace(/(,|;)/g, '$1\n'))
    e.stack = e.stack.replace(/\x1b/g, '\\x1b')
    throw e
  }
}

// See: ~/ncurses/ncurses/tinfo/lib_tputs.c
Tput.prototype._print = function (code, print, done) {
  var xon = !this.bools.needs_xon_xoff || this.bools.xon_xoff

  print = print || write
  done = done || noop

  if (!this.padding) {
    print(code)
    return done()
  }

  var parts = code.split(/(?=\$<[\d.]+[*\/]{0,2}>)/)
  var i = 0;

  (function next () {
    if (i === parts.length) {
      return done()
    }

    var part = parts[i++]
    var padding = /^\$<([\d.]+)([*\/]{0,2})>/.exec(part)
    var amount
    var suffix
    // , affect;

    if (!padding) {
      print(part)
      return next()
    }

    part = part.substring(padding[0].length)
    amount = +padding[1]
    suffix = padding[2]

    // A `/'  suffix indicates  that  the  padding  is  mandatory and forces a
    // delay of the given number of milliseconds even on devices for which xon
    // is present to indicate flow control.
    if (xon && !~suffix.indexOf('/')) {
      print(part)
      return next()
    }

    // A `*' indicates that the padding required is proportional to the number
    // of lines affected by the operation, and  the amount  given  is the
    // per-affected-unit padding required.  (In the case of insert character,
    // the factor is still the number of lines affected.) Normally, padding is
    // advisory if the device has the xon capability; it is used for cost
    // computation but does not trigger delays.
    if (~suffix.indexOf('*')) {
      // XXX Disable this for now.
      amount = amount
      // if (affect = /\x1b\[(\d+)[LM]/.exec(part)) {
      //   amount *= +affect[1];
      // }
      // The above is a huge workaround. In reality, we need to compile
      // `_print` into the string functions and check the cap name and
      // params.
      // if (cap === 'insert_line' || cap === 'delete_line') {
      //   amount *= params[0];
      // }
      // if (cap === 'clear_screen') {
      //   amount *= process.stdout.rows;
      // }
    }

    return setTimeout(function () {
      print(part)
      return next()
    }, amount)
  })()
}

// A small helper function if we want
// to easily output text with setTimeouts.
Tput.print = function () {
  var fake = {
    padding: true,
    bools: { needs_xon_xoff: true, xon_xoff: false }
  }
  return Tput.prototype._print.apply(fake, arguments)
}

/**
 * Termcap
 */

Tput.cpaths = []

Tput.prototype.readTermcap = function () {
  this.terminal = "xterm"

  return this._readTermcap(this.terminal)
};

Tput.prototype._tryCap = function (file, term) {
  if (!file) return

  var terms,
    data,
    i

  if (Array.isArray(file)) {
    for (i = 0; i < file.length; i++) {
      data = this._tryCap(file[i], term)
      if (data) return data
    }
    return
  }

  // If the termcap string starts with `/`,
  // ncurses considers it a filename.
  data = file[0] === '/'
    ? tryRead(file)
    : file

  if (!data) return

  terms = this.parseTermcap(data, file)

  if (term && !terms[term]) {
    return
  }

  return terms
}

/**
 * Termcap Parser
 *  http://en.wikipedia.org/wiki/Termcap
 *  http://www.gnu.org/software
 *    /termutils/manual/termcap-1.3/html_mono/termcap.html
 *  http://www.gnu.org/software
 *    /termutils/manual/termcap-1.3/html_mono/termcap.html#SEC17
 *  http://tldp.org/HOWTO/Text-Terminal-HOWTO.html#toc16
 *  man termcap
 */

// Example:
// vt102|dec vt102:\
//  :do=^J:co#80:li#24:cl=50\E[;H\E[2J:\
//  :le=^H:bs:cm=5\E[%i%d;%dH:nd=2\E[C:up=2\E[A:\
//  :ce=3\E[K:cd=50\E[J:so=2\E[7m:se=2\E[m:us=2\E[4m:ue=2\E[m:\
//  :md=2\E[1m:mr=2\E[7m:mb=2\E[5m:me=2\E[m:is=\E[1;24r\E[24;1H:\
//  :rs=\E>\E[?3l\E[?4l\E[?5l\E[?7h\E[?8h:ks=\E[?1h\E=:ke=\E[?1l\E>:\
//  :ku=\EOA:kd=\EOB:kr=\EOC:kl=\EOD:kb=^H:\
//  :ho=\E[H:k1=\EOP:k2=\EOQ:k3=\EOR:k4=\EOS:pt:sr=5\EM:vt#3:\
//  :sc=\E7:rc=\E8:cs=\E[%i%d;%dr:vs=\E[?7l:ve=\E[?7h:\
//  :mi:al=\E[L:dc=\E[P:dl=\E[M:ei=\E[4l:im=\E[4h:

Tput.prototype.parseTermcap = function (data, file) {
  var terms = {}
  var parts
  var term
  var entries
  var fields
  var field
  var names
  var i
  var j
  var k

  // remove escaped newlines
  data = data.replace(/\\\n[ \t]*/g, '')

  // remove comments
  data = data.replace(/^#[^\n]+/gm, '')

  // split entries
  entries = data.trim().split(/\n+/)

  for (i = 0; i < entries.length; i++) {
    fields = entries[i].split(/:+/)
    for (j = 0; j < fields.length; j++) {
      field = fields[j].trim()
      if (!field) continue

      if (j === 0) {
        names = field.split('|')
        term = {
          name: names[0],
          names: names,
          desc: names.pop(),
          file: ~file.indexOf(path.sep)
            ? path.resolve(file)
            : file,
          termcap: true
        }

        for (k = 0; k < names.length; k++) {
          terms[names[k]] = term
        }

        term.bools = {}
        term.numbers = {}
        term.strings = {}

        continue
      }

      if (~field.indexOf('=')) {
        parts = field.split('=')
        term.strings[parts[0]] = parts.slice(1).join('=')
      } else if (~field.indexOf('#')) {
        parts = field.split('#')
        term.numbers[parts[0]] = +parts.slice(1).join('#')
      } else {
        term.bools[field] = true
      }
    }
  }

  return terms
}

/**
 * Termcap Compiler
 *  man termcap
 */

Tput.prototype.translateTermcap = function (info) {
  var self = this
  var out = {}

  if (!info) return

  this._debug(info);

  ['name', 'names', 'desc', 'file', 'termcap'].forEach(function (key) {
    out[key] = info[key]
  })

  // Separate aliases for termcap
  var map = (function () {
    var out = {}

    Object.keys(Tput.alias).forEach(function (key) {
      var aliases = Tput.alias[key]
      out[aliases.termcap] = key
    })

    return out
  })();

  // Translate termcap cap names to terminfo cap names.
  // e.g. `up` -> `cursor_up`
  ['bools', 'numbers', 'strings'].forEach(function (key) {
    out[key] = {}
    Object.keys(info[key]).forEach(function (cap) {
      if (key === 'strings') {
        info.strings[cap] = self._captoinfo(cap, info.strings[cap], 1)
      }
      if (map[cap]) {
        out[key][map[cap]] = info[key][cap]
      } else {
        // NOTE: Possibly include all termcap names
        // in a separate alias.js file. Some are
        // missing from the terminfo alias.js file
        // which is why we have to do this:
        // See: $ man termcap
        out[key][cap] = info[key][cap]
      }
    })
  })

  return out
}

Tput.prototype.compileTermcap = function (term) {
  return this.compile(this.readTermcap(term))
}

Tput.prototype.injectTermcap = function (term) {
  return this.inject(this.compileTermcap(term))
}

/**
 * _nc_captoinfo - ported to javascript directly from ncurses.
 * Copyright (c) 1998-2009,2010 Free Software Foundation, Inc.
 * See: ~/ncurses/ncurses/tinfo/captoinfo.c
 *
 * Convert a termcap string to terminfo format.
 * 'cap' is the relevant terminfo capability index.
 * 's' is the string value of the capability.
 * 'parameterized' tells what type of translations to do:
 *    % translations if 1
 *    pad translations if >=0
 */

Tput.prototype._captoinfo = function (cap, s, parameterized) {
  var self = this

  var capstart

  if (parameterized == null) {
    parameterized = 0
  }

  var MAX_PUSHED = 16
  var stack = []

  var stackptr = 0
  var onstack = 0
  var seenm = 0
  var seenn = 0
  var seenr = 0
  var param = 1
  var i = 0
  var out = ''

  function warn () {
    var args = Array.prototype.slice.call(arguments)
    args[0] = 'captoinfo: ' + (args[0] || '')
    return self._debug.apply(self, args)
  }

  function isdigit (ch) {
    return ch >= '0' && ch <= '9'
  }

  function isgraph (ch) {
    return ch > ' ' && ch <= '~'
  }

  // convert a character to a terminfo push
  function cvtchar (sp) {
    var c = '\0'
    var len

    var j = i

    switch (sp[j]) {
      case '\\':
        switch (sp[++j]) {
          case '\'':
          case '$':
          case '\\':
          case '%':
            c = sp[j]
            len = 2
            break
          case '\0':
            c = '\\'
            len = 1
            break
          case '0':
          case '1':
          case '2':
          case '3':
            len = 1
            while (isdigit(sp[j])) {
              c = String.fromCharCode(8 * c.charCodeAt(0) +
                (sp[j++].charCodeAt(0) - '0'.charCodeAt(0)))
              len++
            }
            break
          default:
            c = sp[j]
            len = 2
            break
        }
        break
      case '^':
        c = String.fromCharCode(sp[++j].charCodeAt(0) & 0x1f)
        len = 2
        break
      default:
        c = sp[j]
        len = 1
    }
    if (isgraph(c) && c !== ',' && c !== '\'' && c !== '\\' && c !== ':') {
      out += '%\''
      out += c
      out += '\''
    } else {
      out += '%{'
      if (c.charCodeAt(0) > 99) {
        out += String.fromCharCode(
          (c.charCodeAt(0) / 100 | 0) + '0'.charCodeAt(0))
      }
      if (c.charCodeAt(0) > 9) {
        out += String.fromCharCode(
          (c.charCodeAt(0) / 10 | 0) % 10 + '0'.charCodeAt(0))
      }
      out += String.fromCharCode(
        c.charCodeAt(0) % 10 + '0'.charCodeAt(0))
      out += '}'
    }

    return len
  }

  // push n copies of param on the terminfo stack if not already there
  function getparm (parm, n) {
    if (seenr) {
      if (parm === 1) {
        parm = 2
      } else if (parm === 2) {
        parm = 1
      }
    }

    if (onstack === parm) {
      if (n > 1) {
        warn('string may not be optimal')
        out += '%Pa'
        while (n--) {
          out += '%ga'
        }
      }
      return
    }

    if (onstack !== 0) {
      push()
    }

    onstack = parm

    while (n--) {
      out += '%p'
      out += String.fromCharCode('0'.charCodeAt(0) + parm)
    }

    if (seenn && parm < 3) {
      out += '%{96}%^'
    }

    if (seenm && parm < 3) {
      out += '%{127}%^'
    }
  }

  // push onstack on to the stack
  function push () {
    if (stackptr >= MAX_PUSHED) {
      warn('string too complex to convert')
    } else {
      stack[stackptr++] = onstack
    }
  }

  // pop the top of the stack into onstack
  function pop () {
    if (stackptr === 0) {
      if (onstack === 0) {
        warn('I\'m confused')
      } else {
        onstack = 0
      }
    } else {
      onstack = stack[--stackptr]
    }
    param++
  }

  function see03 () {
    getparm(param, 1)
    out += '%3d'
    pop()
  }

  function invalid () {
    out += '%'
    i--
    warn('unknown %% code %s (%#x) in %s',
      JSON.stringify(s[i]), s[i].charCodeAt(0), cap)
  }

  // skip the initial padding (if we haven't been told not to)
  capstart = null
  if (s == null) s = ''

  if (parameterized >= 0 && isdigit(s[i])) {
    for (capstart = i; ; i++) {
      if (!(isdigit(s[i]) || s[i] === '*' || s[i] === '.')) {
        break
      }
    }
  }

  while (s[i]) {
    switch (s[i]) {
      case '%':
        i++
        if (parameterized < 1) {
          out += '%'
          break
        }
        switch (s[i++]) {
          case '%':
            out += '%'
            break
          case 'r':
            if (seenr++ === 1) {
              warn('saw %%r twice in %s', cap)
            }
            break
          case 'm':
            if (seenm++ === 1) {
              warn('saw %%m twice in %s', cap)
            }
            break
          case 'n':
            if (seenn++ === 1) {
              warn('saw %%n twice in %s', cap)
            }
            break
          case 'i':
            out += '%i'
            break
          case '6':
          case 'B':
            getparm(param, 1)
            out += '%{10}%/%{16}%*'
            getparm(param, 1)
            out += '%{10}%m%+'
            break
          case '8':
          case 'D':
            getparm(param, 2)
            out += '%{2}%*%-'
            break
          case '>':
            getparm(param, 2)
            // %?%{x}%>%t%{y}%+%;
            out += '%?'
            i += cvtchar(s)
            out += '%>%t'
            i += cvtchar(s)
            out += '%+%;'
            break
          case 'a':
            if ((s[i] === '=' || s[i] === '+' || s[i] === '-' ||
                s[i] === '*' || s[i] === '/') &&
                (s[i + 1] === 'p' || s[i + 1] === 'c') &&
                s[i + 2] !== '\0' && s[i + 2]) {
              var l
              l = 2
              if (s[i] !== '=') {
                getparm(param, 1)
              }
              if (s[i + 1] === 'p') {
                getparm(param + s[i + 2].charCodeAt(0) - '@'.charCodeAt(0), 1)
                if (param !== onstack) {
                  pop()
                  param--
                }
                l++
              } else {
                i += 2, l += cvtchar(s), i -= 2
              }
              switch (s[i]) {
                case '+':
                  out += '%+'
                  break
                case '-':
                  out += '%-'
                  break
                case '*':
                  out += '%*'
                  break
                case '/':
                  out += '%/'
                  break
                case '=':
                  if (seenr) {
                    if (param === 1) {
                      onstack = 2
                    } else if (param === 2) {
                      onstack = 1
                    } else {
                      onstack = param
                    }
                  } else {
                    onstack = param
                  }
                  break
              }
              i += l
              break
            }
            getparm(param, 1)
            i += cvtchar(s)
            out += '%+'
            break
          case '+':
            getparm(param, 1)
            i += cvtchar(s)
            out += '%+%c'
            pop()
            break
          case 's':
            // #ifdef WATERLOO
            //          i += cvtchar(s);
            //          getparm(param, 1);
            //          out += '%-';
            // #else
            getparm(param, 1)
            out += '%s'
            pop()
            // #endif /* WATERLOO */
            break
          case '-':
            i += cvtchar(s)
            getparm(param, 1)
            out += '%-%c'
            pop()
            break
          case '.':
            getparm(param, 1)
            out += '%c'
            pop()
            break
          case '0': // not clear any of the historical termcaps did this
            if (s[i] === '3') {
              see03() // goto
              break
            } else if (s[i] !== '2') {
              invalid() // goto
              break
            }
            // FALLTHRU
          case '2':
            getparm(param, 1)
            out += '%2d'
            pop()
            break
          case '3':
            see03()
            break
          case 'd':
            getparm(param, 1)
            out += '%d'
            pop()
            break
          case 'f':
            param++
            break
          case 'b':
            param--
            break
          case '\\':
            out += '%\\'
            break
          default:
            invalid()
            break
        }
        break
        // #ifdef REVISIBILIZE
        //    case '\\':
        //      out += s[i++];
        //      out += s[i++];
        //      break;
        //    case '\n':
        //      out += '\\n';
        //      i++;
        //      break;
        //    case '\t':
        //      out += '\\t';
        //      i++;
        //      break;
        //    case '\r':
        //      out += '\\r';
        //      i++;
        //      break;
        //    case '\200':
        //      out += '\\0';
        //      i++;
        //      break;
        //    case '\f':
        //      out += '\\f';
        //      i++;
        //      break;
        //    case '\b':
        //      out += '\\b';
        //      i++;
        //      break;
        //    case ' ':
        //      out += '\\s';
        //      i++;
        //      break;
        //    case '^':
        //      out += '\\^';
        //      i++;
        //      break;
        //    case ':':
        //      out += '\\:';
        //      i++;
        //      break;
        //    case ',':
        //      out += '\\,';
        //      i++;
        //      break;
        //    default:
        //      if (s[i] === '\033') {
        //        out += '\\E';
        //        i++;
        //      } else if (s[i].charCodeAt(0) > 0 && s[i].charCodeAt(0) < 32) {
        //        out += '^';
        //        out += String.fromCharCode(s[i].charCodeAt(0) + '@'.charCodeAt(0));
        //        i++;
        //      } else if (s[i].charCodeAt(0) <= 0 || s[i].charCodeAt(0) >= 127) {
        //        out += '\\';
        //        out += String.fromCharCode(
        //          ((s[i].charCodeAt(0) & 0300) >> 6) + '0'.charCodeAt(0));
        //        out += String.fromCharCode(
        //          ((s[i].charCodeAt(0) & 0070) >> 3) + '0'.charCodeAt(0));
        //        out += String.fromCharCode(
        //          (s[i].charCodeAt(0) & 0007) + '0'.charCodeAt(0));
        //        i++;
        //      } else {
        //        out += s[i++];
        //      }
        //      break;
        // #else
      default:
        out += s[i++]
        break
// #endif
    }
  }

  // Now, if we stripped off some leading padding, add it at the end
  // of the string as mandatory padding.
  if (capstart != null) {
    out += '$<'
    for (i = capstart; ; i++) {
      if (isdigit(s[i]) || s[i] === '*' || s[i] === '.') {
        out += s[i]
      } else {
        break
      }
    }
    out += '/>'
  }

  if (s !== out) {
    warn('Translating %s from %s to %s.',
      cap, JSON.stringify(s), JSON.stringify(out))
  }

  return out
}

/**
 * Compile All Terminfo
 */

Tput.prototype.getAll = function () {
  var dir = this._prefix()
  var list = asort(fs.readdirSync(dir))
  var infos = []

  list.forEach(function (letter) {
    var terms = asort(fs.readdirSync(path.resolve(dir, letter)))
    infos.push.apply(infos, terms)
  })

  function asort (obj) {
    return obj.sort(function (a, b) {
      a = a.toLowerCase().charCodeAt(0)
      b = b.toLowerCase().charCodeAt(0)
      return a - b
    })
  }

  return infos
}

Tput.prototype.compileAll = function (start) {
  var self = this
  var all = {}

  this.getAll().forEach(function (name) {
    if (start && name !== start) {
      return
    } else {
      start = null
    }
    all[name] = self.compileTerminfo(name)
  })

  return all
}

/**
 * Detect Features / Quirks
 */

Tput.prototype.detectFeatures = function (info) {
  var data = this.parseACS(info)
  info.features = {
    unicode: this.detectUnicode(info),
    brokenACS: this.detectBrokenACS(info),
    PCRomSet: this.detectPCRomSet(info),
    magicCookie: this.detectMagicCookie(info),
    padding: this.detectPadding(info),
    setbuf: this.detectSetbuf(info),
    acsc: data.acsc,
    acscr: data.acscr
  }
  return info.features
}

Tput.prototype.detectUnicode = function() {
  return true
}

// For some reason TERM=linux has smacs/rmacs, but it maps to `^[[11m`
// and it does not switch to the DEC SCLD character set. What the hell?
// xterm: \x1b(0, screen: \x0e, linux: \x1b[11m (doesn't work)
// `man console_codes` says:
// 11  select null mapping, set display control flag, reset tog‐
//     gle meta flag (ECMA-48 says "first alternate font").
// See ncurses:
// ~/ncurses/ncurses/base/lib_set_term.c
// ~/ncurses/ncurses/tinfo/lib_acs.c
// ~/ncurses/ncurses/tinfo/tinfo_driver.c
// ~/ncurses/ncurses/tinfo/lib_setup.c
Tput.prototype.detectBrokenACS = function (info) {
  // ncurses-compatible env variable.
  if (process.env.NCURSES_NO_UTF8_ACS != null) {
    return !!+process.env.NCURSES_NO_UTF8_ACS
  }

  // If the terminal supports unicode, we don't need ACS.
  if (info.numbers.U8 >= 0) {
    return !!info.numbers.U8
  }

  // The linux console is just broken for some reason.
  // Apparently the Linux console does not support ACS,
  // but it does support the PC ROM character set.
  if (info.name === 'linux') {
    return true
  }

  // PC alternate charset
  // if (acsc.indexOf('+\x10,\x11-\x18.\x190') === 0) {
  if (this.detectPCRomSet(info)) {
    return true
  }

  // screen termcap is bugged?
  if (this.termcap &&
      info.name.indexOf('screen') === 0 &&
      process.env.TERMCAP &&
      ~process.env.TERMCAP.indexOf('screen') &&
      ~process.env.TERMCAP.indexOf('hhII00')) {
    if (~info.strings.enter_alt_charset_mode.indexOf('\x0e') ||
        ~info.strings.enter_alt_charset_mode.indexOf('\x0f') ||
        ~info.strings.set_attributes.indexOf('\x0e') ||
        ~info.strings.set_attributes.indexOf('\x0f')) {
      return true
    }
  }

  return false
}

// If enter_pc_charset is the same as enter_alt_charset,
// the terminal does not support SCLD as ACS.
// See: ~/ncurses/ncurses/tinfo/lib_acs.c
Tput.prototype.detectPCRomSet = function (info) {
  var s = info.strings
  if (s.enter_pc_charset_mode && s.enter_alt_charset_mode &&
      s.enter_pc_charset_mode === s.enter_alt_charset_mode &&
      s.exit_pc_charset_mode === s.exit_alt_charset_mode) {
    return true
  }
  return false
}

Tput.prototype.detectMagicCookie = function () {
  return process.env.NCURSES_NO_MAGIC_COOKIE == null
}

Tput.prototype.detectPadding = function () {
  return process.env.NCURSES_NO_PADDING == null
}

Tput.prototype.detectSetbuf = function () {
  return process.env.NCURSES_NO_SETBUF == null
}

Tput.prototype.parseACS = function (info) {
  var data = {}

  data.acsc = {}
  data.acscr = {}

  // Possibly just return an empty object, as done here, instead of
  // specifically saying ACS is "broken" above. This would be more
  // accurate to ncurses logic. But it doesn't really matter.
  if (this.detectPCRomSet(info)) {
    return data
  }

  // See: ~/ncurses/ncurses/tinfo/lib_acs.c: L208
  Object.keys(Tput.acsc).forEach(function (ch) {
    var acs_chars = info.strings.acs_chars || ''
    var i = acs_chars.indexOf(ch)
    var next = acs_chars[i + 1]

    if (!next || i === -1 || !Tput.acsc[next]) {
      return
    }

    data.acsc[ch] = Tput.acsc[next]
    data.acscr[Tput.acsc[next]] = ch
  })

  return data
}

Tput.prototype.GetConsoleCP = function () {
  var ccp

  if (process.platform !== 'win32') {
    return -1
  }

  // Allow unicode on all windows consoles for now:
  if (+process.env.NCURSES_NO_WINDOWS_UNICODE !== 1) {
    return 65001
  }

  // cp.execSync('chcp 65001', { stdio: 'ignore', timeout: 1500 });

  try {
    // Produces something like: 'Active code page: 437\n\n'
    ccp = cp.execFileSync(process.env.WINDIR + '\\system32\\chcp.com', [], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'ascii',
      timeout: 1500
    })
    // ccp = cp.execSync('chcp', {
    //   stdio: ['ignore', 'pipe', 'ignore'],
    //   encoding: 'ascii',
    //   timeout: 1500
    // });
  } catch (e) {
    ;
  }

  ccp = /\d+/.exec(ccp)

  if (!ccp) {
    return -1
  }

  ccp = +ccp[0]

  return ccp
}

/**
 * Helpers
 */

function noop () {
  return ''
}

noop.unsupported = true

function merge (a, b) {
  Object.keys(b).forEach(function (key) {
    a[key] = b[key]
  })
  return a
}

function write (data) {
  return process.stdout.write(data)
}

function tryRead (file) {
  if (Array.isArray(file)) {
    for (var i = 0; i < file.length; i++) {
      var data = tryRead(file[i])
      if (data) return data
    }
    return ''
  }
  if (!file) return ''
  file = path.resolve.apply(path, arguments)
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    return ''
  }
}

/**
 * sprintf
 *  http://www.cplusplus.com/reference/cstdio/printf/
 */

function sprintf (src) {
  var params = Array.prototype.slice.call(arguments, 1)
  var rule = /%([\-+# ]{1,4})?(\d+(?:\.\d+)?)?([doxXsc])/g
  var i = 0

  return src.replace(rule, function (_, flag, width, type) {
    var flags = (flag || '').split('')
    var param = params[i] != null ? params[i] : ''
    var initial = param
    // , width = +width
    var opt = {}
    var pre = ''

    i++

    switch (type) {
      case 'd': // signed int
        param = (+param).toString(10)
        break
      case 'o': // unsigned octal
        param = (+param).toString(8)
        break
      case 'x': // unsigned hex int
        param = (+param).toString(16)
        break
      case 'X': // unsigned hex int uppercase
        param = (+param).toString(16).toUppercase()
        break
      case 's': // string
        break
      case 'c': // char
        param = isFinite(param)
          ? String.fromCharCode(param || 0x80)
          : ''
        break
    }

    flags.forEach(function (flag) {
      switch (flag) {
        // left-justify by width
        case '-':
          opt.left = true
          break
        // always precede numbers with their signs
        case '+':
          opt.signs = true
          break
        // used with o, x, X - value is preceded with 0, 0x, or 0X respectively.
        // used with a, A, e, E, f, F, g, G - forces written output to contain
        // a decimal point even if no more digits follow
        case '#':
          opt.hexpoint = true
          break
        // if no sign is going to be written, black space in front of the value
        case ' ':
          opt.space = true
          break
      }
    })

    width = +width.split('.')[0]

    // Should this be for opt.left too?
    // Example: %2.2X - turns 0 into 00
    if (width && !opt.left) {
      param = param + ''
      while (param.length < width) {
        param = '0' + param
      }
    }

    if (opt.signs) {
      if (+initial >= 0) {
        pre += '+'
      }
    }

    if (opt.space) {
      if (!opt.signs && +initial >= 0) {
        pre += ' '
      }
    }

    if (opt.hexpoint) {
      switch (type) {
        case 'o': // unsigned octal
          pre += '0'
          break
        case 'x': // unsigned hex int
          pre += '0x'
          break
        case 'X': // unsigned hex int uppercase
          pre += '0X'
          break
      }
    }

    if (opt.left) {
      if (width > (pre.length + param.length)) {
        width -= pre.length + param.length
        pre = Array(width + 1).join(' ') + pre
      }
    }

    return pre + param
  })
}

/**
 * Aliases
 */

Tput._alias = require('./alias')

Tput.alias = {};

['bools', 'numbers', 'strings'].forEach(function (type) {
  Object.keys(Tput._alias[type]).forEach(function (key) {
    var aliases = Tput._alias[type][key]
    Tput.alias[key] = [aliases[0]]
    Tput.alias[key].terminfo = aliases[0]
    Tput.alias[key].termcap = aliases[1]
  })
})

// Bools
Tput.alias.no_esc_ctlc.push('beehive_glitch')
Tput.alias.dest_tabs_magic_smso.push('teleray_glitch')

// Numbers
Tput.alias.micro_col_size.push('micro_char_size')

/**
 * Feature Checking
 */

Tput.aliasMap = {}

Object.keys(Tput.alias).forEach(function (key) {
  Tput.aliasMap[key] = key
  Tput.alias[key].forEach(function (k) {
    Tput.aliasMap[k] = key
  })
})

Tput.prototype.has = function (name) {
  name = Tput.aliasMap[name]

  var val = this.all[name]

  if (!name) return false

  if (typeof val === 'number') {
    return val !== -1
  }

  return !!val
}

/**
 * Fallback Termcap Entry
 */

Tput.termcap = "# $XTermId: termcap,v 1.80 2012/06/10 14:30:37 tom Exp $\n#\n# These are termcap entries that correspond to xterm's terminfo file.\n# The file is formatted using ncurses' \"tic -CNx\", but is not mechanically\n# derived from the terminfo.\n#\n#------------------------------------------------------------------------------\n# Copyright 1996-2011,2012 by Thomas E. Dickey\n#\n#                         All Rights Reserved\n#\n# Permission is hereby granted, free of charge, to any person obtaining a\n# copy of this software and associated documentation files (the\n# \"Software\"), to deal in the Software without restriction, including\n# without limitation the rights to use, copy, modify, merge, publish,\n# distribute, sublicense, and/or sell copies of the Software, and to\n# permit persons to whom the Software is furnished to do so, subject to\n# the following conditions:\n#\n# The above copyright notice and this permission notice shall be included\n# in all copies or substantial portions of the Software.\n#\n# THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n# IN NO EVENT SHALL THE ABOVE LISTED COPYRIGHT HOLDER(S) BE LIABLE FOR ANY\n# CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,\n# TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE\n# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n#\n# Except as contained in this notice, the name(s) of the above copyright\n# holders shall not be used in advertising or otherwise to promote the\n# sale, use or other dealings in this Software without prior written\n# authorization.\n#------------------------------------------------------------------------------\n#\n# Note:\n#\ttermcap format is limited to 1023 characters.  This set of descriptions\n#\tis a subset of the terminfo, since not all features can be fit into\n#\tthat limit.  The 'xterm' description supports color.  The monochrome\n#\t'xterm-mono' drops color in favor of additional function keys.  If you\n#\tneed both, use terminfo.\n#\n#\tThe 1023-character limit applies to each entry after resolving the\n#\t\"tc=\" strings.  Some implementations may discount all or part of the\n#\tformatting characters in the entry (i.e., the backslash newline tab\n#\tcolon).  GNU termcap does not have this limit.\n#\n#\tI checked the limits using ncurses \"captoinfo -CrTUvx\", which prints\n#\tthe resolved length of each entry in a comment at the end - T.Dickey\n#\nxf|xterm-new|modern xterm:\\\n\t:*6=\\EOF:@7=\\EOF:F1=\\E[23~:F2=\\E[24~:K2=\\EOE:Km=\\E[M:\\\n\t:k1=\\EOP:k2=\\EOQ:k3=\\EOR:k4=\\EOS:k5=\\E[15~:k6=\\E[17~:\\\n\t:k7=\\E[18~:k8=\\E[19~:k9=\\E[20~:k;=\\E[21~:kB=\\E[Z:kH=\\EOF:\\\n\t:kI=\\E[2~:kN=\\E[6~:kP=\\E[5~:kd=\\EOB:kh=\\EOH:kl=\\EOD:\\\n\t:kr=\\EOC:ku=\\EOA:tc=xterm-basic:\n#\n# This chunk is used for building the VT220/Sun/PC keyboard variants.\nxb|xterm-basic|modern xterm common:\\\n\t:am:bs:km:mi:ms:ut:xn:AX:\\\n\t:Co#8:co#80:kn#12:li#24:pa#64:\\\n\t:AB=\\E[4%dm:AF=\\E[3%dm:AL=\\E[%dL:DC=\\E[%dP:DL=\\E[%dM:\\\n\t:DO=\\E[%dB:LE=\\E[%dD:RI=\\E[%dC:UP=\\E[%dA:ae=\\E(B:al=\\E[L:\\\n\t:as=\\E(0:bl=^G:cd=\\E[J:ce=\\E[K:cl=\\E[H\\E[2J:\\\n\t:cm=\\E[%i%d;%dH:cs=\\E[%i%d;%dr:ct=\\E[3g:dc=\\E[P:dl=\\E[M:\\\n\t:ei=\\E[4l:ho=\\E[H:im=\\E[4h:is=\\E[!p\\E[?3;4l\\E[4l\\E>:\\\n\t:kD=\\E[3~:ke=\\E[?1l\\E>:ks=\\E[?1h\\E=:le=^H:md=\\E[1m:\\\n\t:me=\\E[m:ml=\\El:mr=\\E[7m:mu=\\Em:nd=\\E[C:op=\\E[39;49m:\\\n\t:rc=\\E8:rs=\\E[!p\\E[?3;4l\\E[4l\\E>:sc=\\E7:se=\\E[27m:sf=^J:\\\n\t:so=\\E[7m:sr=\\EM:st=\\EH:te=\\E[?1049l:ti=\\E[?1049h:\\\n\t:ue=\\E[24m:up=\\E[A:us=\\E[4m:ve=\\E[?12l\\E[?25h:vi=\\E[?25l:\\\n\t:vs=\\E[?12;25h:tc=xterm+kbs:\n\n# The xterm-new description has all of the features, but is not completely\n# compatible with vt220.  If you are using a Sun or PC keyboard, set the\n# sunKeyboard resource to true:\n#\t+ maps the editing keypad\n#\t+ interprets control-function-key as a second array of keys, so a\n#\t  12-fkey keyboard can support vt220's 20-fkeys.\n#\t+ maps numeric keypad \"+\" to \",\".\n#\t+ uses DEC-style control sequences for the application keypad.\n#\nvt|xterm-vt220|xterm emulating vt220:\\\n\t:*6=\\E[4~:@7=\\E[4~:K2=\\EOu:Km=\\E[M:kB=\\E[Z:kH=\\E[4~:\\\n\t:kh=\\E[1~:tc=xterm-basic:\n\nv1|xterm-24|xterms|vs100|24x80 xterm:\\\n\t:li#24:tc=xterm-old:\nv2|xterm-65|65x80 xterm:\\\n\t:li#65:tc=xterm-old:\nvb|xterm-bold|xterm with bold for underline:\\\n\t:so=\\E[7m:us=\\E[1m:tc=xterm-old:\nvB|xterm-boldso|xterm with bold for standout:\\\n\t:se=\\E[m:so=\\E[1m:tc=xterm-old:\nvm|xterm-mono|monochrome xterm:\\\n\t:ut@:\\\n\t:Co@:NC@:kn#20:pa@:\\\n\t:AB@:AF@:Sb@:Sf@:op@:st@:tc=xterm-old:\n#\n# Alternate terminal description that \"works\" for interactive shells such as\n# tcsh and bash.\nxn|xterm-noapp|xterm with cursor keys in normal mode:\\\n\t:kd=\\E[B:ke=\\E>:kl=\\E[D:kr=\\E[C:ks=\\E=:ku=\\E[A:te@:ti@:\\\n\t:tc=xterm:\n#\n# This should work for the commonly used \"color xterm\" variations (XFree86\n# xterm, color_xterm, nxterm, rxvt).  Note that it does not set 'bce', so for\n# XFree86 and rxvt, some applications that use colors will be less efficient,\n# and in a few special cases (with \"smart\" optimization) the wrong color will\n# be painted in spots.\nvc|xterm-color|generic \"ANSI\" color xterm:\\\n\t:Co#8:NC@:pa#64:\\\n\t:AB=\\E[4%dm:AF=\\E[3%dm:ac=:op=\\E[m:tc=xterm-r6:\n#\n# These aliases are for compatibility with the terminfo; termcap cannot provide\n# the extra features such as color initialization, but termcap applications\n# still want the names.\nx1|xterm-16color|xterm alias:\\\n\t:tc=xterm-new:\n\nx2|xterm-88color|xterm alias:\\\n\t:Co#88:pa#7744:tc=xterm-256color:\n\nx3|xterm-256color|xterm alias:\\\n\t:Co#256:pa#32767:\\\n\t:AB=\\E[48;5;%dm:AF=\\E[38;5;%dm:tc=xterm-new:\n\nxi|xterm-nrc|xterm alias:\\\n\t:tc=xterm:\nxr|xterm-rep|xterm alias:\\\n\t:tc=xterm:\nxx|xterm-xmc|xterm alias:\\\n\t:sg#1:tc=xterm:\n#\n# An 8-bit description is doable with termcap, but there are probably no\n# termcap (or BSD curses) applications that are able to use it.\nx8|xterm-8bit|xterm terminal emulator 8-bit controls (X Window System):\\\n\t:am:km:mi:ms:xn:\\\n\t:co#80:it#8:li#24:\\\n\t:AL=\\233%dL:DC=\\233%dP:DL=\\233%dM:DO=\\233%dB:IC=\\233%d@:\\\n\t:K2=\\217y:Km=\\233M:LE=\\233%dD:RI=\\233%dC:UP=\\233%dA:\\\n\t:ae=\\E(B:al=\\233L:as=\\E(0:bl=^G:bt=\\233Z:cd=\\233J:ce=\\233K:\\\n\t:cl=\\233H\\2332J:cm=\\233%i%d;%dH:cr=^M:cs=\\233%i%d;%dr:\\\n\t:ct=\\2333g:dc=\\233P:dl=\\233M:do=^J:ei=\\2334l:ho=\\233H:\\\n\t:im=\\2334h:\\\n\t:is=\\E[62\"p\\E G\\233m\\233?7h\\E>\\E7\\233?1;3;4;6l\\2334l\\233r\\E8:\\\n\t:k1=\\23311~:k2=\\23312~:k3=\\23313~:k4=\\23314~:k5=\\23315~:\\\n\t:k6=\\23317~:k7=\\23318~:k8=\\23319~:k9=\\23320~:kD=\\2333~:\\\n\t:kI=\\2332~:kN=\\2336~:kP=\\2335~:kd=\\217B:ke=\\233?1l\\E>:\\\n\t:kh=\\2331~:kl=\\217D:kr=\\217C:ks=\\233?1h\\E=:ku=\\217A:le=^H:\\\n\t:mb=\\2335m:md=\\2331m:me=\\233m:mr=\\2337m:nd=\\233C:rc=\\E8:\\\n\t:sc=\\E7:se=\\23327m:sf=^J:so=\\2337m:sr=\\215:st=\\210:ta=^I:\\\n\t:te=\\233?1049l:ti=\\233?1049h:ue=\\23324m:up=\\233A:\\\n\t:us=\\2334m:vb=\\233?5h\\233?5l:ve=\\233?25l\\233?25h:\\\n\t:vi=\\233?25l:vs=\\233?12;25h:tc=xterm+kbs:\n#\nhp|xterm-hp|xterm with hpterm function keys:\\\n\t:@7=\\EF:k1=\\Ep:k2=\\Eq:k3=\\Er:k4=\\Es:k5=\\Et:k6=\\Eu:k7=\\Ev:\\\n\t:k8=\\Ew:kC=\\EJ:kD=\\EP:kI=\\EQ:kN=\\ES:kP=\\ET:kd=\\EB:kh=\\Eh:\\\n\t:kl=\\ED:kr=\\EC:ku=\\EA:tc=xterm-basic:\n#\nxS|xterm-sco|xterm with SCO function keys:\\\n\t:@7=\\E[F:F1=\\E[W:F2=\\E[X:F3=\\E[Y:F5=\\E[a:F6=\\E[b:F7=\\E[c:\\\n\t:F8=\\E[d:F9=\\E[e:FA=\\E[f:FB=\\E[g:FC=\\E[h:FD=\\E[i:FE=\\E[j:\\\n\t:FF=\\E[k:ac=:k1=\\E[M:k2=\\E[N:k3=\\E[O:k4=\\E[P:k5=\\E[Q:\\\n\t:k6=\\E[R:k7=\\E[S:k8=\\E[T:k9=\\E[U:k;=\\E[V:kD=\\177:kI=\\E[L:\\\n\t:kN=\\E[G:kP=\\E[I:kd=\\E[B:kh=\\E[H:kl=\\E[D:kr=\\E[C:ku=\\E[A:\\\n\t:tc=xterm-basic:\n#\nv5|xterm-vt52|xterm emulating vt52:\\\n\t:bs:\\\n\t:co#80:it#8:li#24:\\\n\t:ae=\\EG:as=\\EF:bl=^G:cd=\\EJ:ce=\\EK:cl=\\EH\\EJ:cm=\\EY%+ %+ :\\\n\t:cr=^M:do=\\EB:ho=\\EH:kd=\\EB:kl=\\ED:kr=\\EC:ku=\\EA:le=\\ED:\\\n\t:nd=\\EC:nw=^M^J:sf=^J:sr=\\EI:ta=^I:up=\\EA:tc=xterm+kbs:\n#\nxs|xterm-sun|xterm with Sun functionkeys:\\\n\t:%1=\\E[196z:&8=\\E[195z:@0=\\E[200z:@5=\\E[197z:@7=\\E[220z:\\\n\t:F1=\\E[192z:F2=\\E[193z:K2=\\E[218z:Km=\\E[M:k1=\\E[224z:\\\n\t:k2=\\E[225z:k3=\\E[226z:k4=\\E[227z:k5=\\E[228z:k6=\\E[229z:\\\n\t:k7=\\E[230z:k8=\\E[231z:k9=\\E[232z:k;=\\E[233z:kD=\\E[3z:\\\n\t:kI=\\E[2z:kN=\\E[222z:kP=\\E[216z:kh=\\E[214z:\\\n\t:tc=xterm-basic:\n#\n# vi may work better with this entry, because vi doesn't use insert mode much.\n# |xterm-ic|xterm-vi|xterm with insert character instead of insert mode:\\\nvi|xterm-ic|xterm-vi|xterm with insert char:\\\n\t:mi@:\\\n\t:IC=\\E[%d@:ei@:ic=\\E[@:im@:tc=xterm:\n#\n# Compatible with the X11R6.3 xterm\nr6|xterm-r6|xterm-old|X11R6 xterm:\\\n\t:am:bs:km:mi:ms:pt:xn:\\\n\t:co#80:kn#20:li#24:\\\n\t:*6=\\E[4~:@0=\\E[1~:@7=\\E[4~:AL=\\E[%dL:DC=\\E[%dP:DL=\\E[%dM:\\\n\t:DO=\\E[%dB:F1=\\E[23~:F2=\\E[24~:F3=\\E[25~:F4=\\E[26~:\\\n\t:F5=\\E[28~:F6=\\E[29~:F7=\\E[31~:F8=\\E[32~:F9=\\E[33~:\\\n\t:FA=\\E[34~:LE=\\E[%dD:RI=\\E[%dC:UP=\\E[%dA:ae=^O:al=\\E[L:\\\n\t:as=^N:bl=^G:cd=\\E[J:ce=\\E[K:cl=\\E[H\\E[2J:cm=\\E[%i%d;%dH:\\\n\t:cs=\\E[%i%d;%dr:ct=\\E[3g:dc=\\E[P:dl=\\E[M:eA=\\E)0:ei=\\E[4l:\\\n\t:ho=\\E[H:im=\\E[4h:\\\n\t:is=\\E[m\\E[?7h\\E[4l\\E>\\E7\\E[r\\E[?1;3;4;6l\\E8:\\\n\t:k1=\\E[11~:k2=\\E[12~:k3=\\E[13~:k4=\\E[14~:k5=\\E[15~:\\\n\t:k6=\\E[17~:k7=\\E[18~:k8=\\E[19~:k9=\\E[20~:k;=\\E[21~:\\\n\t:kD=\\E[3~:kI=\\E[2~:kN=\\E[6~:kP=\\E[5~:kd=\\EOB:ke=\\E[?1l\\E>:\\\n\t:kh=\\E[1~:kl=\\EOD:kr=\\EOC:ks=\\E[?1h\\E=:ku=\\EOA:md=\\E[1m:\\\n\t:me=\\E[m:ml=\\El:mr=\\E[7m:mu=\\Em:nd=\\E[C:rc=\\E8:\\\n\t:rs=\\E[m\\E[?7h\\E[4l\\E>\\E7\\E[r\\E[?1;3;4;6l\\E8:sc=\\E7:\\\n\t:se=\\E[m:sf=^J:so=\\E[7m:sr=\\EM:te=\\E[2J\\E[?47l\\E8:\\\n\t:ti=\\E7\\E[?47h:ue=\\E[m:up=\\E[A:us=\\E[4m:tc=xterm+kbs:\n#\n# Compatible with the R5 xterm\nr5|xterm-r5|X11R5 xterm X11R5:\\\n\t:am:bs:km:mi:ms:pt:xn:\\\n\t:co#80:kn#4:li#24:\\\n\t:@7=\\E[4~:AL=\\E[%dL:DC=\\E[%dP:DL=\\E[%dM:DO=\\E[%dB:\\\n\t:IC=\\E[%d@:UP=\\E[%dA:al=\\E[L:cd=\\E[J:ce=\\E[K:cl=\\E[H\\E[2J:\\\n\t:cm=\\E[%i%d;%dH:cs=\\E[%i%d;%dr:ct=\\E[3g:dc=\\E[P:dl=\\E[M:\\\n\t:ei=\\E[4l:ho=\\E[H:im=\\E[4h:\\\n\t:is=\\E[r\\E[m\\E[2J\\E[H\\E[?7h\\E[?1;3;4;6l\\E[4l:\\\n\t:k1=\\E[11~:k2=\\E[12~:k3=\\E[13~:k4=\\E[14~:kd=\\EOB:\\\n\t:ke=\\E[?1l\\E>:kh=\\E[1~:kl=\\EOD:kr=\\EOC:ks=\\E[?1h\\E=:\\\n\t:ku=\\EOA:md=\\E[1m:me=\\E[m:mr=\\E[7m:nd=\\E[C:rc=\\E8:\\\n\t:rs=\\E>\\E[?1;3;4;5;6l\\E[4l\\E[?7h\\E[m\\E[r\\E[2J\\E[H:\\\n\t:sc=\\E7:se=\\E[m:sf=^J:so=\\E[7m:sr=\\EM:te=\\E[2J\\E[?47l\\E8:\\\n\t:ti=\\E7\\E[?47h:ue=\\E[m:up=\\E[A:us=\\E[4m:tc=xterm+kbs:\n#\n# Customization begins here.\nx0|xterm-xfree86|xterm terminal emulator (XFree86):\\\n\t:tc=xterm-new:\n#\n# This is the only entry which you should have to customize, since \"xterm\"\n# is widely used for a variety of incompatible terminal emulations including\n# color_xterm and rxvt.\nv0|xterm|X11 terminal emulator:\\\n\t:tc=xterm-new:\n#\t:tc=xterm-r6:\n\n# This fragment is for people who cannot agree on what the backspace key\n# should send.\nxterm+kbs|fragment for backspace key:\\\n\t:kb=^H:\n";


/**
 * Terminfo Data
 */

Tput.bools = [
  'auto_left_margin',
  'auto_right_margin',
  'no_esc_ctlc',
  'ceol_standout_glitch',
  'eat_newline_glitch',
  'erase_overstrike',
  'generic_type',
  'hard_copy',
  'has_meta_key',
  'has_status_line',
  'insert_null_glitch',
  'memory_above',
  'memory_below',
  'move_insert_mode',
  'move_standout_mode',
  'over_strike',
  'status_line_esc_ok',
  'dest_tabs_magic_smso',
  'tilde_glitch',
  'transparent_underline',
  'xon_xoff',
  'needs_xon_xoff',
  'prtr_silent',
  'hard_cursor',
  'non_rev_rmcup',
  'no_pad_char',
  'non_dest_scroll_region',
  'can_change',
  'back_color_erase',
  'hue_lightness_saturation',
  'col_addr_glitch',
  'cr_cancels_micro_mode',
  'has_print_wheel',
  'row_addr_glitch',
  'semi_auto_right_margin',
  'cpi_changes_res',
  'lpi_changes_res',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'backspaces_with_bs',
  'crt_no_scrolling',
  'no_correctly_working_cr',
  'gnu_has_meta_key',
  'linefeed_is_newline',
  'has_hardware_tabs',
  'return_does_clr_eol'
]

Tput.numbers = [
  'columns',
  'init_tabs',
  'lines',
  'lines_of_memory',
  'magic_cookie_glitch',
  'padding_baud_rate',
  'virtual_terminal',
  'width_status_line',
  'num_labels',
  'label_height',
  'label_width',
  'max_attributes',
  'maximum_windows',
  'max_colors',
  'max_pairs',
  'no_color_video',
  'buffer_capacity',
  'dot_vert_spacing',
  'dot_horz_spacing',
  'max_micro_address',
  'max_micro_jump',
  'micro_col_size',
  'micro_line_size',
  'number_of_pins',
  'output_res_char',
  'output_res_line',
  'output_res_horz_inch',
  'output_res_vert_inch',
  'print_rate',
  'wide_char_size',
  'buttons',
  'bit_image_entwining',
  'bit_image_type',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'magic_cookie_glitch_ul',
  'carriage_return_delay',
  'new_line_delay',
  'backspace_delay',
  'horizontal_tab_delay',
  'number_of_function_keys'
]

Tput.strings = [
  'back_tab',
  'bell',
  'carriage_return',
  'change_scroll_region',
  'clear_all_tabs',
  'clear_screen',
  'clr_eol',
  'clr_eos',
  'column_address',
  'command_character',
  'cursor_address',
  'cursor_down',
  'cursor_home',
  'cursor_invisible',
  'cursor_left',
  'cursor_mem_address',
  'cursor_normal',
  'cursor_right',
  'cursor_to_ll',
  'cursor_up',
  'cursor_visible',
  'delete_character',
  'delete_line',
  'dis_status_line',
  'down_half_line',
  'enter_alt_charset_mode',
  'enter_blink_mode',
  'enter_bold_mode',
  'enter_ca_mode',
  'enter_delete_mode',
  'enter_dim_mode',
  'enter_insert_mode',
  'enter_secure_mode',
  'enter_protected_mode',
  'enter_reverse_mode',
  'enter_standout_mode',
  'enter_underline_mode',
  'erase_chars',
  'exit_alt_charset_mode',
  'exit_attribute_mode',
  'exit_ca_mode',
  'exit_delete_mode',
  'exit_insert_mode',
  'exit_standout_mode',
  'exit_underline_mode',
  'flash_screen',
  'form_feed',
  'from_status_line',
  'init_1string',
  'init_2string',
  'init_3string',
  'init_file',
  'insert_character',
  'insert_line',
  'insert_padding',
  'key_backspace',
  'key_catab',
  'key_clear',
  'key_ctab',
  'key_dc',
  'key_dl',
  'key_down',
  'key_eic',
  'key_eol',
  'key_eos',
  'key_f0',
  'key_f1',
  'key_f10',
  'key_f2',
  'key_f3',
  'key_f4',
  'key_f5',
  'key_f6',
  'key_f7',
  'key_f8',
  'key_f9',
  'key_home',
  'key_ic',
  'key_il',
  'key_left',
  'key_ll',
  'key_npage',
  'key_ppage',
  'key_right',
  'key_sf',
  'key_sr',
  'key_stab',
  'key_up',
  'keypad_local',
  'keypad_xmit',
  'lab_f0',
  'lab_f1',
  'lab_f10',
  'lab_f2',
  'lab_f3',
  'lab_f4',
  'lab_f5',
  'lab_f6',
  'lab_f7',
  'lab_f8',
  'lab_f9',
  'meta_off',
  'meta_on',
  'newline',
  'pad_char',
  'parm_dch',
  'parm_delete_line',
  'parm_down_cursor',
  'parm_ich',
  'parm_index',
  'parm_insert_line',
  'parm_left_cursor',
  'parm_right_cursor',
  'parm_rindex',
  'parm_up_cursor',
  'pkey_key',
  'pkey_local',
  'pkey_xmit',
  'print_screen',
  'prtr_off',
  'prtr_on',
  'repeat_char',
  'reset_1string',
  'reset_2string',
  'reset_3string',
  'reset_file',
  'restore_cursor',
  'row_address',
  'save_cursor',
  'scroll_forward',
  'scroll_reverse',
  'set_attributes',
  'set_tab',
  'set_window',
  'tab',
  'to_status_line',
  'underline_char',
  'up_half_line',
  'init_prog',
  'key_a1',
  'key_a3',
  'key_b2',
  'key_c1',
  'key_c3',
  'prtr_non',
  'char_padding',
  'acs_chars',
  'plab_norm',
  'key_btab',
  'enter_xon_mode',
  'exit_xon_mode',
  'enter_am_mode',
  'exit_am_mode',
  'xon_character',
  'xoff_character',
  'ena_acs',
  'label_on',
  'label_off',
  'key_beg',
  'key_cancel',
  'key_close',
  'key_command',
  'key_copy',
  'key_create',
  'key_end',
  'key_enter',
  'key_exit',
  'key_find',
  'key_help',
  'key_mark',
  'key_message',
  'key_move',
  'key_next',
  'key_open',
  'key_options',
  'key_previous',
  'key_print',
  'key_redo',
  'key_reference',
  'key_refresh',
  'key_replace',
  'key_restart',
  'key_resume',
  'key_save',
  'key_suspend',
  'key_undo',
  'key_sbeg',
  'key_scancel',
  'key_scommand',
  'key_scopy',
  'key_screate',
  'key_sdc',
  'key_sdl',
  'key_select',
  'key_send',
  'key_seol',
  'key_sexit',
  'key_sfind',
  'key_shelp',
  'key_shome',
  'key_sic',
  'key_sleft',
  'key_smessage',
  'key_smove',
  'key_snext',
  'key_soptions',
  'key_sprevious',
  'key_sprint',
  'key_sredo',
  'key_sreplace',
  'key_sright',
  'key_srsume',
  'key_ssave',
  'key_ssuspend',
  'key_sundo',
  'req_for_input',
  'key_f11',
  'key_f12',
  'key_f13',
  'key_f14',
  'key_f15',
  'key_f16',
  'key_f17',
  'key_f18',
  'key_f19',
  'key_f20',
  'key_f21',
  'key_f22',
  'key_f23',
  'key_f24',
  'key_f25',
  'key_f26',
  'key_f27',
  'key_f28',
  'key_f29',
  'key_f30',
  'key_f31',
  'key_f32',
  'key_f33',
  'key_f34',
  'key_f35',
  'key_f36',
  'key_f37',
  'key_f38',
  'key_f39',
  'key_f40',
  'key_f41',
  'key_f42',
  'key_f43',
  'key_f44',
  'key_f45',
  'key_f46',
  'key_f47',
  'key_f48',
  'key_f49',
  'key_f50',
  'key_f51',
  'key_f52',
  'key_f53',
  'key_f54',
  'key_f55',
  'key_f56',
  'key_f57',
  'key_f58',
  'key_f59',
  'key_f60',
  'key_f61',
  'key_f62',
  'key_f63',
  'clr_bol',
  'clear_margins',
  'set_left_margin',
  'set_right_margin',
  'label_format',
  'set_clock',
  'display_clock',
  'remove_clock',
  'create_window',
  'goto_window',
  'hangup',
  'dial_phone',
  'quick_dial',
  'tone',
  'pulse',
  'flash_hook',
  'fixed_pause',
  'wait_tone',
  'user0',
  'user1',
  'user2',
  'user3',
  'user4',
  'user5',
  'user6',
  'user7',
  'user8',
  'user9',
  'orig_pair',
  'orig_colors',
  'initialize_color',
  'initialize_pair',
  'set_color_pair',
  'set_foreground',
  'set_background',
  'change_char_pitch',
  'change_line_pitch',
  'change_res_horz',
  'change_res_vert',
  'define_char',
  'enter_doublewide_mode',
  'enter_draft_quality',
  'enter_italics_mode',
  'enter_leftward_mode',
  'enter_micro_mode',
  'enter_near_letter_quality',
  'enter_normal_quality',
  'enter_shadow_mode',
  'enter_subscript_mode',
  'enter_superscript_mode',
  'enter_upward_mode',
  'exit_doublewide_mode',
  'exit_italics_mode',
  'exit_leftward_mode',
  'exit_micro_mode',
  'exit_shadow_mode',
  'exit_subscript_mode',
  'exit_superscript_mode',
  'exit_upward_mode',
  'micro_column_address',
  'micro_down',
  'micro_left',
  'micro_right',
  'micro_row_address',
  'micro_up',
  'order_of_pins',
  'parm_down_micro',
  'parm_left_micro',
  'parm_right_micro',
  'parm_up_micro',
  'select_char_set',
  'set_bottom_margin',
  'set_bottom_margin_parm',
  'set_left_margin_parm',
  'set_right_margin_parm',
  'set_top_margin',
  'set_top_margin_parm',
  'start_bit_image',
  'start_char_set_def',
  'stop_bit_image',
  'stop_char_set_def',
  'subscript_characters',
  'superscript_characters',
  'these_cause_cr',
  'zero_motion',
  'char_set_names',
  'key_mouse',
  'mouse_info',
  'req_mouse_pos',
  'get_mouse',
  'set_a_foreground',
  'set_a_background',
  'pkey_plab',
  'device_type',
  'code_set_init',
  'set0_des_seq',
  'set1_des_seq',
  'set2_des_seq',
  'set3_des_seq',
  'set_lr_margin',
  'set_tb_margin',
  'bit_image_repeat',
  'bit_image_newline',
  'bit_image_carriage_return',
  'color_names',
  'define_bit_image_region',
  'end_bit_image_region',
  'set_color_band',
  'set_page_length',
  'display_pc_char',
  'enter_pc_charset_mode',
  'exit_pc_charset_mode',
  'enter_scancode_mode',
  'exit_scancode_mode',
  'pc_term_options',
  'scancode_escape',
  'alt_scancode_esc',
  'enter_horizontal_hl_mode',
  'enter_left_hl_mode',
  'enter_low_hl_mode',
  'enter_right_hl_mode',
  'enter_top_hl_mode',
  'enter_vertical_hl_mode',
  'set_a_attributes',
  'set_pglen_inch',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'termcap_init2',
  'termcap_reset',
  'linefeed_if_not_lf',
  'backspace_if_not_bs',
  'other_non_function_keys',
  'arrow_key_map',
  'acs_ulcorner',
  'acs_llcorner',
  'acs_urcorner',
  'acs_lrcorner',
  'acs_ltee',
  'acs_rtee',
  'acs_btee',
  'acs_ttee',
  'acs_hline',
  'acs_vline',
  'acs_plus',
  'memory_lock',
  'memory_unlock',
  'box_chars_1'
]

// DEC Special Character and Line Drawing Set.
// Taken from tty.js.
Tput.acsc = { // (0
  '`': '\u25c6', // '◆'
  a: '\u2592', // '▒'
  b: '\u0009', // '\t'
  c: '\u000c', // '\f'
  d: '\u000d', // '\r'
  e: '\u000a', // '\n'
  f: '\u00b0', // '°'
  g: '\u00b1', // '±'
  h: '\u2424', // '\u2424' (NL)
  i: '\u000b', // '\v'
  j: '\u2518', // '┘'
  k: '\u2510', // '┐'
  l: '\u250c', // '┌'
  m: '\u2514', // '└'
  n: '\u253c', // '┼'
  o: '\u23ba', // '⎺'
  p: '\u23bb', // '⎻'
  q: '\u2500', // '─'
  r: '\u23bc', // '⎼'
  s: '\u23bd', // '⎽'
  t: '\u251c', // '├'
  u: '\u2524', // '┤'
  v: '\u2534', // '┴'
  w: '\u252c', // '┬'
  x: '\u2502', // '│'
  y: '\u2264', // '≤'
  z: '\u2265', // '≥'
  '{': '\u03c0', // 'π'
  '|': '\u2260', // '≠'
  '}': '\u00a3', // '£'
  '~': '\u00b7' // '·'
}

// Convert ACS unicode characters to the
// most similar-looking ascii characters.
Tput.utoa = Tput.prototype.utoa = {
  '\u25c6': '*', // '◆'
  '\u2592': ' ', // '▒'
  // '\u0009': '\t', // '\t'
  // '\u000c': '\f', // '\f'
  // '\u000d': '\r', // '\r'
  // '\u000a': '\n', // '\n'
  '\u00b0': '*', // '°'
  '\u00b1': '+', // '±'
  '\u2424': '\n', // '\u2424' (NL)
  // '\u000b': '\v', // '\v'
  '\u2518': '+', // '┘'
  '\u2510': '+', // '┐'
  '\u250c': '+', // '┌'
  '\u2514': '+', // '└'
  '\u253c': '+', // '┼'
  '\u23ba': '-', // '⎺'
  '\u23bb': '-', // '⎻'
  '\u2500': '-', // '─'
  '\u23bc': '-', // '⎼'
  '\u23bd': '_', // '⎽'
  '\u251c': '+', // '├'
  '\u2524': '+', // '┤'
  '\u2534': '+', // '┴'
  '\u252c': '+', // '┬'
  '\u2502': '|', // '│'
  '\u2264': '<', // '≤'
  '\u2265': '>', // '≥'
  π: '?', // 'π'
  '\u2260': '=', // '≠'
  '\u00a3': '?', // '£'
  '\u00b7': '*' // '·'
}

Tput.prototype._readTermcap = Tput.prototype.readTermcap;

/**
 * Expose
 */

exports = Tput
exports.sprintf = sprintf
exports.tryRead = tryRead

module.exports = exports
