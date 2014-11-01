# Draggy

A very simple draggable behavior provider. Just makes any element draggable.
Can be used within web-components.


## Use

You have to use [browserify](https://github.com/substack/node-browserify), [component](https://github.com/componentjs/component), [duo](http://duojs.org/), [webmake](https://github.com/medikoo/modules-webmake) or any other browser `require` provider in order to use draggy.

`$ npm install draggy`


```
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


## Options

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


## Events

| Name | Description |
|---|---|
| `dragstart` | Drag start |
| `drag` | Drag iteration |
| `release` | User released drag |
| `dragend` | Drag finished, called after release (stopped) |


---


Unlicensed