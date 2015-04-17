/**
 * Simple draggable component
 *
 * @module draggy
 */

var css = require('mucss/css');
var selection = require('mucss/selection');
var getOffsets = require('mucss/offsets');
var getTranslate = require('mucss/translate');
var parseAttr = require('parse-attr/parse');
var on = require('emmy/on');
var off = require('emmy/off');
var emit = require('emmy/emit');
var isArray = require('is-array');
var isNumber = require('is-number');
var isFn = require('is-function');
var contains = require('contains');
var defineState = require('define-state');
var extend = require('xtend/mutable');
var Emitter = require('events');
var util = require('util');
var round = require('mumath/round');


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
var draggableCache = new WeakMap;



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
function Draggable(target, options){
	//save element passed
	this.element = target;
	draggableCache.set(target, this);

	//take over options
	extend(this, options);

	//parse attributes on a target, apply to instance
	var prop, parseResult;
	for (var propName in proto) {
		//parse attribute, if no option passed
		if (this[propName] === undefined) {
			parseResult = parseAttr(target, propName, proto[propName]);
			if (parseResult !== undefined) this[propName] = parseResult;
		}
	}

	//preset dragparams
	/*
	extend(this, {
		//initial offset from the `within` in 0-position
		initOffsetX: undefined,
		initOffsetY: undefined,

		//click offsets
		innerOffsetX: 0,
		innerOffsetY: 0,

		//dragstart initial client x and y
		initClientX: 0,
		initClientY: 0,

		//previous position on the screen
		prevClientX: 0,
		prevClientY: 0,

		//tracking params
		velocity: 0,
		angle: 0,

		//[clientX, clientY] for the last track
		frame: undefined,
		timestamp: undefined,

		//container absolute offsets
		containerOffsetX: 0,
		containerOffsetY: 0,

		//initial coords
		x: 0,
		y: 0
	});
	*/

	//init threshold
	this.threshold = (function (val) {
		if (isNumber(val)){
				return [-val*.5, -val*.5, val*.5, val*.5];
		} else if (val.length === 2){
			//Array(w,h)
			return [-val[0]*.5, -val[1]*.5, val[0]*.5, val[1]*.5];
		} else if(val.length === 4){
			//Array(x1,y1,x2,y2)
			return val;
		} else if (isFn(val)){
			//custom val funciton
			return val;
		} else {
			return [0,0,0,0];
		}
	})(this.threshold);


	//define mode of drag
	defineState(this, 'placingType', this.placingType);
	this.placingType = 'translate3d';


	//define state behaviour
	defineState(this, 'state', this.state);
	this.state = 'idle';
}


/** Inherit draggable from Emitter */
util.inherits(Draggable, Emitter);


var proto = Draggable.prototype;


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
proto.state = {
	//idle state
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


				var selfOffsets = getOffsets(this.element);

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
				// else if (self.state === 'threshold'){
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

				//initial translation offsets
				var initXY = getTranslate(self.element) || [0,0];

				//calc initial coords
				self.prevX = initXY[0];
				self.prevY = initXY[1];

				//get initial mouse position
				self.prevMouseX = getClientX(e);
				self.prevMouseY = getClientY(e);

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

				//calc movement diff
				var diffX = mouseX - self.prevMouseX,
					diffY = mouseY - self.prevMouseY;

				//calc new coords
				var x = self.prevX + diffX,
					y = self.prevY + diffY;

				self.move(x, y);

				//save prev coords to use as a start point
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


	//inertional moving
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
		this.move = function (x, y) {

		};
	},

	//undefined placing is treated as translate3d
	_: function () {
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
 * False value means center by the self rect
 * @type {(Array|number|false)}
 * @default this
 */
proto.pin = {
	set: function(value){
		if (isArray(value)){
			if (value.length === 2){
				return [value[0], value[1], value[0], value[1]];
			} else if (value.length === 4){
				return value;
			}
		}

		else if (isNumber(value)){
			return [value, value, value, value];
		}

		return value;
	},

	get: function(value){
		//return the whole size if no value defined
		if (!value)	return [0,0,this.element.offsetWidth, this.element.offsetHeight];

		return value;
	}
};


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
		if (this.repeat instanceof Array){
			if (this.repeat.length){
				if (this.repeat[0] && this.repeat[1])
					return "both";
				else if (this.repeat[0])
					return "x";
				else if (this.repeat[1])
					return "y";
			}

		//just repeat any possible way
		} else if (this.repeat === true){
			return this.axis

		//unrecognized value passed
		} else {
			return undefined;
		}
	}
};


/** Hide cursor on drag (reduce clutter) */
proto.hideCursor = false;


/**
 * Position
 */
// x: {
// 	init: 0,
// 	set: function(value){
// 		var limits = this.limits;
// 		value = m.between(value, limits.left, limits.right);
// 		//snap to pixels
// 		return Math.round(value);
// 	},
// 	changed: function(value, old){
// 		if (this.freeze) return;
// 		css(this.element,
// 			'transform',
// 			['translate3d(', value, 'px,', this.y, 'px, 0)'].join(''));
// 	}
// },
// y: {
// 	init: 0,
// 	set: function(value){
// 		var limits = this.limits;
// 		value = m.between(value, limits.top, limits.bottom);
// 		//snap to pixels
// 		return Math.round(value);
// 	},
// 	changed: function(value){
// 		if (this.freeze) return;
// 		css(this.element,
// 			'transform',
// 			['translate3d(', this.x, 'px,', value, 'px, 0)'].join(''));
// 	}
// },


/** Ignore position change */
proto.freeze = false;




/** ----------------- Helpers ---------------- */



/** Check whether arr is filled with zeros */
function isZeroArray(arr){
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}

/**
 * get clientY/clientY from event
 *
 * @param {Event} e Event raised, like mousemove
 *
 * @return {number} Coordinate relative to the screen
 */
function getClientY (e) {
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientY;
	}

	// mouse event
	return e.clientY;
}
function getClientX (e) {
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientX;
	}

	// mouse event
	return e.clientX;
}



module.exports = Draggable;