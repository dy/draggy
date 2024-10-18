import css from 'mucss/css';
import parseCSSValue from 'mucss/parse-value';
import selection from 'mucss/selection';
import offsets from 'mucss/offset';
import getTranslate from 'mucss/translate';
import isFixed from 'mucss/is-fixed';

import { on, off, emit } from 'emmy';
import { x as getClientX, y as getClientY } from 'get-client-xy';

import defineState from 'define-state';


const win = window, doc = document, root = doc.documentElement;

/** Current number of draggable touches */
let touches = 0;

/**
 * Make an element draggable.
 *
 * @constructor
 *
 * @param {HTMLElement} target An element whether in/out of DOM
 * @param {Object} options An draggable options
 *
 * @return {HTMLElement} Target element
 */
class Draggable {
	/**
	 * Draggable instances associated with elements.
	 *
	 * Storing them on elements is
	 * - leak-prone,
	 * - pollutes element’s namespace,
	 * - requires some artificial key to store,
	 * - unable to retrieve controller easily.
	 *
	 * That is why weakmap.
	 */
	static cache = new WeakMap;


	//enable css3 by default
	css3 = true;

	//both axes by default
	axis = null;


	constructor(target, options) {
		//ignore existing instance
		var instance = Draggable.cache.get(target);
		if (instance) {
			instance.state = 'reset';

			//take over options
			Object.assign(instance, options);

			instance.update();

			return instance;
		}

		else {
			//get unique id for instance
			//needed to track event binders
			this.id = Math.random().toString(36).substring(2, 15)
			this._ns = '.draggy_' + this.id;

			//save element passed
			this.element = target;

			Draggable.cache.set(target, this);
		}

		//define state behaviour
		defineState(this, 'state', Draggable.state);

		//preset handles
		this.currentHandles = [];

		//take over options
		Object.assign(this, options);

		//define handle
		if (this.handle === undefined) {
			this.handle = this.element;
		}

		//setup droppable
		if (this.droppable) {
			on(this, 'dragstart', () => {
				this.dropTargets = q(this.droppable);
			});

			on(this, 'drag', () => {
				if (!this.dropTargets) {
					return;
				}

				var rect = offsets(this.element);

				this.dropTargets.forEach((dropTarget) => {
					var targetRect = offsets(dropTarget);

					if (intersect(rect, targetRect, this.droppableTolerance)) {
						if (this.droppableClass) {
							dropTarget.classList.add(this.droppableClass);
						}
						if (!this.dropTarget) {
							this.dropTarget = dropTarget;

							emit(this, 'dragover', dropTarget);
							emit(dropTarget, 'dragover', this);
						}
					}
					else {
						if (this.dropTarget) {
							emit(this, 'dragout', dropTarget);
							emit(dropTarget, 'dragout', this);

							this.dropTarget = null;
						}
						if (this.droppableClass) {
							dropTarget.classList.remove(this.droppableClass);
						}
					}
				});
			});

			on(this, 'dragend', () => {
				//emit drop, if any
				if (this.dropTarget) {
					emit(this.dropTarget, 'drop', this);
					emit(this, 'drop', this.dropTarget);
					this.dropTarget.classList.remove(this.droppableClass);
					this.dropTarget = null;
				}
			});
		}

		//try to calc out basic limits
		this.update();

		//go to initial state
		this.state = 'idle';
	}

	// Emitter API
	on(eventName, callback) {
		return on(this, eventName, callback);
	}

	off(eventName, callback) {
		return off(this, eventName, callback);
	}

	// draggable states
	static state = {
		//idle
		_: {
			before: function () {
				this.element.classList.add('draggy-idle');

				//emit drag evts on element
				emit(this.element, 'idle', null, true);
				emit(this, 'idle');

				//reset keys
				this.ctrlKey = false;
				this.shiftKey = false;
				this.metaKey = false;
				this.altKey = false;

				//reset movement params
				this.movementX = 0;
				this.movementY = 0;
				this.deltaX = 0;
				this.deltaY = 0;

				on(doc, 'mousedown' + this._ns + ' touchstart' + this._ns, (e) => {
					//ignore non-draggy events
					if (!e.draggies) {
						return;
					}

					//ignore dragstart for not registered draggies
					if (e.draggies.indexOf(this) < 0) {
						return;
					}

					//if target is focused - ignore drag
					//FIXME: detect focused by whitelist of tags, name supposition may be wrong (idk, form elements have names, so likely to be focused by click)
					if (e.target.name !== undefined) {
						return;
					}

					//multitouch has multiple starts
					this.setTouch(e);

					//update movement params
					this.update(e);

					//go to threshold state
					this.state = 'threshold';
				});
			},
			after: function () {
				this.element.classList.remove('draggy-idle');

				off(doc, this._ns);

				//set up tracking
				if (this.release) {
					this._trackingInterval = setInterval((e) => {
						var now = Date.now();
						var elapsed = now - this.timestamp;

						//get delta movement since the last track
						var dX = this.prevX - this.frame[0];
						var dY = this.prevY - this.frame[1];
						this.frame[0] = this.prevX;
						this.frame[1] = this.prevY;

						var delta = Math.sqrt(dX * dX + dY * dY);

						//get speed as average of prev and current (prevent div by zero)
						var v = Math.min(this.velocity * delta / (1 + elapsed), this.maxSpeed);
						this.speed = 0.8 * v + 0.2 * this.speed;

						//get new angle as a last diff
						//NOTE: vector average isn’t the same as speed scalar average
						this.angle = Math.atan2(dY, dX);

						emit(this, 'track');

						return this;
					}, this.framerate);
				}
			}
		},

		threshold: {
			before: function () {
				//ignore threshold state, if threshold is none
				if (isZeroArray(this.threshold)) {
					this.state = 'drag';
					return;
				}

				this.element.classList.add('draggy-threshold');

				//emit drag evts on element
				emit(this, 'threshold');
				emit(this.element, 'threshold');

				//listen to doc movement
				on(doc, 'touchmove' + this._ns + ' mousemove' + this._ns, (e) => {
					e.preventDefault();

					//compare movement to the threshold
					var clientX = getClientX(e, this.touchIdx);
					var clientY = getClientY(e, this.touchIdx);
					var difX = this.prevMouseX - clientX;
					var difY = this.prevMouseY - clientY;

					if (difX < this.threshold[0] || difX > this.threshold[2] || difY < this.threshold[1] || difY > this.threshold[3]) {
						this.update(e);
						this.state = 'drag';
					}
				});
				on(doc, 'mouseup' + this._ns + ' touchend' + this._ns + '', (e) => {
					e.preventDefault();

					//forget touches
					this.resetTouch();

					this.state = 'idle';
				});
			},

			after: function () {
				this.element.classList.remove('draggy-threshold');
				off(doc, this._ns);
			}
		},

		drag: {
			before: function () {
				//reduce dragging clutter
				selection.disable(root);

				this.element.classList.add('draggy-drag');

				//emit drag evts on element
				emit(this, 'dragstart');
				emit(this.element, 'dragstart', null, true);

				//emit drag events on this
				emit(this, 'drag');
				emit(this.element, 'drag', null, true);

				//stop drag on leave
				on(doc, 'touchend' + this._ns + ' mouseup' + this._ns + ' mouseleave' + this._ns, (e) => {
					e.preventDefault();

					//forget touches - dragend is called once
					this.resetTouch();

					//manage release movement
					if (this.speed > 1) {
						this.state = 'release';
					}

					else {
						this.state = 'idle';
					}
				});

				//move via transform
				on(doc, 'touchmove' + this._ns + ' mousemove' + this._ns, (e) => {
					this.drag(e);
				});
			},

			after: function () {
				//enable document interactivity
				selection.enable(root);

				this.element.classList.remove('draggy-drag');

				//emit dragend on element, this
				emit(this, 'dragend');
				emit(this.element, 'dragend', null, true);

				//unbind drag events
				off(doc, this._ns);

				clearInterval(this._trackingInterval);
			}
		},

		release: {
			before: function () {
				this.element.classList.add('draggy-release');

				//enter animation mode
				clearTimeout(this._animateTimeout);

				//set proper transition
				css(this.element, {
					'transition': (this.releaseDuration) + 'ms ease-out ' + (this.css3 ? 'transform' : 'position')
				});

				//plan leaving anim mode
				this._animateTimeout = setTimeout(() => {
					this.state = 'idle';
				}, this.releaseDuration);


				//calc target point & animate to it
				this.move(
					this.prevX + this.speed * Math.cos(this.angle),
					this.prevY + this.speed * Math.sin(this.angle)
				);

				this.speed = 0;
				emit(this, 'track');
			},

			after: function () {
				this.element.classList.remove('draggy-release');

				css(this.element, {
					'transition': null
				});
			}
		},

		reset: function () {
			this.currentHandles.forEach((handle) => {
				off(handle, this._ns);
			});

			clearTimeout(this._animateTimeout);

			off(doc, this._ns);
			off(this.element, this._ns);

			return '_';
		}
	}

	// drag handler. needed to provide drag movement emulation via API
	drag(e) {
		e.preventDefault();

		var mouseX = getClientX(e, this.touchIdx),
			mouseY = getClientY(e, this.touchIdx);

		//calc mouse movement diff
		var diffMouseX = mouseX - this.prevMouseX,
			diffMouseY = mouseY - this.prevMouseY;

		//absolute mouse coordinate
		var mouseAbsX = mouseX,
			mouseAbsY = mouseY;

		//if we are not fixed, our absolute position is relative to the doc
		if (!this._isFixed) {
			mouseAbsX += win.pageXOffset;
			mouseAbsY += win.pageYOffset;
		}

		//calc sniper offset, if any
		if (e.ctrlKey || e.metaKey) {
			this.sniperOffsetX += diffMouseX * this.sniperSlowdown;
			this.sniperOffsetY += diffMouseY * this.sniperSlowdown;
		}

		//save refs to the meta keys
		this.ctrlKey = e.ctrlKey;
		this.shiftKey = e.shiftKey;
		this.metaKey = e.metaKey;
		this.altKey = e.altKey;

		//calc movement x and y
		//take absolute placing as it is the only reliable way (2x proved)
		var x = (mouseAbsX - this.initOffsetX) - this.innerOffsetX - this.sniperOffsetX,
			y = (mouseAbsY - this.initOffsetY) - this.innerOffsetY - this.sniperOffsetY;

		//move element
		this.move(x, y);

		//save prevClientXY for calculating diff
		this.prevMouseX = mouseX;
		this.prevMouseY = mouseY;

		//emit drag
		emit(this, 'drag');
		emit(this.element, 'drag', null, true);
	}

	// manage touches
	setTouch(e) {
		if (!e.touches || this.isTouched()) return this;

		//current touch index
		this.touchIdx = touches;
		touches++;

		return this;
	}
	resetTouch() {
		touches = 0;
		this.touchIdx = null;

		return this;
	}
	isTouched() {
		return this.touchIdx !== null;
	}

	// index to fetch touch number from event
	touchIdx = null;

	// update movement limits. refresh this.withinOffsets and this.limits.
	update(e) {
		this._isFixed = isFixed(this.element);

		//enforce abs position
		if (!this.css3) {
			css(this.element, 'position', 'absolute');
		}

		//update handles
		this.currentHandles.forEach((handle) => {
			off(handle, this._ns);
		});

		var cancelEls = q(this.cancel);

		this.currentHandles = q(this.handle);

		this.currentHandles.forEach((handle) => {
			on(handle, 'mousedown' + this._ns + ' touchstart' + this._ns, (e) => {
				//mark event as belonging to the draggy
				if (!e.draggies) {
					e.draggies = [];
				}

				//ignore draggies containing other draggies
				if (e.draggies.some((draggy) => {
					return this.element.contains(draggy.element);
				})) {
					return;
				}
				//ignore events happened within cancelEls
				if (cancelEls.some((cancelEl) => {
					return cancelEl.contains(e.target);
				})) {
					return;
				}

				//register draggy
				e.draggies.push(this);
			});
		});

		//update limits
		this.updateLimits();

		//preset inner offsets
		this.innerOffsetX = this.pin[0];
		this.innerOffsetY = this.pin[1];

		var thisClientRect = this.element.getBoundingClientRect();

		//if event passed - update acc to event
		if (e) {
			//take last mouse position from the event
			this.prevMouseX = getClientX(e, this.touchIdx);
			this.prevMouseY = getClientY(e, this.touchIdx);

			//if mouse is within the element - take offset normally as rel displacement
			this.innerOffsetX = -thisClientRect.left + getClientX(e, this.touchIdx);
			this.innerOffsetY = -thisClientRect.top + getClientY(e, this.touchIdx);
		}
		//if no event - suppose pin-centered event
		else {
			//take mouse position & inner offset as center of pin
			var pinX = (this.pin[0] + this.pin[2]) * 0.5;
			var pinY = (this.pin[1] + this.pin[3]) * 0.5;
			this.prevMouseX = thisClientRect.left + pinX;
			this.prevMouseY = thisClientRect.top + pinY;
			this.innerOffsetX = pinX;
			this.innerOffsetY = pinY;
		}

		//set initial kinetic props
		this.speed = 0;
		this.amplitude = 0;
		this.angle = 0;
		this.timestamp = +new Date();
		this.frame = [this.prevX, this.prevY];

		//set sniper offset
		this.sniperOffsetX = 0;
		this.sniperOffsetY = 0;
	};

	// update limits only from current position
	updateLimits() {
		//initial translation offsets
		var initXY = this.getCoords();

		//calc initial coords
		this.prevX = initXY[0];
		this.prevY = initXY[1];
		this.initX = initXY[0];
		this.initY = initXY[1];

		//container rect might be outside the vp, so calc absolute offsets
		//zero-position offsets, with translation(0,0)
		var curOffsets = offsets(this.element);

		this.initOffsetX = curOffsets.left - this.prevX;
		this.initOffsetY = curOffsets.top - this.prevY;
		this.offsets = curOffsets;

		//handle parent case
		var within = this.within;
		if (this.within === 'parent' || this.within === true) {
			within = this.element.parentNode;
		}
		within = within || doc;

		//absolute offsets of a container
		var withinOffsets = offsets(within);

		if (within === win && this._isFixed) {
			withinOffsets.top -= win.pageYOffset;
			withinOffsets.left -= win.pageXOffset;
			withinOffsets.bottom -= win.pageYOffset;
			withinOffsets.right -= win.pageXOffset;
		}
		this.withinOffsets = withinOffsets;

		//calculate movement limits - pin width might be wider than constraints
		this.overflowX = this.pin.width - withinOffsets.width;
		this.overflowY = this.pin.height - withinOffsets.height;

		this.limits = {
			left: withinOffsets.left - this.initOffsetX - this.pin[0] - (this.overflowX < 0 ? 0 : this.overflowX),
			top: withinOffsets.top - this.initOffsetY - this.pin[1] - (this.overflowY < 0 ? 0 : this.overflowY),
			right: this.overflowX > 0 ? 0 : withinOffsets.right - this.initOffsetX - this.pin[2],
			bottom: (this.overflowY > 0 ? 0 : withinOffsets.bottom - this.initOffsetY - this.pin[3])
		};
	};

	// update info regarding of movement
	updateInfo(x, y) {
		//provide delta from prev state
		this.deltaX = x - this.prevX;
		this.deltaY = y - this.prevY;

		//save prev coords to use as a start point next time
		this.prevX = x;
		this.prevY = y;

		//provide movement delta from initial state
		this.movementX = x - this.initX;
		this.movementY = y - this.initY;
	}

	// way of placement:
	// - css3 === false (slower but more precise and cross-browser)
	// - css3 === true (faster but may cause blurs on linux systems)
	getCoords() {
		if (!this.css3) {
			// return [this.element.offsetLeft, this.element.offsetTop];
			return [parseCSSValue(css(this.element, 'left')), parseCSSValue(css(this.element, 'top'))];
		}
		else {
			return getTranslate(this.element).slice(0, 2) || [0, 0];
		}
	};
	setCoords(x, y) {
		if (this.css3) {
			if (x == null) x = this.prevX;
			if (y == null) y = this.prevY;

			x = round(x, this.precision);
			y = round(y, this.precision);

			css(this.element, 'transform', ['translate3d(', x, 'px,', y, 'px, 0)'].join(''));

			this.updateInfo(x, y);
		}
		else {
			if (x == null) x = this.prevX;
			if (y == null) y = this.prevY;

			x = round(x, this.precision);
			y = round(y, this.precision);

			css(this.element, {
				left: x,
				top: y
			});

			//update movement info
			this.updateInfo(x, y);
		}
	}

	/**
	 * Restricting container
	 * @type {Element|object}
	 * @default document.documentElement
	 */
	within = doc;

	/** Handle to drag */
	handle;

	/**
	 * Which area of draggable should not be outside the restriction area.
	 * @type {(Array|number)}
	 * @default [0,0,this.element.offsetWidth, this.element.offsetHeight]
	 */
	set pin(value) {
		if (Array.isArray(value)) {
			if (value.length === 2) {
				this._pin = [value[0], value[1], value[0], value[1]];
			} else if (value.length === 4) {
				this._pin = value;
			}
		}

		else if (typeof value === 'number') {
			this._pin = [value, value, value, value];
		}

		else {
			this._pin = value;
		}

		//calc pin params
		this._pin.width = this._pin[2] - this._pin[0];
		this._pin.height = this._pin[3] - this._pin[1];
	}

	get pin() {
		if (this._pin) return this._pin;

		//returning autocalculated pin, if private pin is none
		var pin = [0, 0, this.offsets.width, this.offsets.height];
		pin.width = this.offsets.width;
		pin.height = this.offsets.height;
		return pin;
	}

	/** Avoid initial mousemove */
	set threshold(val) {
		if (typeof val === 'number') {
			this._threshold = [-val * 0.5, -val * 0.5, val * 0.5, val * 0.5];
		} else if (val.length === 2) {
			//Array(w,h)
			this._threshold = [-val[0] * 0.5, -val[1] * 0.5, val[0] * 0.5, val[1] * 0.5];
		} else if (val.length === 4) {
			//Array(x1,y1,x2,y2)
			this._threshold = val;
		} else if (typeof (val) === 'function') {
			//custom val funciton
			this._threshold = val();
		} else {
			this._threshold = [0, 0, 0, 0];
		}
	}

	get threshold() {
		return this._threshold || [0, 0, 0, 0];
	}

	/**
	 * Movement release params
	 *
	 * @type {(number|false)}
	 * @default false
	 */
	release = false;
	releaseDuration = 500;
	velocity = 1000;
	maxSpeed = 250;
	framerate = 50;

	// To what extent round position
	precision = 1;

	// Droppable params
	droppable = null;
	droppableTolerance = 0.5;
	droppableClass = null;

	// Slow down movement by pressing ctrl/cmd
	sniper = true;

	// How much to slow sniper drag
	sniperSlowdown = .85;

	/**
	 * Restrict movement by axis
	 *
	 * @default undefined
	 * @enum {string}
	 */
	move(x, y) {
		if (this.axis === 'x') {
			if (x == null) x = this.prevX;
			if (y == null) y = this.prevY;

			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				x = loop(x - oX, w) + oX;
			} else {
				x = clamp(x, limits.left, limits.right);
			}

			this.setCoords(x);
		}
		else if (this.axis === 'y') {
			if (x == null) x = this.prevX;
			if (y == null) y = this.prevY;

			var limits = this.limits;

			if (this.repeat) {
				var h = (limits.bottom - limits.top);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				y = loop(y - oY, h) + oY;
			} else {
				y = clamp(y, limits.top, limits.bottom);
			}

			this.setCoords(null, y);
		}
		else {
			if (x == null) x = this.prevX;
			if (y == null) y = this.prevY;

			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var h = (limits.bottom - limits.top);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				if (this.repeat === 'x') {
					x = loop(x - oX, w) + oX;
				}
				else if (this.repeat === 'y') {
					y = loop(y - oY, h) + oY;
				}
				else {
					x = loop(x - oX, w) + oX;
					y = loop(y - oY, h) + oY;
				}
			}

			x = clamp(x, limits.left, limits.right);
			y = clamp(y, limits.top, limits.bottom);

			this.setCoords(x, y);
		}
	}

	/** Repeat movement by one of axises */
	repeat = false;

	/** Clean all memory-related things */
	destroy() {
		this.currentHandles.forEach((handle) => {
			off(handle, this._ns);
		});

		this.state = 'destroy';

		clearTimeout(this._animateTimeout);

		off(doc, this._ns);
		off(this.element, this._ns);


		this.element = null;
		this.within = null;
	};
}


// helpers
// Check whether arr is filled with zeros
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}

// query els
function q(str) {
	if (Array.isArray(str)) {
		return str.map(q).reduce(function (prev, curr) { return prev.concat(curr); }, []);
	}
	else if (str instanceof HTMLElement) {
		return [str];
	}
	else {
		return [].slice.call(document.querySelectorAll(str));
	}
}

// rect intersection function with tolerance
function intersect(rect1, rect2, tolerance = 0) {
	const overlapX = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
	const overlapY = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
	const overlapArea = overlapX * overlapY;

	const rect1Area = (rect1.right - rect1.left) * (rect1.bottom - rect1.top);
	const rect2Area = (rect2.right - rect2.left) * (rect2.bottom - rect2.top);
	const smallerArea = Math.min(rect1Area, rect2Area);

	return overlapArea >= tolerance * smallerArea;
}

// maths
function loop(value, left, right) {
	//detect single-arg case, like mod-loop or fmod
	if (right === undefined) {
		right = left;
		left = 0;
	}

	//swap frame order
	if (left > right) {
		var tmp = right;
		right = left;
		left = tmp;
	}

	var frame = right - left;

	value = ((value + left) % frame) - left;
	if (value < left) value += frame;
	if (value > right) value -= frame;

	return value;
};

function clamp(value, min, max) {
	return Math.max(min, Math.min(value, max));
}

function round(value, step) {
	if (step === 0) return value;
	if (!step) return Math.round(value);
	step = parseFloat(step);
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(precision(step)));
}

function precision(n) {
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
}


export default Draggable;
