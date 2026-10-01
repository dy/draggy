# Draggy

A tiny, dependency-free draggable for the web. Draggy gives an element pointer-native movement, constraints, handles, thresholds, inertia, and drop targets without imposing a component system.

[Demo](https://dy.github.io/draggy/) · [npm](https://www.npmjs.com/package/draggy) · [Issues](https://github.com/dy/draggy/issues)

## Install

```sh
npm install draggy
```

```js
import Draggable from 'draggy'

const drag = new Draggable(document.querySelector('.card'), {
  within: 'parent',
  threshold: 4,
  handle: '.card-handle'
})

drag.on('drag', function () {
  console.log(this.movementX, this.movementY)
})
```

Draggy uses Pointer Events, so the same setup works with mouse, touch, and pen input.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `axis` | `null` | Restrict movement to `'x'` or `'y'`. |
| `within` | viewport | Constrain movement to an element; use `'parent'` for the parent. |
| `handle` | target | Element, selector, or iterable that starts dragging. |
| `cancel` | `null` | Elements that must not start a drag. |
| `threshold` | `0` | Distance before dragging starts; accepts a number or 2/4-value array. |
| `precision` | `1` | Position rounding step in pixels; use `0` for no rounding. |
| `pin` | target bounds | Portion of the target kept inside `within`. |
| `repeat` | `false` | Wrap at bounds: `true`, `'both'`, `'x'`, or `'y'`. |
| `release` | `false` | Continue briefly after release using measured pointer velocity. |
| `sniper` | `true` | Move precisely while Ctrl or Command is held. |
| `droppable` | `null` | Drop-target selector, element, or iterable. |
| `droppableTolerance` | `0.5` | Required overlap, from `0` to `1`. |
| `droppableClass` | `null` | Class applied to the active drop target. |
| `css3` | `true` | Use transforms; `false` uses positioned `left` and `top`. |

## API

### Methods

- `on(name, listener)` / `off(name, listener)` — manage controller events.
- `move(x, y)` — move to a constrained position.
- `getCoords()` / `setCoords(x, y)` — read or write coordinates directly.
- `drag(pointerEvent)` — feed pointer movement programmatically.
- `update()` — refresh handles, dimensions, and constraints after layout changes.
- `configure(options)` — update options on an existing controller.
- `destroy()` — remove listeners and release the element.

Creating another `Draggable` for the same element returns and reconfigures its existing controller.

### Events

`idle`, `threshold`, `dragstart`, `drag`, `release`, `track`, `dragend`, `dragover`, `dragout`, and `drop` are emitted on the controller. They are also dispatched as DOM `CustomEvent`s from the draggable element. Drop targets receive `dragover`, `dragout`, and `drop`.

```js
drag.on('drop', target => {
  target.append(drag.element)
})
```

The controller exposes `prevX`, `prevY`, `deltaX`, `deltaY`, `movementX`, `movementY`, `speed`, `angle`, and modifier-key state for interface logic.

## Development

```sh
npm test       # Node's built-in test runner
npm run build  # generate the minified ESM build
npm run check  # both
```

## License

MIT
