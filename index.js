var Mod = window['Mod'] || require('mod-constructor');

var name = 'draggy';

var Draggy = module.exports = Mod({
	init: function(){
		//holder for params while drag
		this.dragparams = {};
	},
	created: function(){
		this.classList.add(name);
	},

	/**
	* Params
	*/
	within: {
		set: function(){

		}
	},

	x: {
		init: 0,
		set: function(value){
			//TODO: limit by `within` container
			value = between(value, 0, window.innerWidth)

			//snap to pixels
			return Math.round(value);
		},
		changed: function(value){
			if (this.freeze) return;

			css(this, {
				'transform': ['translate3d(', value, 'px,', this.y, 'px, 0)'].join('')
			});
		}
	},
	y: {
		init: 0,
		set: function(value){
			//TODO: limit by `within` container
			value = between(value, 0, window.innerHeight)

			//snap to pixels
			return Math.round(value);
		},
		changed: function(value){
			if (this.freeze) return;

			css(this, {
				'transform': ['translate3d(', this.x, 'px,', value, 'px, 0)'].join('')
			});
		}
	},


	/**
	 * How fast to move when released
	 *
	 * @True {number}
	 */

	velocity: 2000,


	/**
	 * For how long to release movement
	 */

	release: 1000,


	/**
	* State
	*/
	dragstate: {
		_: {
			before: function(){
			},
			'touchstart, mousedown': function(e){
				e.preventDefault();
				e.stopPropagation();

				//set initial position
				this.dragparams.x = xPos(e);
				this.dragparams.y = yPos(e);

				//set initial kinetic props
				this.dragparams.velocity = 0;
				this.dragparams.amplitude = 0;
				this.dragparams.angle = 0;
				this.dragparams.frame = [this.dragparams.x, this.dragparams.y];
				this.dragparams.timestamp = +new Date();

				this.dragstate = 'threshold';
			},

			track: noop
		},

		threshold: {
			before: function(){
				return 'drag';
			}
		},

		drag: {
			before: function(){
				this.emit('track');
			},

			//update position onmove
			'document touchmove, document mousemove': function(e){
				e.preventDefault();
				e.stopPropagation();

				var x = xPos(e),
					y = yPos(e),
					deltaX = x - this.dragparams.x,
					deltaY = y - this.dragparams.y;

				//set new position avoiding jittering
				// if (!isBetween(deltaX, -2, 2)) this.x += deltaX;
				// if (!isBetween(deltaX, -2, 2)) this.y += deltaY;
				this.x += deltaX;
				this.y += deltaY;

				//save dragparams for the next drag call
				this.dragparams.x = x;
				this.dragparams.y = y;

			},

			//track velocity
			track: function(){
				var params = this.dragparams;

				var now = +new Date;
				var elapsed = now - params.timestamp;

				//get delta movement since the last track
				var deltaX = params.x - params.frame[0];
				var deltaY = params.y - params.frame[1];
				params.frame[0] = params.x;
				params.frame[1] = params.y;

				var delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

				//get speec (prevent div by zero)
				var v = this.velocity * delta / (1 + elapsed);
				params.velocity = 0.7 * v + 0.3 * params.velocity;

				//get angle
				//TODO: smooth
				params.angle = Math.atan2(deltaY, deltaX);

				this.emit('track:after(20)');
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
				console.log('after')
				css(this, {
					'transition': null
				});

				//remove planned stopping
				this.off('stop');
			}
		}
	}
});

//SO THE TODOs
//TODO: make enot unbind planned asyncs: enot.emit('click:after(1000)'), enot.off('click')
//TODO: make css recognize 3-attributes params


//Maths
function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max)
}

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}

//precision round
function round(value, step) {
	step = parseFloat(step);
	if (step === 0) return value;
	value = Math.round(value / step) * step
	return parseFloat(value.toFixed(getPrecision(step)));
}

//get precision from float: 1.1 → 1, 1234 → 0, .1234 → 4
function getPrecision(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
}




/**
* ------------- Helpers
*/
function yPos(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientY;
	}

	// mouse event
	return e.clientY;
}
function xPos(e){
	// touch event
	if (e.targetTouches && (e.targetTouches.length >= 1)) {
		return e.targetTouches[0].clientX;
	}

	// mouse event
	return e.clientX;
}



function noop(){}