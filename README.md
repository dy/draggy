<h1>
	<img src="https://cdn.rawgit.com/dfcreative/draggy/design/logo.png"/><br/>

	Draggy

	<a href="https://travis-ci.org/dfcreative/draggy"><img src="https://travis-ci.org/dfcreative/draggy.svg?branch=master"/></a>
	<img src="https://david-dm.org/dfcreative/draggy.svg"/>
	<a href="http://unlicense.org/UNLICENSE"><img src="http://upload.wikimedia.org/wikipedia/commons/6/62/PD-icon.svg" width="20"/></a>
</h1>

A draggable behavior provider for any element.


# Use

You have to use [browserify](https://github.com/substack/node-browserify), [component](https://github.com/componentjs/component), [duo](http://duojs.org/), [webmake](https://github.com/medikoo/modules-webmake) or alike to use draggy.

`$ npm install draggy`


```js
var Draggy = require('draggy');

//make an element draggable
var el = document.querySelector('.my-element');
var draggy = new Draggy(el, {
	//options
	release: true,
	sniper: false,
	axis: 'x'
});

draggy.on('drag', function(){

});
```


# Options

| Parameter | Default | Description |
|---|:---:|---|
| `axis` | `undefined` | Restrict movement by axis: `'x'`, `'y'` or `null`  |
| `autoscroll` | `true` | Autoscroll the container on raching it’s edge, if it’s scrollable |
| `ghost` | `false` | Drag element’s clone instead (requested) |
| `hideCursor` | `false` | Hide cursor while drag |
| `pin` | `[0,0, selfWidth, selfHeight]` | Define rigid area for movement limits |
| `precision` | `1` | Round position to that extent, in pixels |
| `velocity` | `1000` | Velocity on release |
| `release` | `false` | Continue movement on drag release |
| `threshold` | `10` | A movement distance required to start drag |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd |
| `sniperSpeed` | `0.15` | Slowing down ratio for the sniper mode |
| `within` | _parent element_ | Restrict movement within the container |


# Events

| Name | Description |
|---|---|
| `dragstart` | Drag start |
| `drag` | Drag iteration |
| `release` | User released drag |
| `dragend` | Drag finished, called after release (stopped) |


# Contribute

There are not many to do, though

[![NPM](https://nodei.co/npm/draggy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/draggy/)