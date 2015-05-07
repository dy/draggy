var Draggy = require('draggy');
var css = require('mucss');

var body = document.body;


describe("Functionality", function () {
	var canvas = document.createElement('canvas');
	canvas.className = 'painter-canvas';
	body.appendChild(canvas);
	var ctx = canvas.getContext("2d");
	canvas.width  = window.innerWidth;
	canvas.height = window.innerHeight;


	it("plain", function () {
		var a = createDraggyCase("plain", {
		});
	});

	it("within", function () {
		var a = createDraggyCase("within parent", {
			within: 'parent'
		});
	});

	it("threshold", function () {
		var d = createDraggyCase("threshold", {
			threshold: 20,
			within: 'parent'
		});
	});

	it("release", function () {
		var a = createDraggyCase("release", {
			release: true,
			within: 'parent'
		});
	});

	it("pin area", function () {
		var a = createDraggyCase("pin area", {
			pin: [20,20,50,50],
			within: 'parent'
		});
	});

	it("point picker", function () {
		var a = createDraggyCase("point picker", {
			pin: [30,30],
			threshold: 0,
			within: 'parent'
		});
	});

	it("repeat", function () {
		var a = createDraggyCase("repeat", {
			repeat: true,
			within: 'parent',
			pin: [10,20,30,40]
		});
	});

	it("x", function () {
		createDraggyCase("x", {
			axis: 'x'
		});
	});

	it("y", function () {
		createDraggyCase("y", {
			axis: 'y'
		});
	});

	it("carousel", function () {
		var d = createDraggyCase("carousel", {
			axis: 'x',
			within: 'parent'
		});
		d.classList.add('carousel');
		d.parentNode.classList.add('carousel-case');
	});

	it("multitouch", function () {
		var d = createDraggyCase("multi", {
			within: 'parent',
			release: true
		});
		d.parentNode.classList.add('multitouch');

		//create second mover
		var drEl = document.createElement("div");
		drEl.innerHTML = 'touch';
		drEl.className = 'draggy';
		d.parentNode.appendChild(drEl);

		var draggy = new Draggy(drEl, {
			within: d.parentNode,
			release: true
		});
		css(drEl, 'top', 100);
	});

	it.skip("handle", function () {

	});

	it.skip("grid", function () {

	});

	it.skip("circular", function () {
		// createDraggyCase("circular")
	});

	it.skip("drop areas", function () {

	});

	it.skip("loose limits", function () {

	});

	it.skip("sniper mode", function () {

	});

	it.skip("autoscroll", function () {

	});



	/** Create test case */
	function createDraggyCase(name, opts) {
		//create container
		var el = document.createElement("div");
		el.title = name;
		el.className = "draggy-case";
		body.appendChild(el);

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
	function renderHelpers() {
		clear();
		try{
			ctx.setLineDash([7,4]);
		} catch (e) {}
		paintRestrictionArea(this);
		paintPinRect(this);
	}


	function paintRestrictionArea(el) {
		var within = el.within;

		if (!within || within === document) return;

		var pos = within.getBoundingClientRect(),
			pads = new css.Rect//css.paddings(within);

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


	function paintThreshold(e) {
		var el = this.element, d = this;

		clear();

		var rect = d.threshold,
			offsetX = d.innerOffsetX,
			offsetY = d.innerOffsetY;

		if (typeof rect === "number") {
			//number
			rect = [-rect*.5, -rect*.5, rect*.5, rect*.5]
		} else if (rect.length === 2) {
			//Array(w,h)
			rect = [-rect[0] *.5, -rect[1] *.5, rect[0] *.5, rect[1] *.5]
		} else if(rect.length === 4) {
			//Array(x1,y1,x2,y2)
			rect = rect.slice();
		} else if (typeof rect === "function") {
			//custom rect funciton
			return;
		}

		rect[2] += 1;
		rect[3] += 1;

		var pos = el.getBoundingClientRect();

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


	function paintPinRect(el) {
		var pin = el.pin.slice();
		pin[2] += 1;
		pin[3] += 1;

		var pos = el.element.getBoundingClientRect();

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

	function renderDirection (e) {
		var el = this.element;
		var arrEl = el.querySelector('.draggy-arrow');
		arrEl.style.transform = 'rotate(' + this.angle + 'rad)';
		arrEl.style.width = this.speed * 10 + 'px';
	}


	function clear() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
});