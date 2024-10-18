<h1>
<img src="https://cdn.rawgit.com/dy/draggy/design/logo.png"/>

Draggy

<a href="/license"><img src="https://img.shields.io/npm/l/draggy.svg"/></a>
</h1>


Make any element draggable. [Demo](https://dy.github.io/draggy).


[![npm install draggy](https://nodei.co/npm/draggy.png?mini=true)](https://npmjs.org/package/draggy)

```js
import Draggable from 'draggy';

//make an element draggable
var el = document.querySelector('.my-element');
var draggy = new Draggable(el, {
	release: true,
	sniper: false,
	axis: 'x'
});

//bind event handler
draggy.on('drag', function () {
	// ...
});
```


## Options

| Parameter | Default | Description |
|---|:---:|---|
| `axis` | `null` | Restrict movement by axis: `'x'`, `'y'` or `null`. |
| `pin` | `[0,0, selfWidth, selfHeight]` | Defines a smaller area within the draggable element that stays within movement limits. Useful to restrict movement based on an inner shape rather than the full element. |
| `precision` | `1` | Round position to that extent, in pixels. |
| `css3` | `true` | Use `position` vs `translate3d` to place element. The first is more precise and reliable, the second is faster. |
| `release` | `false` | Continue movement when user releases drag. |
| `repeat` | `false` | Loop movement by one of axis: `'x'`, `'y'` or `'both'`. |
| `sniper` | `true` | Slow down movement by pressing Ctrl/Cmd. |
| `threshold` | `0` | A movement threshold required to start drag - whether an array, number or function. |
| `within` | `document` | Restrict movement within the container. Pass `'parent'` to use parent node. |
| `handle` | `self.element` | Use element or selector as a handle for drag. Clicking outside the handle is ignored. |
| `cancel` | `undefined` | Ignore dragging started on the elements matching the selector. |
| `droppable` | `undefined` | Selector, element or list of elements to detect droppable areas. For each drop element will be invoked `drop`, `dragover` and `dragout` events. |


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



## What draggy is not

* It doesn’t do ghost move, as it is not draggable behavior and can be implemented externally.
* It doesn’t do mouse hiding on drag, as it can be done via callbacks.
* It doesn’t init itself automatically - it's up to you to decide when to create/init draggable.
* It doesn’t polyfill native draggable, as it targets to complete simple task of visual placement of element.

## Alternatives

* [interactjs](https://www.npmjs.com/package/interactjs)
* [@shopify/draggable](https://www.npmjs.com/package/@shopify/draggable)
* [draggabilly](https://www.npmjs.com/package/draggabilly)

## License

MIT
