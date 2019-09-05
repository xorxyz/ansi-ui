# Example

This will render a box with line borders containing the text `'Hello world!'`, perfectly centered horizontally and vertically.

> __NOTE__: It is recommend you use either `smartCSR` or `fastCSR` as a
`ui.screen` option. This will enable CSR when scrolling text in elements
or when manipulating lines.

```js
var ui = require('ansi-ui')

// Create a screen object.
var screen = ui.screen({
  smartCSR: true
})

screen.title = 'My window title'

// Create a box perfectly centered horizontally and vertically.
var box = ui.box({
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  content: 'Hello {bold}world{/bold}!',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'magenta',
    border: {
      fg: '#f0f0f0'
    },
    hover: {
      bg: 'green'
    }
  }
})

// Append our box to the screen.
screen.append(box)

// If our box is clicked, change the content.
box.on('click', data => {
  box.setContent('{center}Some more {red-fg}content{/red-fg}.{/center}')
  screen.render()
})

// If box is focused, handle `enter`/`return` and give us some more content.
box.key('enter', (char, key) => {
  box.setContent('{right}Even different {black-fg}content{/black-fg}.{/right}\n')
  box.setLine(1, 'bar')
  box.insertLine(1, 'foo')
  screen.render()
})

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], (char, key) => {
  return process.exit(0)
})

// Focus our element.
box.focus()

// Render the screen.
screen.render()

```
