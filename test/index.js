describe("Draggy", function(){
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
		})
	});

	it("release", function(){
		var a = createDraggyCase("release", {
			release: 800
		})
	});

	it("pin area", function(){
		var a = createDraggyCase("pin area", {
			pin: [20,20,40,40]
		})
	})

	it("point picker", function(){
		var a = createDraggyCase("point picker", {
			pin: false,
			threshold: 0
		})
	})

	it("x", function(){
		createDraggyCase("x", {
			within: document,
			axis: 'x'
		})
	})

	it("y", function(){
		createDraggyCase("y", {
			within: document,
			axis: 'y'
		})
	})

	it("inner elements (carousel drag)", function(){
		var d = createDraggyCase("carousel", {
			axis: 'x'
		});
		d.classList.add('carousel');
	})

	it("handle", function(){
		xxx
	})

	it("circular", function(){
		xxx
		// createDraggyCase("circular")
	})

	it("threshold", function(){
		xxx
		// createDraggyCase("circular")
	})


	it("ghost", function(){
		xxx
	})

	it("drop areas", function(){
		xxx
	})

	it("loose limits", function(){
		xxx
	})

	it("sniper mode", function(){
		xxx
	})

	it("autoscroll", function(){
		xxx
	})



	function createDraggyCase(name, opts){
		//create container
		var el = document.createElement("div");
		el.title = name;
		el.className = "draggy-case";
		document.body.appendChild(el);

		//create mover
		var drEl = document.createElement("div");
		drEl.innerHTML = name;
		el.appendChild(drEl);

		new Draggy(drEl, opts);

		//create direction arrow
		var arr = document.createElement('div');
		arr.className = 'draggy-arrow';
		drEl.appendChild(arr);

		//bind listeners
		drEl.addEventListener('threshold', paintThreshold);
		drEl.addEventListener('dragstart', renderHelpers);
		drEl.addEventListener('drag', renderHelpers);
		drEl.addEventListener('dragend', clear);
		drEl.addEventListener('idle', clear);
		drEl.addEventListener('track', renderDirection);

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
		var $el = e.currentTarget;

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

		var pos = $el.getBoundingClientRect();

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

		var pos = $el.getBoundingClientRect();

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
		var $el = e.target;
		var $arr = $el.querySelector('.draggy-arrow');
		$arr.style.transform = 'rotate(' + $el.dragparams.angle + 'rad)';
		$arr.style.width = $el.dragparams.velocity * 10 + 'px';
	}


	function clear(){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}

})