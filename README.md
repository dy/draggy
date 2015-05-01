<h1>
	<img src="https://cdn.rawgit.com/dfcreative/draggy/design/logo.png"/><br/>

	Draggy

	<a href="https://travis-ci.org/dfcreative/draggy"><img src="https://travis-ci.org/dfcreative/draggy.svg?branch=master"/></a>
	<a href="/license"><img src="https://img.shields.io/npm/l/draggy.svg"/></a>
	<img src="https://david-dm.org/dfcreative/draggy.svg"/>
</h1>


Simple draggable. [Tests](TODO).


## Use

`$ npm install draggy`

```js
var Draggable = require('draggy');

//make an element draggable
var el = document.querySelector('.my-element');
var draggy = new Draggable(el, {
	release: true,
	sniper: false,
	axis: 'x'
});

//bind event handler
draggy.on('drag', function () {

});
```


## Options

| Parameter | Default | Description |
|---|:---:|---|
| `axis` | `undefined` | Restrict movement by axis: `'x'`, `'y'` or `null`. |
| `ghost` | `false` | Drag element’s clone instead. |
| `hideCursor` | `false` | Hide cursor while drag. Useful for color pickers. |
| `pin` | `[0,0, selfWidth, selfHeight]` | An area within draggable element which is surely resides within movement limits. Useful if you need draggable element to be restricted not by it’s own shape, but by some inner shape. |
| `precision` | `1` | Round position to that extent, in pixels. |
| `css3` | `true` | Use `position` or `translate3d` to place element. The first is more precise and reliable, the second is faster. |
| `release` | `false` | Continue movement when user releases drag. |
| `releaseDuration` | `500` | Duration of release. |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd. |
| `sniperKey` | `[a, b]` | Key codes to use to slow down drag. |
| `sniperSpeed` | `0.15` | Slowing down ratio for the sniper mode. |
| `threshold` | `0` | A movement threshold required to start drag - whether array, number or function. |
| `velocity` | `1000` | Velocity on release. |
| `within` | `document` | Restrict movement within the container. Pass `'parent'` to take parent node. |


## Events

| Name | Description |
|---|---|
| `dragstart` | Drag start |
| `threshold` | Enter threshold mode |
| `drag` | Drag iteration |
| `release` | User released drag |
| `dragend` | Drag finished, called after release (stopped) |


## API

| Name | Description |
|---|---|
| `Draggy.cache` | WeakMap containing draggy instances for elements.  |
| `Draggy.prototype.getCoords()` | Get current raw translation coordinates. |
| `Draggy.prototype.setCoords(x, y)` | Set current raw translation coordinates. `0,0` - initial position with no drag. |
| `Draggy.prototype.move(x, y)` | Move to a new position, taking into account axis. |
| `Draggy.prototype.state` | Current drag state: `'idle'`, `'threshold'`, `'drag'`, `'release'` |
| `Draggy.prototype.startDrag(event?)` | Start drag programmatically at the point given in the `event`. |
| `Draggy.prototype.update(event?)` | Update movement limits. `event` is optional. |


[![NPM](https://nodei.co/npm/draggy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/draggy/)