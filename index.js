var Mod = window['Mod'] || require('mod-constructor');
var type = require('mutypes');
var css = require('mucss');

var name = 'draggy',
	win = window,
	doc = document,
	root = doc.documentElement;


/**
 * Draggy mod - makes any element draggable
 *
 * @module draggy
 * @constructor
 *
 * @return {Element} Target element
 */

var Draggy = module.exports = Mod({



/* ------------------------------------ I N I T -------------------------------------- */


	init: function(){
		//holder for params while drag
		this.dragparams = {};
	},


	created: function(){
		this.classList.add(name);
	},



/* ---------------------------------- O P T I O N S ---------------------------------- */


	/** Restricting container
	 * @type {Element|object}
	 * @default this.parentNode
	 */
	within: {
		init: function(init){
			return init || this.parentNode || win;
		},
		set: function(within){
			//TODO: think of utilizing parseTarget there (expose enot’s parsing utils)
			if (type.isElement(within)){
				return within;
			} else if (isString(within)){
				return doc.querySelector(within);
			} else {
				return root;
			}
		}
	},


	/** Which area of draggable should not be outside the restriction area
	 *
	 * @default this
	 */
	pin: {
		set: function(value){
			// console.log("pin changed", value)
			if (isArray(value)){
				if (value.length === 2){
					return [value[0], value[1], value[0], value[1]];
				} else if (value.length === 4){
					return value;
				}
			}

			return value;
		}
	},


	/** Draggable/droppable match identifier */
	group: null,


	/** Clone object for dragging */
	ghost: false,


	/** How fast to move when released
	 */
	velocity: 2000,
	maxVelocity: 100,


	/** For how long to release movement
	 *
	 * @type {(number|false)}
	 * @default false
	 * @todo
	 */
	release: false,


	/** Initial drag ignore area
	 *
	 * @type {(Array(4)|Array(2)|Function|number)}
	 */
	threshold: {
		init: 12,

		//return array[x,y,x,y]
		get: function(val){
			if (isFn(val)){
				return val();
			} else {
				return val;
			}
		},

		set: function(val){
			if (type.isNumber(val)){
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
		}
	},


	/** Autoscroll on reaching the border of the screen */
	autoscroll: false,


	/** To what extent round position */
	precision: 1,


	/** slow down movement by pressing ctrl/cmd */
	sniper: true,


	/** how much is slower sniper drag */
	sniperSpeed: .15,


	/** Restrict movement by axis
	 *
	 * @default undefined
	 * @enum {string}
	 */
	axis: {
		x: {
			//ignore setting y
			y: {
				set: function(){
					return 0;
				}
			}
			// threshold: {
			// 	get: function(val){
			// 		val = Draggable.fn.threshold.get(val);
			// 		val[1] = -9999;
			// 		val[3] = 9999;
			// 		return val;
			// 	}
			// }
		},
		y: {
			x: {
				//ignore setting x
				set: function(){
					return 0;
				}
			}
			// threshold: {
			// 	get: function(val){
			// 		val = Draggable.fn.threshold.get(val);
			// 		val[0] = -9999;
			// 		val[2] = 9999;
			// 		return val;
			// 	}
			// }
		},
		_: {

		}
	},


	/** Repeat position by one of axis
	 * @enum {string}
	 * @default undefined
	 */
	repeat: {
		undefined: null,
		both: null,
		x: null,
		y: null,
		_: function(){
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
	},


	/** Hide cursor on drag (reduce clutter) */
	hideCursor: false,


/* ------------------------------------- W O R K ------------------------------------- */


	/**
	 * Position
	 */

	x: {
		init: 0,
		set: function(value){
			var limits = this.limits;

			value = between(value, limits.left, limits.right);

			//snap to pixels
			return Math.round(value);
		},
		changed: function(value){
			if (this.freeze) return;

			css(this,
				'transform',
				['translate3d(', value, 'px,', this.y, 'px, 0)'].join(''));
		}
	},
	y: {
		init: 0,
		set: function(value){
			var limits = this.limits;

			value = between(value, limits.top, limits.bottom);

			//snap to pixels
			return Math.round(value);
		},
		changed: function(value){
			if (this.freeze) return;

			css(this,
				'transform',
				['translate3d(', this.x, 'px,', value, 'px, 0)'].join(''));
		}
	},


	/** Ignore position change */
	freeze: false,


	/**
	 * Main drag properties holder
	 */
	dragparams: {
		init: function(){
			return {
				//initial offset from the `within` in 0-position
				initOffsetX: 0,
				initOffsetY: 0,

				//click offsets
				innerOffsetX: 0,
				innerOffsetY: 0,

				//previous position on the screen
				prevClientX: 0,
				prevClientY: 0,

				//tracking params
				velocity: 0,
				angle: 0,
				//[clientX, clientY] for the last track
				frame: undefined,
				timestamp: undefined,
			};
		}
	},


	/**
	 * Limits representing current drag area
	 *
	 * @type {Object}
	 * @todo  make it work
	 */
	limits: {
		init: function(){
			return {top:0, bottom:0, left: 0, right:0};
		},

		/** Set limits based on passed element */
		set: function(limitEl){
			if (!type.isElement(limitEl)) return limitEl;

			var paddings = css.paddings(limitEl);
			var pin = this.pin;

			//TODO: calc moving limits based on restriction area & viewport
			//TODO: set this area before drag, not in get
			var containerOffsets = css.offsets(limitEl);
			var selfOffsets = css.offsets(this);

			//initial offsets from the `limitEl`, 0-translation:
			var initOffsetX = this.dragparams.initOffsetX = selfOffsets.left - containerOffsets.left - this.x;
			var initOffsetY = this.dragparams.initOffsetY = selfOffsets.top - containerOffsets.top - this.y;

			//calc offsets limitEl restriction container, including translation
			var height = this.offsetHeight,
				width = this.offsetWidth;
			return {
				left: -pin[0] - initOffsetX + paddings.left,
				top: -pin[1] - initOffsetY + paddings.top,
				right: - initOffsetX + limitEl.offsetWidth - width - paddings.right + (width - pin[2]),
				bottom: - initOffsetY + limitEl.offsetHeight - height - paddings.bottom + (height - pin[3])
			};
		}
	},


	/**
	* State of drag.
	* @enum {string}
	* @default is 'idle'
	*/
	dragstate: {
		/** idle state */
		_: {
			before: function(){
				this.emit('idle');

				//enable document interavtivity
				css.disableSelection(root);
				if (this.hideCursor) css(root, {"cursor": null});
			},
			'touchstart, mousedown': function(e){
				e.preventDefault();
				e.stopPropagation();

				//set pin once the first drag happens
				if (!this.pin) this.pin = [0,0,this.offsetWidth, this.offsetHeight];

				//prepare limits for drag session
				this.limits = this.within;

				var params = this.dragparams;

				//set initial position - have to go after updating limits
				params.prevClientX = clientX(e);
				params.prevClientY = clientY(e);

				//measure initial inner offset
				params.innerOffsetX = e.pageX - params.initOffsetX - this.x;
				params.innerOffsetY = e.pageY - params.initOffsetY - this.y;

				//set initial client x & y
				params.initClientX = params.prevClientX;
				params.initClientY = params.prevClientY;

				this.dragstate = 'threshold';
			},

			/** Track kinetic movement */
			track: function(){
				var params = this.dragparams;

				//set initial kinetic props
				params.velocity = 0;
				params.amplitude = 0;
				params.angle = 0;
				params.frame = [params.prevClientX, params.prevClientY];
				params.timestamp = +new Date();
				this.emit('track:defer');
			},

			after: function(){
				//init tracking, if release defined
				this.release && this.track();
			}
		},

		'threshold, drag': {
			//track velocity
			track: function(){
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
				params.velocity = 0.6 * v + 0.4 * params.velocity;

				//get angle
				params.angle = 0.7 * Math.atan2(deltaY, deltaX) + 0.2 * params.angle + 0.1 * Math.atan2(params.frame[0] - params.initClientX, params.frame[1] - params.initClientY);
				this.emit('track:after(20)');
			}
		},

		threshold: {
			before: function(){
				this.emit('threshold');
				return 'drag';
			},

			after: function(){
				//reduce dragging clutter
				css.enableSelection(root);
				if (this.hideCursor) css(root, {"cursor": "none"});
			}
		},

		drag: {
			before: function(){
				this.emit('dragstart');
			},

			//update position onmove
			'document touchmove, document mousemove': function(e){
				e.preventDefault();
				e.stopPropagation();

				var params = this.dragparams;

				var x = clientX(e),
					y = clientY(e),
					deltaX = x - params.prevClientX,
					deltaY = y - params.prevClientY;

				//set new position avoiding jittering
				// if (!isBetween(deltaX, -2, 2)) this.x += deltaX;
				// if (!isBetween(deltaX, -2, 2)) this.y += deltaY;
				//TODO: calc this statically, ignore difs (only for sniper mode)
				// this.x += deltaX;
				// this.y += deltaY;
				this.x = x + win.pageXOffset - params.initOffsetX - params.innerOffsetX;
				this.y = y + win.pageYOffset - params.initOffsetY - params.innerOffsetY;


				//save dragparams for the next drag call
				params.prevClientX = x;
				params.prevClientY = y;

				//emit drag
				this.emit('drag');
			},

			//stop drag onleave
			'document touchend, document mouseup, document mouseleave': function(e){
				e.preventDefault();
				e.stopPropagation();


				if (this.dragparams.velocity > 1) {
					this.dragstate = 'release';
					return;
				}

				this.dragstate = 'idle';
			},

			after: function(){
				this.emit('dragend');
			}
		},

		//inertional moving
		release: {
			before: function(){
				css(this, {
					'transition': this.release + 'ms ease-out transform'
				});
				var params = this.dragparams;

				//calc target point & animate to it
				this.x += params.velocity * Math.cos(params.angle);
				this.y += params.velocity * Math.sin(params.angle);

				//release release after 1ms (animation)
				this.emit('stop:after(' + this.release + ')');
			},

			//stop movement
			stop: function (){
				this.dragstate = 'idle';
			},

			after: function(){
				css(this, {
					'transition': null
				});

				//remove planned stopping
				this.off('stop');
			}
		}
	},


	/** update position on resize */
	'window resize': 'update'
});



/* ---------------------------------- H E L P E R S ---------------------------------- */


/**
 * Clamper
 *
 * @param {number} a Current value to cut off
 * @param {number} min Left limit
 * @param {number} max Right limit
 *
 * @return {number} Clamped value
 *
 * @todo: replace with mumath
 */

function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max)
}

/**
 * Whether element is between left & right including
 *
 * @param {number} a
 * @param {number} left
 * @param {number} right
 *
 * @return {Boolean}
 */

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}


/**
 * Precision round
 *
 * @param {number} value
 * @param {number} step Minimal discrete to round
 *
 * @return {number}
 *
 * @example
 * round(213.34, 1) == 213
 * round(213.34, .1) == 213.3
 * round(213.34, 10) == 210
 */

function round(value, step) {
	step = parseFloat(step);
	if (step === 0) return value;
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(getPrecision(step)));
}


/**
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

function getPrecision(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
}


/**
 * get clientY/clientY from event
 *
 * @param {Event} e Event raised, like mousemove
 *
 * @return {number} Coordinate relative to the screen
 */

function clientY(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientY;
	}

	// mouse event
	return e.clientY;
}
function clientX(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientX;
	}

	// mouse event
	return e.clientX;
}


/**
 * The most complicated function is the JS
 */

function noop(){}