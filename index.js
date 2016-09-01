/**
 * Simple draggable component
 *
 * @module draggy
 */


//work with css
const css = require('mucss/css');
const parseCSSValue = require('mucss/parse-value');
const selection = require('mucss/selection');
const offsets = require('mucss/offset');
const getTranslate = require('mucss/translate');
const intersect = require('intersects');
const isFixed = require('mucss/is-fixed');

//events
const on = require('emmy/on');
const off = require('emmy/off');
const emit = require('emmy/emit');
const Emitter = require('events');
const getClientX = require('get-client-xy').x;
const getClientY = require('get-client-xy').y;

//utils
const isArray = require('mutype/is-array');
const isNumber = require('mutype/is-number');
const isString = require('mutype/is-string');
const isFn = require('mutype/is-fn');
const defineState = require('define-state');
const extend = require('xtend/mutable');
const round = require('mumath/round');
const between = require('mumath/clamp');
const loop = require('mumath/mod');
const getUid = require('get-uid');
const inherits =  require('inherits');


const win = window, doc = document, root = doc.documentElement;


/**
 * Draggable controllers associated with elements.
 *
 * Storing them on elements is
 * - leak-prone,
 * - pollutes element’s namespace,
 * - requires some artificial key to store,
 * - unable to retrieve controller easily.
 *
 * That is why weakmap.
 */
const draggableCache = Draggable.cache = new WeakMap;



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
function Draggable(target, options) {
	if (!(this instanceof Draggable)) {
		return new Draggable(target, options);
	}

	var that = this;

	//ignore existing instance
	var instance = draggableCache.get(target);
	if (instance) {
		instance.state = 'reset';

		//take over options
		extend(instance, options);

		instance.update();

		return instance;
	}

	else {
		//get unique id for instance
		//needed to track event binders
		that.id = getUid();
		that._ns = '.draggy_' + that.id;

		//save element passed
		that.element = target;

		draggableCache.set(target, that);
	}

	//define state behaviour
	defineState(that, 'state', that.state);

	//preset handles
	that.currentHandles = [];

	//take over options
	extend(that, options);

	//define handle
	if (that.handle === undefined) {
		that.handle = that.element;
	}

	//setup droppable
	if (that.droppable) {
		that.initDroppable();
	}

	//try to calc out basic limits
	that.update();

	//go to initial state
	that.state = 'idle';
}


/** Inherit draggable from Emitter */
inherits(Draggable, Emitter);


//enable css3 by default
Draggable.prototype.css3 = true;

//both axes by default
Draggable.prototype.axis = null;


/** Init droppable "plugin" */
Draggable.prototype.initDroppable = function () {
	var that = this;

	on(that, 'dragstart', function () {
		var that = this;
		that.dropTargets = q(that.droppable);
	});

	on(that, 'drag', function () {
		var that = this;

		if (!that.dropTargets) {
			return;
		}

		var thatRect = offsets(that.element);

		that.dropTargets.forEach(function (dropTarget) {
			var targetRect = offsets(dropTarget);

			if (intersect(thatRect, targetRect, that.droppableTolerance)) {
				if (that.droppableClass) {
					dropTarget.classList.add(that.droppableClass);
				}
				if (!that.dropTarget) {
					that.dropTarget = dropTarget;

					emit(that, 'dragover', dropTarget);
					emit(dropTarget, 'dragover', that);
				}
			}
			else {
				if (that.dropTarget) {
					emit(that, 'dragout', dropTarget);
					emit(dropTarget, 'dragout', that);

					that.dropTarget = null;
				}
				if (that.droppableClass) {
					dropTarget.classList.remove(that.droppableClass);
				}
			}
		});
	});

	on(that, 'dragend', function () {
		var that = this;

		//emit drop, if any
		if (that.dropTarget) {
			emit(that.dropTarget, 'drop', that);
			emit(that, 'drop', that.dropTarget);
			that.dropTarget.classList.remove(that.droppableClass);
			that.dropTarget = null;
		}
	});
};


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
Draggable.prototype.state = {
	//idle
	_: {
		before: function () {
			var that = this;

			that.element.classList.add('draggy-idle');

			//emit drag evts on element
			emit(that.element, 'idle', null, true);
			that.emit('idle');

			//reset keys
			that.ctrlKey = false;
			that.shiftKey = false;
			that.metaKey = false;
			that.altKey = false;

			//reset movement params
			that.movementX = 0;
			that.movementY = 0;
			that.deltaX = 0;
			that.deltaY = 0;

			on(doc, 'mousedown' + that._ns + ' touchstart' + that._ns, function (e) {
				//ignore non-draggy events
				if (!e.draggies) {
					return;
				}

				//ignore dragstart for not registered draggies
				if (e.draggies.indexOf(that) < 0) {
					return;
				}

				//if target is focused - ignore drag
				//FIXME: detect focused by whitelist of tags, name supposition may be wrong (idk, form elements have names, so likely to be focused by click)
				if (e.target.name !== undefined) {
					return;
				}

				//multitouch has multiple starts
				that.setTouch(e);

				//update movement params
				that.update(e);

				//go to threshold state
				that.state = 'threshold';
			});
		},
		after: function () {
			var that = this;

			that.element.classList.remove('draggy-idle');

			off(doc, that._ns);

			//set up tracking
			if (that.release) {
				that._trackingInterval = setInterval(function (e) {
					var now = Date.now();
					var elapsed = now - that.timestamp;

					//get delta movement since the last track
					var dX = that.prevX - that.frame[0];
					var dY = that.prevY - that.frame[1];
					that.frame[0] = that.prevX;
					that.frame[1] = that.prevY;

					var delta = Math.sqrt(dX * dX + dY * dY);

					//get speed as average of prev and current (prevent div by zero)
					var v = Math.min(that.velocity * delta / (1 + elapsed), that.maxSpeed);
					that.speed = 0.8 * v + 0.2 * that.speed;

					//get new angle as a last diff
					//NOTE: vector average isn’t the same as speed scalar average
					that.angle = Math.atan2(dY, dX);

					that.emit('track');

					return that;
				}, that.framerate);
			}
		}
	},

	threshold: {
		before: function () {
			var that = this;

			//ignore threshold state, if threshold is none
			if (isZeroArray(that.threshold)) {
				that.state = 'drag';
				return;
			}

			that.element.classList.add('draggy-threshold');

			//emit drag evts on element
			that.emit('threshold');
			emit(that.element, 'threshold');

			//listen to doc movement
			on(doc, 'touchmove' + that._ns + ' mousemove' + that._ns, function (e) {
				e.preventDefault();

				//compare movement to the threshold
				var clientX = getClientX(e, that.touchIdx);
				var clientY = getClientY(e, that.touchIdx);
				var difX = that.prevMouseX - clientX;
				var difY = that.prevMouseY - clientY;

				if (difX < that.threshold[0] || difX > that.threshold[2] || difY < that.threshold[1] || difY > that.threshold[3]) {
					that.update(e);
					that.state = 'drag';
				}
			});
			on(doc, 'mouseup' + that._ns + ' touchend' + that._ns + '', function (e) {
				e.preventDefault();

				//forget touches
				that.resetTouch();

				that.state = 'idle';
			});
		},

		after: function () {
			var that = this;

			that.element.classList.remove('draggy-threshold');

			off(doc, that._ns);
		}
	},

	drag: {
		before: function () {
			var that = this;

			//reduce dragging clutter
			selection.disable(root);

			that.element.classList.add('draggy-drag');

			//emit drag evts on element
			that.emit('dragstart');
			emit(that.element, 'dragstart', null, true);

			//emit drag events on that
			that.emit('drag');
			emit(that.element, 'drag', null, true);

			//stop drag on leave
			on(doc, 'touchend' + that._ns + ' mouseup' + that._ns + ' mouseleave' + that._ns, function (e) {
				e.preventDefault();

				//forget touches - dragend is called once
				that.resetTouch();

				//manage release movement
				if (that.speed > 1) {
					that.state = 'release';
				}

				else {
					that.state = 'idle';
				}
			});

			//move via transform
			on(doc, 'touchmove' + that._ns + ' mousemove' + that._ns, function (e) {
				that.drag(e);
			});
		},

		after: function () {
			var that = this;

			//enable document interactivity
			selection.enable(root);

			that.element.classList.remove('draggy-drag');

			//emit dragend on element, this
			that.emit('dragend');
			emit(that.element, 'dragend', null, true);

			//unbind drag events
			off(doc, that._ns);

			clearInterval(that._trackingInterval);
		}
	},

	release: {
		before: function () {
			var that = this;

			that.element.classList.add('draggy-release');

			//enter animation mode
			clearTimeout(that._animateTimeout);

			//set proper transition
			css(that.element, {
				'transition': (that.releaseDuration) + 'ms ease-out ' + (that.css3 ? 'transform' : 'position')
			});

			//plan leaving anim mode
			that._animateTimeout = setTimeout(function () {
				that.state = 'idle';
			}, that.releaseDuration);


			//calc target point & animate to it
			that.move(
				that.prevX + that.speed * Math.cos(that.angle),
				that.prevY + that.speed * Math.sin(that.angle)
			);

			that.speed = 0;
			that.emit('track');
		},

		after: function () {
			var that = this;

			that.element.classList.remove('draggy-release');

			css(this.element, {
				'transition': null
			});
		}
	},

	reset: function () {
		var that = this;

		that.currentHandles.forEach(function (handle) {
			off(handle, that._ns);
		});

		clearTimeout(that._animateTimeout);

		off(doc, that._ns);
		off(that.element, that._ns);

		return '_';
	}
};


/** Drag handler. Needed to provide drag movement emulation via API */
Draggable.prototype.drag = function (e) {
	var that = this;

	e.preventDefault();

	var mouseX = getClientX(e, that.touchIdx),
		mouseY = getClientY(e, that.touchIdx);

	//calc mouse movement diff
	var diffMouseX = mouseX - that.prevMouseX,
		diffMouseY = mouseY - that.prevMouseY;

	//absolute mouse coordinate
	var mouseAbsX = mouseX,
		mouseAbsY = mouseY;

	//if we are not fixed, our absolute position is relative to the doc
	if (!that._isFixed) {
		mouseAbsX += win.pageXOffset;
		mouseAbsY += win.pageYOffset;
	}

	//calc sniper offset, if any
	if (e.ctrlKey || e.metaKey) {
		that.sniperOffsetX += diffMouseX * that.sniperSlowdown;
		that.sniperOffsetY += diffMouseY * that.sniperSlowdown;
	}

	//save refs to the meta keys
	that.ctrlKey = e.ctrlKey;
	that.shiftKey = e.shiftKey;
	that.metaKey = e.metaKey;
	that.altKey = e.altKey;

	//calc movement x and y
	//take absolute placing as it is the only reliable way (2x proved)
	var x = (mouseAbsX - that.initOffsetX) - that.innerOffsetX - that.sniperOffsetX,
		y = (mouseAbsY - that.initOffsetY) - that.innerOffsetY - that.sniperOffsetY;

	//move element
	that.move(x, y);

	//save prevClientXY for calculating diff
	that.prevMouseX = mouseX;
	that.prevMouseY = mouseY;

	//emit drag
	that.emit('drag');
	emit(that.element, 'drag', null, true);
};


/** Current number of draggable touches */
var touches = 0;


/** Manage touches */
Draggable.prototype.setTouch = function (e) {
	if (!e.touches || this.isTouched()) return this;

	//current touch index
	this.touchIdx = touches;
	touches++;

	return this;
};
Draggable.prototype.resetTouch = function () {
	touches = 0;
	this.touchIdx = null;

	return this;
};
Draggable.prototype.isTouched = function () {
	return this.touchIdx !== null;
};


/** Index to fetch touch number from event */
Draggable.prototype.touchIdx = null;


/**
 * Update movement limits.
 * Refresh that.withinOffsets and that.limits.
 */
Draggable.prototype.update = function (e) {
	var that = this;

	that._isFixed = isFixed(that.element);

	//enforce abs position
	if (!that.css3) {
		css(this.element, 'position', 'absolute');
	}

	//update handles
	that.currentHandles.forEach(function (handle) {
		off(handle, that._ns);
	});

	var cancelEls = q(that.cancel);

	that.currentHandles = q(that.handle);

	that.currentHandles.forEach(function (handle) {
		on(handle, 'mousedown' + that._ns + ' touchstart' + that._ns, function (e) {
			//mark event as belonging to the draggy
			if (!e.draggies) {
				e.draggies = [];
			}

			//ignore draggies containing other draggies
			if (e.draggies.some(function (draggy) {
				return that.element.contains(draggy.element);
			})) {
				return;
			}
			//ignore events happened within cancelEls
			if (cancelEls.some(function (cancelEl) {
				return cancelEl.contains(e.target);
			})) {
				return;
			}

			//register draggy
			e.draggies.push(that);
		});
	});

	//update limits
	that.updateLimits();

	//preset inner offsets
	that.innerOffsetX = that.pin[0];
	that.innerOffsetY = that.pin[1];

	var thatClientRect = that.element.getBoundingClientRect();

	//if event passed - update acc to event
	if (e) {
		//take last mouse position from the event
		that.prevMouseX = getClientX(e, that.touchIdx);
		that.prevMouseY = getClientY(e, that.touchIdx);

		//if mouse is within the element - take offset normally as rel displacement
		that.innerOffsetX = -thatClientRect.left + getClientX(e, that.touchIdx);
		that.innerOffsetY = -thatClientRect.top + getClientY(e, that.touchIdx);
	}
	//if no event - suppose pin-centered event
	else {
		//take mouse position & inner offset as center of pin
		var pinX = (that.pin[0] + that.pin[2] ) * 0.5;
		var pinY = (that.pin[1] + that.pin[3] ) * 0.5;
		that.prevMouseX = thatClientRect.left + pinX;
		that.prevMouseY = thatClientRect.top + pinY;
		that.innerOffsetX = pinX;
		that.innerOffsetY = pinY;
	}

	//set initial kinetic props
	that.speed = 0;
	that.amplitude = 0;
	that.angle = 0;
	that.timestamp = +new Date();
	that.frame = [that.prevX, that.prevY];

	//set sniper offset
	that.sniperOffsetX = 0;
	that.sniperOffsetY = 0;
};

/**
 * Update limits only from current position
 */
Draggable.prototype.updateLimits = function () {
	var that = this;

	//initial translation offsets
	var initXY = that.getCoords();

	//calc initial coords
	that.prevX = initXY[0];
	that.prevY = initXY[1];
	that.initX = initXY[0];
	that.initY = initXY[1];

	//container rect might be outside the vp, so calc absolute offsets
	//zero-position offsets, with translation(0,0)
	var thatOffsets = offsets(that.element);

	that.initOffsetX = thatOffsets.left - that.prevX;
	that.initOffsetY = thatOffsets.top - that.prevY;
	that.offsets = thatOffsets;

	//handle parent case
	var within = that.within;
	if (that.within === 'parent' || that.within === true) {
		within = that.element.parentNode;
	}
	within = within || doc;

	//absolute offsets of a container
	var withinOffsets = offsets(within);

	if (within === win && that._isFixed) {
		withinOffsets.top -= win.pageYOffset;
		withinOffsets.left -= win.pageXOffset;
		withinOffsets.bottom -= win.pageYOffset;
		withinOffsets.right -= win.pageXOffset;
	}
	that.withinOffsets = withinOffsets;

	//calculate movement limits - pin width might be wider than constraints
	that.overflowX = that.pin.width - withinOffsets.width;
	that.overflowY = that.pin.height - withinOffsets.height;

	that.limits = {
		left: withinOffsets.left - that.initOffsetX - that.pin[0] - (that.overflowX < 0 ? 0 : that.overflowX),
		top: withinOffsets.top - that.initOffsetY - that.pin[1] - (that.overflowY < 0 ? 0 : that.overflowY),
		right: that.overflowX > 0 ? 0 : withinOffsets.right - that.initOffsetX - that.pin[2],
		bottom: (that.overflowY > 0 ? 0 : withinOffsets.bottom - that.initOffsetY - that.pin[3])
	};
};

/**
 * Update info regarding of movement
 */
Draggable.prototype.updateInfo = function (x, y) {
	var that = this;

	//provide delta from prev state
	that.deltaX = x - that.prevX;
	that.deltaY = y - that.prevY;

	//save prev coords to use as a start point next time
	that.prevX = x;
	that.prevY = y;

	//provide movement delta from initial state
	that.movementX = x - that.initX;
	that.movementY = y - that.initY;

}


/**
 * Way of placement:
 * - css3 === false (slower but more precise and cross-browser)
 * - css3 === true (faster but may cause blurs on linux systems)
 */
Draggable.prototype.getCoords = function () {
	if (!this.css3) {
		// return [this.element.offsetLeft, this.element.offsetTop];
		return [parseCSSValue(css(this.element,'left')), parseCSSValue(css(this.element, 'top'))];
	}
	else {
		return getTranslate(this.element).slice(0, 2) || [0,0];
	}
};
Draggable.prototype.setCoords = function (x, y) {
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
};


/**
 * Restricting container
 * @type {Element|object}
 * @default doc.documentElement
 */
Draggable.prototype.within = doc;


/** Handle to drag */
Draggable.prototype.handle;


Object.defineProperties(Draggable.prototype, {
	/**
	 * Which area of draggable should not be outside the restriction area.
	 * @type {(Array|number)}
	 * @default [0,0,this.element.offsetWidth, this.element.offsetHeight]
	 */
	pin: {
		set: function (value) {
			if (isArray(value)) {
				if (value.length === 2) {
					this._pin = [value[0], value[1], value[0], value[1]];
				} else if (value.length === 4) {
					this._pin = value;
				}
			}

			else if (isNumber(value)) {
				this._pin = [value, value, value, value];
			}

			else {
				this._pin = value;
			}

			//calc pin params
			this._pin.width = this._pin[2] - this._pin[0];
			this._pin.height = this._pin[3] - this._pin[1];
		},

		get: function () {
			if (this._pin) return this._pin;

			//returning autocalculated pin, if private pin is none
			var pin = [0,0, this.offsets.width, this.offsets.height];
			pin.width = this.offsets.width;
			pin.height = this.offsets.height;
			return pin;
		}
	},

	/** Avoid initial mousemove */
	threshold: {
		set: function (val) {
			if (isNumber(val)) {
				this._threshold = [-val*0.5, -val*0.5, val*0.5, val*0.5];
			} else if (val.length === 2) {
				//Array(w,h)
				this._threshold = [-val[0]*0.5, -val[1]*0.5, val[0]*0.5, val[1]*0.5];
			} else if (val.length === 4) {
				//Array(x1,y1,x2,y2)
				this._threshold = val;
			} else if (isFn(val)) {
				//custom val funciton
				this._threshold = val();
			} else {
				this._threshold = [0,0,0,0];
			}
		},

		get: function () {
			return this._threshold || [0,0,0,0];
		}
	}
});



/**
 * For how long to release movement
 *
 * @type {(number|false)}
 * @default false
 * @todo
 */
Draggable.prototype.release = false;
Draggable.prototype.releaseDuration = 500;
Draggable.prototype.velocity = 1000;
Draggable.prototype.maxSpeed = 250;
Draggable.prototype.framerate = 50;


/** To what extent round position */
Draggable.prototype.precision = 1;


/** Droppable params */
Draggable.prototype.droppable = null;
Draggable.prototype.droppableTolerance = 0.5;
Draggable.prototype.droppableClass = null;


/** Slow down movement by pressing ctrl/cmd */
Draggable.prototype.sniper = true;


/** How much to slow sniper drag */
Draggable.prototype.sniperSlowdown = .85;


/**
 * Restrict movement by axis
 *
 * @default undefined
 * @enum {string}
 */
Draggable.prototype.move = function (x, y) {
	if (this.axis === 'x') {
		if (x == null) x = this.prevX;
		if (y == null) y = this.prevY;

		var limits = this.limits;

		if (this.repeat) {
			var w = (limits.right - limits.left);
			var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
			x = loop(x - oX, w) + oX;
		} else {
			x = between(x, limits.left, limits.right);
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
			y = between(y, limits.top, limits.bottom);
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

		x = between(x, limits.left, limits.right);
		y = between(y, limits.top, limits.bottom);

		this.setCoords(x, y);
	}
};


/** Repeat movement by one of axises */
Draggable.prototype.repeat = false;


/** Check whether arr is filled with zeros */
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}



/** Clean all memory-related things */
Draggable.prototype.destroy = function () {
	var that = this;

	that.currentHandles.forEach(function (handle) {
		off(handle, that._ns);
	});

	that.state = 'destroy';

	clearTimeout(that._animateTimeout);

	off(doc, that._ns);
	off(that.element, that._ns);


	that.element = null;
	that.within = null;
};



//little helpers

function q (str) {
	if (Array.isArray(str)) {
		return str.map(q).reduce(function(prev, curr) { return prev.concat(curr); }, [] );
	}
	else if (str instanceof HTMLElement) {
		return [str];
	}
	else {
		return [].slice.call(document.querySelectorAll(str));
	}
}


module.exports = Draggable;