/**
 * Simple draggable component
 *
 * @module draggy
 */

//TODO: make within/pin/others a function

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


var win = window, doc = document;


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

	//take over options
	extend(this, options);

	//init threshold
	//FIXME: simplify this
	this.threshold = (function (val) {
		if (isNumber(val)) {
				return [-val*.5, -val*.5, val*.5, val*.5];
		} else if (val.length === 2) {
			//Array(w,h)
			return [-val[0]*.5, -val[1]*.5, val[0]*.5, val[1]*.5];
		} else if(val.length === 4) {
			//Array(x1,y1,x2,y2)
			return val;
		} else if (isFn(val)) {
			//custom val funciton
			return val;
		} else {
			return [0,0,0,0];
		}
	})(this.threshold);

	//define mode of drag
	defineState(this, 'placingType', this.placingType);
	this.placingType = 'translate3d';
	// this.placingType = 'position';


	//define state behaviour
	defineState(this, 'state', this.state);
	this.state = 'idle';
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
			//enable document interactivity
			selection.enable(doc.documentElement);
			if (this.hideCursor) css(doc.documentElement, {"cursor": null});

			//start drag
			on(this.element, 'touchstart.drag mousedown.drag', function (e) {
				e.preventDefault();

				var target = e.target;
				var self = draggableCache.get(target);

				//ignore non-draggable target
				if (!self) return;

				//handle parent case
				if (self.within === 'parent') self.within = self.element.parentNode || doc;

				/*

				//don’t start double drag (if draggable is within other draggable)
				//FIXME: what’s the case?
				// if (e.target.draggable !== this) return;

				//init drag params
				//prepare limits & pin for drag session
				var within = this.within;
				var pin = this.pin;

				//parse translate x & y
				//they are needed to get real initial offsets on drag start
				var translateStr = css(this.element, 'transform');
				var m1 = /-?\b[\d\.]+/.exec(translateStr);
				var tx = parseFloat(m1[0]);
				translateStr = translateStr.slice(m1.index + m1[0].length);
				var m2 =  /-?\b[\d\.]+/.exec(translateStr);
				var ty = parseFloat(m2[0]);


				var selfOffsets = offsets(this.element);

				//initial offsets from the `limitEl`, 0-translation (only first init)
				this.initOffsetX = selfOffsets.left - tx;
				this.initOffsetY = selfOffsets.top - ty;

				//ignore undefined restriction container
				if (!within) return;

				var containerOffsets = css.offsets(within);
				var paddings = css.paddings(within);


				//initial container offsets from page
				this.containerOffsetX = containerOffsets.left;
				this.containerOffsetY = containerOffsets.top;


				//correct init offsets
				this.initOffsetX -= containerOffsets.left;
				this.initOffsetY -= containerOffsets.top;

				//save limits && offsets
				this.limits = {
					left: -pin[0] - this.initOffsetX + paddings.left,
					top: -pin[1] - this.initOffsetY + paddings.top,
					right: -this.initOffsetX + containerOffsets.width - pin[2] - paddings.right,
					bottom: -this.initOffsetY + containerOffsets.height - pin[3] - paddings.bottom
				};


				//set initial position - have to go after updating limits
				self.prevClientX = getClientX(e);
				self.prevClientY = getClientY(e);


				//if drag started outside the element - align the element centered by pin (excl threshold case)
				if (e.target === self.element) {
					self.innerOffsetX = e.offsetX;
					self.innerOffsetY = e.offsetY;
				}
				//FIXME
				// else if (self.state === 'threshold') {
				// 	var offsets = self.element.getBoundingClientRect();
				// 	self.innerOffsetX = self.prevClientX - offsets.left;
				// 	self.innerOffsetY = self.prevClientY - offsets.top;
				// }
				else {
					self.innerOffsetX = self.pin[0] / 2 + self.pin[2] / 2;
					self.innerOffsetY = self.pin[1] / 2 + self.pin[3] / 2;
				}


				//set initial client x & y
				self.initClientX = self.prevClientX;
				self.initClientY = self.prevClientY;


				//with zero-threshold move picker to the point of click
				//FIXME what’s that and why?
				// if (isZeroArray(self.threshold)) {
				// 	self.drag(e);
				// }

				//if release is defined - set tracking
				if (self.release) {
					//set initial kinetic props
					self.currentVelocity = 0;
					self.amplitude = 0;
					self.angle = 0;
					// self.frame = [self.prevClientX, self.prevClientY];
					self.timestamp = +new Date();
				}

				*/

				//set initial pin to element’s size
				if (!self.pin) self.pin = [0,0,self.element.offsetWidth, self.element.offsetHeight];

				//initial translation offsets
				var initXY = self.getCoords();

				//calc initial coords
				self.prevX = initXY[0];
				self.prevY = initXY[1];

				//get initial mouse position
				self.prevMouseX = getClientX(e);
				self.prevMouseY = getClientY(e);

				//container rect might be outside the vp, so calc absolute offsets
				//zero-position offsets, with translation(0,0)
				var selfOffsets = offsets(self.element);
				self.initOffsetX = selfOffsets.left - self.prevX;
				self.initOffsetY = selfOffsets.top - self.prevY;
				self.offsets = selfOffsets;

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

				//save inner offset
				if (contains(self.element, e.target)) {
					var selfClientRect = self.element.getBoundingClientRect();
					self.innerOffsetX = - selfClientRect.left + e.clientX;
					self.innerOffsetY = - selfClientRect.top + e.clientY;
				}
				//FIXME
				// else if (self.state === 'threshold') {
				// 	var offsets = self.element.getBoundingClientRect();
				// 	self.innerOffsetX = self.prevClientX - offsets.left;
				// 	self.innerOffsetY = self.prevClientY - offsets.top;
				// }
				//if drag started outside the element - center by pin
				// else {
				// 	self.innerOffsetX = self.pin[0] / 2 + self.pin[2] / 2;
				// 	self.innerOffsetY = self.pin[1] / 2 + self.pin[3] / 2;
				// }

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
			//ignore threshold state, if threshold is none
			if (isZeroArray(this.threshold)) this.state = 'drag';

			// //listen to doc movement
			// on(document, 'touchmove mousemove', function (e) {
			// 	e.preventDefault();

			// 	//compare movement to the threshold
			// 	var clientX = getClientX(e);
			// 	var clientY = getClientY(e);
			// 	var difX = this.initClientX - clientX;
			// 	var difY = this.initClientY - clientY;

			// 	if (difX < this.threshold[0] || difX > this.threshold[2] || difY < this.threshold[1] || difY > this.threshold[3]) {
			// 		this.initDragparams(e);

			// 		this.dragstate('drag');
			// 	}
			// });

		},

		after: function () {
			//reduce dragging clutter
			selection.disable(doc.documentElement);
			if (this.hideCursor) css(doc.documentElement, {"cursor": "none"});
		}
	},

	drag: {
		before: function () {
			var self = this;

			selection.disable(this.element);

			//emit drag evts on element
			emit(this.element, 'dragstart', null, true);
			emit(this.element, 'drag', null, true);

			//emit drag events on self
			this.emit('dragstart');
			this.emit('drag');

			//stop drag on leave
			on(doc, 'touchend.draggy mouseup.draggy mouseleave.draggy', function (e) {
				e.preventDefault();

				if (self.currentVelocity > 1) {
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
				//mouse is between
				else {
					x = between(self.prevX + diffX, self.limits.left, self.limits.right)
				}

				//if mouse is too top
				if (mouseAbsY < self.withinOffsets.top - self.pin[1]) {
					y = self.limits.top;
				}
				//mouse is too bottom
				else if (mouseAbsY > self.withinOffsets.bottom - self.pin[3]) {
					y = self.limits.bottom;
				}
				// mouse is between
				else {
					y = between(self.prevY + diffY, self.limits.top, self.limits.bottom)
				}

				//move element
				self.move(x, y);

				//save prev coords to use as a start point next time
				self.prevX = x;
				self.prevY = y;

				//save prevClientXY for calculating diff
				self.prevMouseX = mouseX;
				self.prevMouseY = mouseY;

				//emit drag
				emit(self.element, 'drag', null, true);
				emit(self, 'drag');
			});
		},

		after: function () {
			selection.enable(this.element);

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
			this.x += self.currentVelocity * Math.cos(self.angle);
			this.y += self.currentVelocity * Math.sin(self.angle);

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
 * Way of placement:
 * - position (slower but more precise and cross-browser)
 * - translate3d (faster but may cause blurs on linux systems)
 */
proto.placingType = {
	position: function () {
		this.getCoords = function () {
			// return [this.element.offsetLeft, this.element.offsetTop];
			return [parseCSSValue(css(this.element,'left')), parseCSSValue(css(this.element, 'top'))];
		};

		this.move = function (x, y) {
			css(this.element, {
				left: x,
				top: y
			});
		};
	},

	//undefined placing is treated as translate3d
	_: function () {
		this.getCoords  = function () {
			return getTranslate(this.element) || [0,0];
		};

		this.move = function (x, y) {
			x = round(x, this.precition);
			y = round(y, this.precition);
			css(this.element, 'transform', ['translate3d(', x, 'px,', y, 'px, 0)'].join(''));
		};
	}
};



/** Callbacks */
// drag: undefined,
// dragstart: undefined,
// dragend: undefined,
// dragrelease: undefined


/** Track movement */
function track (target, e) {
	var params = this.dragparams;

	var now = +new Date;
	var elapsed = now - params.timestamp;

	//get delta movement since the last track
	var deltaX = params.prevClientX - params.frame[0];
	var deltaY = params.prevClientY - params.frame[1];
	params.frame[0] = params.prevClientX;
	params.frame[1] = params.prevClientY;

	var delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

	//get speec (prevent div by zero)
	var v = this.velocity * delta / (1 + elapsed);
	params.currentVelocity = 0.6 * v + 0.4 * params.currentVelocity;

	//get angle
	params.angle = 0.7 * Math.atan2(deltaY, deltaX) + 0.2 * params.angle + 0.1 * Math.atan2(params.frame[0] - params.initClientX, params.frame[1] - params.initClientY);
}



/**
 * Restricting container
 * @type {Element|object}
 * @default doc.documentElement
 */
proto.within = doc;


/**
 * Which area of draggable should not be outside the restriction area.
 * @type {(Array|number)}
 * @default [0,0,this.element.offsetWidth, this.element.offsetHeight]
 */
Object.defineProperty(proto, 'pin', {
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


/**
 * Initial drag ignore area
 *
 * @type {(Array(4)|Array(2)|Function|number)}
 */
proto.threshold = [ 0, 0, 0, 0 ];


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
proto.axis = null;


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