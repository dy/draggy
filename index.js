/**
 * Simple draggable component
 *
 * @module draggy
 */

//TODO: make within/pin/others a function
//TODO: ignore multiple elements drag

//work with css
var css = require('mucss/css');
var parseCSSValue = require('mucss/parse-value');
var selection = require('mucss/selection');
var offsets = require('mucss/offsets');
var getTranslate = require('mucss/translate');

//events
var on = require('emmy/on');
var off = require('emmy/off');
var emit = require('emmy/emit');
var Emitter = require('events');
var getClientX = require('get-client-xy').x;
var getClientY = require('get-client-xy').y;

//utils
var isArray = require('is-array');
var isNumber = require('is-number');
var isFn = require('is-function');
var contains = require('contains');
var defineState = require('define-state');
var extend = require('xtend/mutable');

//math helpers - round to a precision, limit by min and max
var round = require('mumath/round');
var between = require('mumath/between');
var isBetween = require('mumath/is-between');


var win = window, doc = document, root = doc.documentElement;


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
var draggableCache = Draggable.cache = new WeakMap;



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
	if (!(this instanceof Draggable)) return new Draggable(target, options);

	//save element passed
	this.element = target;
	draggableCache.set(target, this);

	//define mode of drag
	defineState(this, 'css3', this.css3);
	this.css3 = true;

	//define state behaviour
	defineState(this, 'state', this.state);
	this.state = 'idle';

	//define axis behaviour
	defineState(this, 'axis', this.axis);
	this.axis = null;

	//take over options
	extend(this, options);

	//try to calc out basic limits
	this.update();
}


/** Inherit draggable from Emitter */
var proto = Draggable.prototype = Object.create(Emitter.prototype);


var proto = Draggable.prototype;


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
proto.state = {
	//idle
	_: {
		before: function () {
			//emit drag evts on element
			emit(this.element, 'idle', null, true);
			this.emit('idle');

			//bind start drag
			on(this.element, 'touchstart.draggy mousedown.draggy', function (e) {
				e.preventDefault();

				var target = e.target;
				var self = draggableCache.get(target);

				//ignore non-draggable target
				if (!self) return;

				//update movement params
				self.update(e);

				//FIXME if drag started outside the element - center by pin

				//go to threshold state
				self.state = 'threshold';
			});
		},
		after: function () {
			off(this.element, 'touchstart.draggy mousedown.draggy');
		}
	},

	threshold: {
		before: function () {
			var self = this;

			//ignore threshold state, if threshold is none
			if (isZeroArray(self.threshold)) self.state = 'drag';

			//emit drag evts on element
			emit(this.element, 'threshold', null, true);
			this.emit('threshold');

			//listen to doc movement
			on(doc, 'touchmove.draggy mousemove.draggy', function (e) {
				e.preventDefault();

				//compare movement to the threshold
				var clientX = getClientX(e);
				var clientY = getClientY(e);
				var difX = self.prevMouseX - clientX;
				var difY = self.prevMouseY - clientY;

				if (difX < self.threshold[0] || difX > self.threshold[2] || difY < self.threshold[1] || difY > self.threshold[3]) {
					self.update(e);

					self.state = 'drag';
				}
			});
			on(doc, 'mouseup.draggy touchend.draggy', function (e) {
				e.preventDefault();
				self.state = 'idle';
			});
		},

		after: function () {
			off(doc, 'touchmove.draggy mousemove.draggy mouseup.draggy touchend.draggy');
		}
	},

	drag: {
		before: function () {
			var self = this;

			//reduce dragging clutter
			selection.disable(root);
			if (this.hideCursor) css(root, {"cursor": "none"});

			//emit drag evts on element
			emit(this.element, 'dragstart', null, true);
			emit(this.element, 'drag', null, true);

			//emit drag events on self
			this.emit('dragstart');
			this.emit('drag');

			//stop drag on leave
			on(doc, 'touchend.draggy mouseup.draggy mouseleave.draggy', function (e) {
				e.preventDefault();

				if (self.speed > 1) {
					self.state = 'release';
				}

				else {
					self.state = 'idle';
				}
			});

			//move via transform
			on(doc, 'touchmove.draggy mousemove.draggy', function (e) {
				var mouseX = getClientX(e),
					mouseY = getClientY(e);

				//calc mouse movement diff
				var diffMouseX = mouseX - self.prevMouseX,
					diffMouseY = mouseY - self.prevMouseY;

				//get real movement diff
				var diffX = diffMouseX;
				var diffY = diffMouseY;

				//ignore diff if mouse is outside the movable area
				var mouseAbsX = mouseX + win.pageXOffset - self.innerOffsetX;
				var mouseAbsY = mouseY + win.pageYOffset - self.innerOffsetY;

				//calc movement x and y
				var x,y;

				//border conditions needs to be absolutely overtaken to avoid displacement of inner offset
				//if mouse is too left
				if (mouseAbsX < self.withinOffsets.left - self.pin[0]) {
					x = self.limits.left;
				}
				//mouse is too right
				else if (mouseAbsX > self.withinOffsets.right - self.pin[2]) {
					x = self.limits.right;
				}
				else {
					x = self.prevX + diffX;
				}

				//if mouse is too top
				if (mouseAbsY < self.withinOffsets.top - self.pin[1]) {
					y = self.limits.top;
				}
				//mouse is too bottom
				else if (mouseAbsY > self.withinOffsets.bottom - self.pin[3]) {
					y = self.limits.bottom;
				}
				else {
					y = self.prevY + diffY;
				}

				//move element
				self.move(x, y);

				//save prevClientXY for calculating diff
				self.prevMouseX = mouseX;
				self.prevMouseY = mouseY;

				//emit drag
				emit(self.element, 'drag', null, true);
				emit(self, 'drag');
			});
		},

		after: function () {
			//enable document interactivity
			selection.enable(root);
			if (this.hideCursor) css(root, {"cursor": null});

			//emit dragend on element, this
			emit(this.element, 'dragend', null, true);
			this.emit('dragend');

			//unbind drag events
			off(doc, 'touchend.draggy mouseup.draggy mouseleave.draggy');
			off(doc, 'touchmove.draggy mousemove.draggy');
		}
	},

	release: {
		before: function () {
			//set proper transition
			css(this.element, {
				'transition': this.release + 'ms ease-out transform'
			});

			//calc target point & animate to it
			this.x += self.speed * Math.cos(self.angle);
			this.y += self.speed * Math.sin(self.angle);

			//release release after 1ms (animation)
			this.emit('stop:defer(' + this.release + ')');
		},

		//stop movement
		stop: function  () {
			this.dragstate('idle');
		},

		after: function () {
			css(this.element, {
				'transition': null
			});

			//remove planned stopping
			this.off('stop');
		}
	}
};


/**
 * Update movement limits.
 * Refresh self.withinOffsets and self.limits.
 */
proto.update = function (e) {
	var self = this;

	//set initial pin to element’s size
	if (!self.pin) self.pin = [0,0, self.element.offsetWidth, self.element.offsetHeight];

	//initial translation offsets
	var initXY = self.getCoords();

	//calc initial coords
	self.prevX = initXY[0];
	self.prevY = initXY[1];

	//container rect might be outside the vp, so calc absolute offsets
	//zero-position offsets, with translation(0,0)
	var selfOffsets = offsets(self.element);
	self.initOffsetX = selfOffsets.left - self.prevX;
	self.initOffsetY = selfOffsets.top - self.prevY;
	self.offsets = selfOffsets;

	//handle parent case
	if (self.within === 'parent') self.within = self.element.parentNode || doc;

	//absolute offsets of a container
	var withinOffsets = offsets(self.within);
	self.withinOffsets = withinOffsets;

	//calculate movement limits
	self.limits = {
		left: withinOffsets.left - self.initOffsetX - self.pin[0],
		top: withinOffsets.top - self.initOffsetY - self.pin[1],
		right: withinOffsets.right - self.initOffsetX - self.pin[2],
		bottom: withinOffsets.bottom - self.initOffsetY - self.pin[3]
	};

	//preset inner offsets
	self.innerOffsetX = self.pin[0];
	self.innerOffsetY = self.pin[1];

	var selfClientRect = self.element.getBoundingClientRect();
	var pinX = (self.pin[0] + self.pin[2] ) * .5;
	var pinY = (self.pin[1] + self.pin[3] ) * .5;

	//if event passed - update acc to event
	if (e) {
		//take last mouse position from the event
		self.prevMouseX = getClientX(e);
		self.prevMouseY = getClientY(e);

		//if mouse is within the element - take offset normally as rel displacement
		self.innerOffsetX = -selfClientRect.left + getClientX(e);
		self.innerOffsetY = -selfClientRect.top + getClientY(e);
	}
	//if no event - suppose pin-centered event
	else {
		//take mouse position & inner offset as center of pin
		self.prevMouseX = selfClientRect.left + pinX;
		self.prevMouseY = selfClientRect.top + pinY;
		self.innerOffsetX = pinX;
		self.innerOffsetY = pinY;
	}

	//set initial kinetic props
	self.speed = 0;
	self.amplitude = 0;
	self.angle = 0;
	self.timestamp = +new Date();
	self.frame = [self.prevX, self.prevY];
};


/**
 * Way of placement:
 * - position === false (slower but more precise and cross-browser)
 * - translate3d === true (faster but may cause blurs on linux systems)
 */
proto.css3 = {
	_: function () {
		this.getCoords = function () {
			// return [this.element.offsetLeft, this.element.offsetTop];
			return [parseCSSValue(css(this.element,'left')), parseCSSValue(css(this.element, 'top'))];
		};

		this.setCoords = function (x, y) {
			css(this.element, {
				left: x,
				top: y
			});

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	},

	//undefined placing is treated as translate3d
	true: function () {
		this.getCoords  = function () {
			return getTranslate(this.element) || [0,0];
		};

		this.setCoords = function (x, y) {
			x = round(x, this.precition);
			y = round(y, this.precition);

			css(this.element, 'transform', ['translate3d(', x, 'px,', y, 'px, 0)'].join(''));

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	}
};



/** Callbacks */
// drag: undefined,
// dragstart: undefined,
// dragend: undefined,
// dragrelease: undefined


/**
 * Track movement
 *
 * @param {Event} e An event to track movement
 */
proto.track = function (e) {
	var self = this;

	var now = +new Date;
	var elapsed = now - self.timestamp;

	//get delta movement since the last track
	var dX = self.prevX - self.frame[0];
	var dY = self.prevY - self.frame[1];
	self.frame[0] = self.prevX;
	self.frame[1] = self.prevY;

	var delta = Math.sqrt(dX * dX + dY * dY);

	//get speec (prevent div by zero)
	var v = self.velocity * delta / (1 + elapsed);
	self.speed = 0.6 * v + 0.4 * self.speed;

	//get angle as .7 of movement, .3 of prev angle
	self.angle = 0.7 * Math.atan2(dY, dX) + 0.3 * self.angle;

	return self;
};



/**
 * Restricting container
 * @type {Element|object}
 * @default doc.documentElement
 */
proto.within = doc;


Object.defineProperties(proto, {
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
		},

		get: function () {
			return this._pin;
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
				this._threshold = val;
			} else {
				this._threshold = [0,0,0,0];
			}
		},

		get: function () {
			return this._threshold || [0,0,0,0];
		}
	}
});


/** Clone object for dragging */
proto.ghost = false;


/**
 * How fast to move when released
 */
proto.velocity = 2000;
proto.maxVelocity = 100;


/**
 * For how long to release movement
 *
 * @type {(number|false)}
 * @default false
 * @todo
 */
proto.release = false;


/** Autoscroll on reaching the border of the screen */
proto.autoscroll = false;


/** To what extent round position */
proto.precision = 1;


/** Slow down movement by pressing ctrl/cmd */
proto.sniper = true;


/** How much is slower sniper drag */
proto.sniperSpeed = .15;


/**
 * Restrict movement by axis
 *
 * @default undefined
 * @enum {string}
 */
proto.axis = {
	_: function () {
		this.move = function (x, y) {
			x = between(x, this.limits.left, this.limits.right);
			y = between(y, this.limits.top, this.limits.bottom);
			this.setCoords(x, y);
		};
	},
	x: function () {
		this.move = function (x, y) {
			x = between(x, this.limits.left, this.limits.right);
			this.setCoords(x, this.prevY);
		};
	},
	y: function () {
		this.move = function (x, y) {
			y = between(y, this.limits.top, this.limits.bottom);
			this.setCoords(this.prevX, y);
		};
	}
};


/**
 * Repeat position by one of axis
 * @enum {string}
 * @default undefined
 */
proto.repeat = {
	undefined: null,
	both: null,
	x: null,
	y: null,
	_: function () {
		//TODO
		//vector passed
		if (this.repeat instanceof Array) {
			if (this.repeat.length) {
				if (this.repeat[0] && this.repeat[1])
					return "both";
				else if (this.repeat[0])
					return "x";
				else if (this.repeat[1])
					return "y";
			}

		//just repeat any possible way
		} else if (this.repeat === true) {
			return this.axis

		//unrecognized value passed
		} else {
			return undefined;
		}
	}
};


/** Hide cursor on drag (reduce clutter) */
proto.hideCursor = false;


/** Check whether arr is filled with zeros */
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}


module.exports = Draggable;