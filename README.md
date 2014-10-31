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
| `axis` | undefined | Restrict movement by axis:  |
| `autoscroll` | true | Autoscroll the container on raching it’s edge |
| `ghost` | false | Drag element’s clone instead |
| `hideCursor` | false | Hide cursor while drag |
| `pin` | `[0,0, selfWidth, selfHeight]` | Restrict movement by the pin area rectangle |
| `precision` | 1 | To what extend round position, pixels |
| `velocity` | 1000 | Velocity on release |
| `release` | false | Continue movement on release drag |
| `threshold` | 10 | A minimal movement distance required to start drag |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd |
| `sniperSpeed` | `0.15` | Slowing down ratio for the sniper mode |
| `within` | _parent element_ | Restrict movement within the container |


## Events

| Name | Description |
|---|---|
| `dragstart` | Called when drag starts |
| `drag` | Called on each drag |
| `release` | Called user released drag |
| `dragend` | Called when drag finishes |

