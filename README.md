<h1>
	<img src="https://cdn.rawgit.com/dfcreative/draggy/design/logo.png"/><br/>

	Draggy

	<a href="https://travis-ci.org/dfcreative/draggy"><img src="https://travis-ci.org/dfcreative/draggy.svg?branch=master"/></a>
	<a href="/license"><img src="https://img.shields.io/npm/l/draggy.svg"/></a>
	<img src="https://david-dm.org/dfcreative/draggy.svg"/>
</h1>


Simple draggable.


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
| `axis` | `undefined` | Restrict movement by axis: `'x'`, `'y'` or `null`  |
| `ghost` | `false` | Drag element’s clone instead. |
| `hideCursor` | `false` | Hide cursor while drag. Useful for color pickers. |
| `pin` | `[0,0, selfWidth, selfHeight]` | An area within draggable element which is surely resides within movement limits. Useful if you need draggable element to be restricted not by it’s own shape, but by some inner shape. |
| `precision` | `1` | Round position to that extent, in pixels. |
| `placingType` | `translate3d` | Define placing type: via css `position` or `translate3d`. The first is more precise and reliable, the second is faster. |
| `release` | `false` | Continue movement when user releases drag. |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd. |
| `sniperKey` | `[a, b]` | Key codes to use to slow down drag. |
| `sniperSpeed` | `0.15` | Slowing down ratio for the sniper mode. |
| `threshold` | `10` | A movement threshold required to start drag. |
| `velocity` | `1000` | Velocity on release. |
| `within` | `document` | Restrict movement within the container. |


## Events

| Name | Description |
|---|---|
| `dragstart` | Drag start |
| `drag` | Drag iteration |
| `dragrelease` | User released drag |
| `dragend` | Drag finished, called after release (stopped) |



[![NPM](https://nodei.co/npm/draggy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/draggy/)