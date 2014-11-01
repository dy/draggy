var assert = require('chai').assert;

describe("Functionality", function(){
	var canvas = document.querySelector('.painter-canvas');
	var ctx = canvas.getContext("2d");
	canvas.width  = window.innerWidth;
	canvas.height = window.innerHeight;


	it("plain", function(){
		var a = createDraggyCase("plain");
	});

	it("within", function(){
		var a = createDraggyCase("within doc", {
			within: document
		});
	});

	it("release", function(){
		var a = createDraggyCase("release", {
			release: 800
		});
	});

	it("pin area", function(){
		var a = createDraggyCase("pin area", {
			pin: [20,20,40,40]
		});
	});

	it("point picker", function(){
		var a = createDraggyCase("point picker", {
			pin: [30,30],
			threshold: 0
		});
	});

	it("x", function(){
		createDraggyCase("x", {
			within: document,
			axis: 'x'
		});
	});

	it("y", function(){
		createDraggyCase("y", {
			within: document,
			axis: 'y'
		});
	});

	it("inner elements (carousel drag)", function(){
		var d = createDraggyCase("carousel", {
			axis: 'x'
		});
		d.classList.add('carousel');
	});

	it.skip("handle", function(){

	});

	it.skip("circular", function(){

		// createDraggyCase("circular")
	});

	it("threshold", function(){
		var d = createDraggyCase("threshold", {
			threshold: 20
		});
	});


	it.skip("ghost", function(){

	});

	it.skip("drop areas", function(){

	});

	it.skip("loose limits", function(){

	});

	it.skip("sniper mode", function(){

	});

	it.skip("autoscroll", function(){

	});



	function createDraggyCase(name, opts){
		//create container
		var el = document.createElement("div");
		el.title = name;
		el.className = "draggy-case";
		document.body.appendChild(el);

		//create mover
		var drEl = document.createElement("div");
		drEl.innerHTML = name;
		drEl.className = 'draggy';
		el.appendChild(drEl);

		var draggy = new Draggy(drEl, opts);

		//create direction arrow
		var arr = document.createElement('div');
		arr.className = 'draggy-arrow';
		drEl.appendChild(arr);

		//bind listeners
		draggy.on('threshold', paintThreshold);
		draggy.on('dragstart', renderHelpers);
		draggy.on('drag', renderHelpers);
		draggy.on('dragend', clear);
		draggy.on('idle', clear);
		draggy.on('track', renderDirection);

		return drEl;
	}


	//canvas painters
	function renderHelpers(){
		clear();
		try{
			ctx.setLineDash([7,4]);
		} catch (e){}
		paintRestrictionArea(this);
		paintPinRect(this);
	}


	function paintRestrictionArea($el){
		var $within = $el.within;

		var pos = $within.getBoundingClientRect(),
			pads = css.paddings($within);

		ctx.strokeStyle = 'rgba(60,60,60,1)';
		ctx.lineWidth = 1;

		ctx.beginPath();
		ctx.moveTo(pos.left + pads.left, pos.top + pads.top);
		ctx.lineTo(pos.right - pads.right, pos.top + pads.top);
		ctx.lineTo(pos.right - pads.right, pos.bottom - pads.bottom);
		ctx.lineTo(pos.left + pads.left, pos.bottom - pads.bottom);
		ctx.lineTo(pos.left + pads.left, pos.top + pads.top);
		ctx.stroke();
	}


	function paintThreshold(e){
		var $el = this;

		clear();

		var rect = $el.threshold,
			d = $el.dragparams,
			offsetX = d.x,
			offsetY = d.x;

		if (typeof rect === "number"){
			//number
			rect = [-rect*.5, -rect*.5, rect*.5, rect*.5]
		} else if (rect.length === 2){
			//Array(w,h)
			rect = [-rect[0] *.5, -rect[1] *.5, rect[0] *.5, rect[1] *.5]
		} else if(rect.length === 4){
			//Array(x1,y1,x2,y2)
			rect = rect.slice();
		} else if (typeof rect === "function"){
			//custom rect funciton
			return;
		}

		rect[2] += 1
		rect[3] += 1

		var pos = $el.element.getBoundingClientRect();

		ctx.strokeStyle = 'rgba(60,180,250,1)';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[1]);
		ctx.lineTo(pos.left + offsetX + rect[2], pos.top + offsetY + rect[1]);
		ctx.lineTo(pos.left + offsetX + rect[2], pos.top + offsetY + rect[3]);
		ctx.lineTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[3]);
		ctx.lineTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[1]);
		ctx.stroke();
	}


	function paintPinRect($el){
		var pin = $el.pin.slice();
		pin[2] += 1;
		pin[3] += 1;

		var pos = $el.element.getBoundingClientRect();

		ctx.strokeStyle = 'rgba(60,250,60,1)';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(pos.left + pin[0], pos.top + pin[1]);
		ctx.lineTo(pos.left + pin[2], pos.top + pin[1]);
		ctx.lineTo(pos.left + pin[2], pos.top + pin[3]);
		ctx.lineTo(pos.left + pin[0], pos.top + pin[3]);
		ctx.lineTo(pos.left + pin[0], pos.top + pin[1]);
		ctx.stroke();
	}

	function renderDirection(e){
		// var $el = e.target;
		// var $arr = $el.querySelector('.draggy-arrow');
		// $arr.style.transform = 'rotate(' + $el.dragparams.angle + 'rad)';
		// $arr.style.width = $el.dragparams.velocity * 10 + 'px';
	}


	function clear(){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
});



describe('Special cases', function(){
	it.skip('Make limits & API available for draggies in content', function(){
		var div = document.createElement('div');
		div.style.width = '10px';
		div.style.height = '10px';
		div.style.background = 'red';
		document.body.appendChild(div);

		var dr = new Draggy(div);

		dr.x = 20;
		dr.y = 20;

		assert.notEqual(dr.limits.right,0);
	});

	it('Within=null should not decry any constraint', function(){
		xxx
	});


});