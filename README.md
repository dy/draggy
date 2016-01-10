<h1>
	<img src="https://cdn.rawgit.com/dfcreative/draggy/design/logo.png"/><br/>

	Draggy

	<a href="/license"><img src="https://img.shields.io/npm/l/draggy.svg"/></a>
	<img src="https://david-dm.org/dfcreative/draggy.svg"/>
</h1>


Draggable behaviour for elements. [Demo](https://dfcreative.github.io/draggy).


[![npm install draggy](https://nodei.co/npm/draggy.png?mini=true)](https://npmjs.org/package/draggy)

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
| `axis` | `null` | Restrict movement by axis: `'x'`, `'y'` or `null`. |
| `pin` | `[0,0, selfWidth, selfHeight]` | An area within draggable element which is surely resides within movement limits. Useful if you need draggable element to be restricted not by it’s own shape, but by some inner shape. |
| `precision` | `1` | Round position to that extent, in pixels. |
| `css3` | `true` | Use `position` or `translate3d` to place element. The first is more precise and reliable, the second is faster. |
| `release` | `false` | Continue movement when user releases drag. |
| `repeat` | `false` | Cycle movement by one of axis: `'x'`, `'y'` or `'both'`. |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd. |
| `threshold` | `0` | A movement threshold required to start drag - whether array, number or function. |
| `within` | `document` | Restrict movement within the container. Pass `'parent'` to take parent node. |
| `handle` | `self.element` | Use the passed element or selector as a handle for drag. Clicking not on the handle will be ignored. Passing null will ignore handle. |
| `cancel` | `undefined` | Ignore dragging started on the elements matching the selector. |
| `droppable` | `undefined` | Selector, element or list of elements to detect droppable areas. For each drop element will be invoked `drop, `dragover` and `dragout` events. |


## Events

| Name | Description |
|---|---|
| `dragstart` | Drag started. Called both on element/controller. |
| `threshold` | Entered threshold mode. Called on controller. |
| `drag` | Drag iteration. Called both on element/controller. |
| `track` | Track movement. Called on controller. |
| `release` | User released drag. Called on controller. |
| `dragend` | Drag has completely finished. Called both on element/controller. |
| `dragover` |  Called on self and on drop target. |
| `dragout` |  Called on self and on drop target. |
| `drop` |  Called on self and on drop target. |


## API

| Name | Description |
|---|---|
| `Draggy.cache` | WeakMap containing draggy instances for elements. `Draggy.cache.get(element)` - return draggy instance for the element. |
| `Draggy.prototype.move(x, y)` | Move to a new position, taking into account axis and limits. You can redefine this method to implement custom kinds of movement restrictions, like circular movement. But who dares? |
| `Draggy.prototype.state` | Current drag state: `'idle'`, `'threshold'`, `'drag'`, `'release'`. |
| `Draggy.prototype.update(event?)` | Update movement limits. `event` is optional. |



## What draggy is not

* It doesn’t do ghost move, as it is not draggable behaviour and can be implemented externally.
* It doesn’t do mouse hiding on drag, as it is implementable externally via callbacks.
* It doesn’t init itself automatically on elements as it is due to user to decide when to create/init draggable elements.
* It doesn’t polyfill native draggable, as it targets to complete simple task of visual placement of element.