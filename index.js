/**
 * Simple draggable component
 *
 * @module draggy
 */


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
var defineState = require('define-state');
var extend = require('xtend/mutable');
var round = require('mumath/round');
var between = require('mumath/between');


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


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
proto.state = {
	//idle
	_: {
		before: function () {
			var self = this;

			//emit drag evts on element
			emit(self.element, 'idle', null, true);
			self.emit('idle');

			//bind start drag
			on(self.element, 'touchstart.draggy mousedown.draggy', function (e) {
				e.preventDefault();

				//update movement params
				self.update(e);

				//go to threshold state
				self.state = 'threshold';
			});
		},
		after: function () {
			var self = this;

			off(self.element, 'touchstart.draggy mousedown.draggy');

			//set up tracking
			if (self.release) {
				self._trackingInterval = setInterval(function (e) {
					var now = Date.now();
					var elapsed = now - self.timestamp;

					//get delta movement since the last track
					var dX = self.prevX - self.frame[0];
					var dY = self.prevY - self.frame[1];
					self.frame[0] = self.prevX;
					self.frame[1] = self.prevY;

					var delta = Math.sqrt(dX * dX + dY * dY);

					//get speed as average of prev and current (prevent div by zero)
					var v = Math.min(self.velocity * delta / (1 + elapsed), self.maxSpeed);
					self.speed = 0.8 * v + 0.2 * self.speed;

					//get new angle as a last diff
					//NOTE: vector average isn’t the same as speed scalar average
					self.angle = Math.atan2(dY, dX);

					self.emit('track');

					return self;
				}, self.framerate);
			}
		}
	},

	threshold: {
		before: function () {
			var self = this;

			//ignore threshold state, if threshold is none
			if (isZeroArray(self.threshold)) {
				self.state = 'drag';
				return;
			}

			//emit drag evts on element
			this.emit('threshold');

			//listen to doc movement
			on(doc, 'touchmove.draggy mousemove.draggy', function (e) {
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

			//emit drag evts on element
			this.emit('dragstart');
			emit(this.element, 'dragstart', null, true);

			//emit drag events on self
			this.emit('drag');
			emit(this.element, 'drag', null, true);

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

				//absolute mouse coordinate
				var mouseAbsX = mouseX + win.pageXOffset,
					mouseAbsY = mouseY + win.pageYOffset;

				//calc sniper offset, if any
				if (e.ctrlKey || e.metaKey) {
					self.sniperOffsetX += diffMouseX * self.sniperSlowdown;
					self.sniperOffsetY += diffMouseY * self.sniperSlowdown;
				}

				//calc movement x and y
				//take absolute placing as it is the only reliable way (2x proved)
				var x = (mouseAbsX - self.initOffsetX) - self.innerOffsetX - self.sniperOffsetX,
					y = (mouseAbsY - self.initOffsetY) - self.innerOffsetY - self.sniperOffsetY;

				//move element
				self.move(x, y);

				//save prevClientXY for calculating diff
				self.prevMouseX = mouseX;
				self.prevMouseY = mouseY;

				//emit drag
				self.emit('drag');
				emit(self.element, 'drag', null, true);
			});
		},

		after: function () {
			//enable document interactivity
			selection.enable(root);

			//emit dragend on element, this
			this.emit('dragend');
			emit(this.element, 'dragend', null, true);

			//unbind drag events
			off(doc, 'touchend.draggy mouseup.draggy mouseleave.draggy');
			off(doc, 'touchmove.draggy mousemove.draggy');
			clearInterval(this._trackingInterval);
		}
	},

	release: {
		before: function () {
			clearTimeout(self._animTimeout);

			//set proper transition
			css(this.element, {
				'transition': (this.releaseDuration) + 'ms ease-out ' + (this.css3 ? 'transform' : 'position')
			});

			//calc target point & animate to it
			this.move(
				this.prevX + this.speed * Math.cos(this.angle),
				this.prevY + this.speed * Math.sin(this.angle)
			);

			this.speed = 0;
			this.emit('track');

			this.state = 'idle';
		},

		after: function () {
			var self = this;
			//remove transition timeout
			self._animTimeout = setTimeout(function () {
				css(self.element, {
					'transition': null
				});
			}, self.releaseDuration);
		}
	}
};


/**
 * Update movement limits.
 * Refresh self.withinOffsets and self.limits.
 */
proto.update = function (e) {
	var self = this;

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

	//calculate movement limits - pin width might be wider than constraints
	var pinW = self.pin[2] - self.pin[0];
	var pinH = self.pin[3] - self.pin[1];
	var dW = Math.max(pinW - withinOffsets.width, 0);
	var dH = Math.max(pinH - withinOffsets.height, 0);
	self.limits = {
		left: withinOffsets.left - self.initOffsetX - self.pin[0] - dW,
		top: withinOffsets.top - self.initOffsetY - self.pin[1] - dH,
		right: pinW > withinOffsets.width ? 0 : (withinOffsets.right - self.initOffsetX - self.pin[2]),
		bottom: pinH > withinOffsets.height ? 0 : (withinOffsets.bottom - self.initOffsetY - self.pin[3])
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

	//set sniper offset
	self.sniperOffsetX = 0;
	self.sniperOffsetY = 0;
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
			return this._pin || [0,0, this.offsets.width, this.offsets.height];
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
proto.release = false;
proto.releaseDuration = 500;
proto.velocity = 1000;
proto.maxSpeed = 100;
proto.framerate = 50;


/** To what extent round position */
proto.precision = 1;


/** Slow down movement by pressing ctrl/cmd */
proto.sniper = true;


/** How much to slow sniper drag */
proto.sniperSlowdown = .85;


/**
 * Restrict movement by axis
 *
 * @default undefined
 * @enum {string}
 */
proto.axis = {
	_: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var h = (limits.bottom - limits.top);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0];
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1];
				if (this.repeat === 'x') {
					x = ((x - oX) % w) + oX;
					if (x < oX) x += w;
				}
				else if (this.repeat === 'y') {
					y = ((y - oY) % h) + oY;
					if (y < oY) y += h;
				}
				else {
					x = ((x - oX) % w) + oX;
					y = ((y - oY) % h) + oY;
					if (x < oX) x += w;
					if (y < oY) y += h;
				}
			}

			x = between(x, limits.left, limits.right);
			y = between(y, limits.top, limits.bottom);

			this.setCoords(x, y);
		};
	},
	x: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0];
				x = ((x - oX) % w) + oX;
				if (x < oX) x += w;
			}

			x = between(x, limits.left, limits.right);
			this.setCoords(x, this.prevY);
		};
	},
	y: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var h = (limits.bottom - limits.top);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1];
				y = ((y - oY) % h) + oY;
				if (y < oY) y += h;
			}

			y = between(y, limits.top, limits.bottom);
			this.setCoords(this.prevX, y);
		};
	}
};


/** Repeat movement by one of axises */
proto.repeat = false;


/** Check whether arr is filled with zeros */
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}


module.exports = Draggable;