var Mod = require('mod-constructor');

var Draggy = module.exports = Mod({
	name: 'movy',

	init: function(){
		//holder for params while drag
		this.dragparams = {};
	},

	/**
	* Events
	*/
	'touchstart, mousedown': function(e){
		e.preventDefault();
		e.stopPropagation();

		this.dragparams.x = xPos(e);
		this.dragparams.y = yPos(e);

		this.dragstate = 'threshold';
	},
	'touchmove, mousemove': function(e){
		e.preventDefault();
		e.stopPropagation();

		var x = this.xPos(e),
			y = this.yPos(e),
			deltaX = x - this.dragparams.x,
			deltaY = y - this.dragparams.y

		//prevent jittering due to micromovements
		if (isBetween(deltaX, -2, 2) && isBetween(deltaX, -2, 2)) return;

		//set new position
		this.x =

	},
	'touchend, mouseup': function(e){
		e.preventDefault();
		e.stopPropagation();

		this.dragstate = 'idle';
	},

	/**
	* Helpers
	*/

	//move to x,y position
	moveTo: function(x, y){
		css(this, "transform", ["translate3d(", x, "px,", y, "px, 0)"].join(""));
	},


	/**
	* State
	*/
	dragstate: {
		idle: {

		},

		threshold: {

		},

		drag: {

		}
	}
});


//Maths
funtion delta(a,b){
	xxx
}

function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max)
}

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}
→
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


//Helpers
//return position
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