# Draggy

Makes element draggable.


## Use

`$ npm install draggy`

You’re going to need to browserify in order to use draggy.

```
var draggy = require('draggy');


//create a new element
var el1 = new Draggy();
document.body.appendChild(el1);


//make other element draggy
var el2 = new Draggy(document.querySelector('.target'));


//pass an options
var el2 = new Draggy({
	release: true,
	sniper: false
});
document.body.appendChild(el3);
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

