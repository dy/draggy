/**
 * Draggy — a small, dependency-free draggable controller.
 *
 * The public API intentionally keeps the 2.x surface: `move`, `drag`,
 * `update`, `getCoords`, `setCoords`, `on`, `off`, and `destroy`.
 */

const defaults = {
	axis: null,
	cancel: null,
	css3: true,
	droppable: null,
	droppableClass: null,
	droppableTolerance: 0.5,
	framerate: 50,
	maxSpeed: 250,
	precision: 1,
	release: false,
	releaseDuration: 500,
	repeat: false,
	sniper: true,
	sniperSlowdown: 0.85,
	threshold: 0,
	velocity: 1000,
	within: null
};

export default class Draggable {
	static cache = new WeakMap();

	constructor(element, options = {}) {
		if (!element || typeof element.addEventListener !== 'function') {
			throw new TypeError('Draggy requires an Element');
		}

		const existing = Draggable.cache.get(element);
		if (existing && !existing.destroyed) {
			existing.configure(options);
			return existing;
		}

		this.element = element;
		this._events = new Map();
		this._handleBindings = [];
		this._documentBindings = [];
		this._selection = '';
		this.state = 'idle';
		this.destroyed = false;
		this.touchIdx = null;
		this.dropTarget = null;
		this._coords = readTranslate(element);
		this.prevX = this._coords[0];
		this.prevY = this._coords[1];
		this.initX = this.prevX;
		this.initY = this.prevY;
		this.deltaX = 0;
		this.deltaY = 0;
		this.movementX = 0;
		this.movementY = 0;

		Object.assign(this, defaults);
		this.configure(options, false);
		Draggable.cache.set(element, this);
		this.update();
		this._setState('idle');
	}

	configure(options = {}, update = true) {
		Object.assign(this, options);
		if (update && !this.destroyed) this.update();
		return this;
	}

	on(name, callback) {
		if (typeof callback !== 'function') throw new TypeError('Listener must be a function');
		const listeners = this._events.get(name) || new Set();
		listeners.add(callback);
		this._events.set(name, listeners);
		return this;
	}

	off(name, callback) {
		if (name === undefined) this._events.clear();
		else if (callback === undefined) this._events.delete(name);
		else this._events.get(name)?.delete(callback);
		return this;
	}

	_emit(name, detail) {
		for (const callback of this._events.get(name) || []) callback.call(this, detail);
		if (this.element?.dispatchEvent && typeof CustomEvent !== 'undefined') {
			this.element.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
		}
	}

	_setState(state) {
		if (!this.element || this.state === state && this.element.classList.contains(`draggy-${state}`)) return;
		for (const name of ['idle', 'threshold', 'drag', 'release']) {
			this.element.classList.toggle(`draggy-${name}`, name === state);
		}
		this.state = state;
		if (state === 'idle') this._emit('idle');
	}

	get threshold() { return this._threshold || [0, 0, 0, 0]; }
	set threshold(value) {
		if (typeof value === 'function') value = value();
		if (typeof value === 'number') this._threshold = [-value / 2, -value / 2, value / 2, value / 2];
		else if (Array.isArray(value) && value.length === 2) this._threshold = [-value[0] / 2, -value[1] / 2, value[0] / 2, value[1] / 2];
		else if (Array.isArray(value) && value.length === 4) this._threshold = value.slice();
		else this._threshold = [0, 0, 0, 0];
	}

	get pin() {
		if (this._pin) return this._pin;
		const rect = this.offsets || rectOf(this.element);
		return pinRect([0, 0, rect.width, rect.height]);
	}
	set pin(value) {
		if (value == null) this._pin = null;
		else if (typeof value === 'number') this._pin = pinRect([value, value, value, value]);
		else if (Array.isArray(value) && value.length === 2) this._pin = pinRect([value[0], value[1], value[0], value[1]]);
		else if (Array.isArray(value) && value.length === 4) this._pin = pinRect(value.slice());
		else throw new TypeError('pin must be a number or a 2/4 item array');
	}

	_resolve(value, scope = this.element.ownerDocument) {
		if (!value) return [];
		if (typeof value === 'string') return [...scope.querySelectorAll(value)];
		if (typeof value.addEventListener === 'function') return [value];
		if (typeof value[Symbol.iterator] === 'function') return [...value].flatMap(item => this._resolve(item, scope));
		return [];
	}

	update(event) {
		if (this.destroyed) return this;
		for (const [handle, type, listener] of this._handleBindings) handle.removeEventListener(type, listener);
		this._handleBindings = [];
		const handles = this._resolve(this.handle || this.element);
		for (const handle of handles) {
			const listener = e => this._start(e);
			handle.addEventListener('pointerdown', listener);
			this._handleBindings.push([handle, 'pointerdown', listener]);
		}
		this.currentHandles = handles;
		this.updateLimits();
		if (event) this._prime(event);
		return this;
	}

	updateLimits() {
		const [x, y] = this.getCoords();
		this.prevX = x;
		this.prevY = y;
		const own = rectOf(this.element);
		this.offsets = own;
		const container = this.within === 'parent' || this.within === true
			? this.element.parentElement
			: this.within;
		const boundary = container && container !== this.element.ownerDocument
			? rectOf(container)
			: viewportRect(this.element.ownerDocument);
		this.withinOffsets = boundary;
		const pin = this.pin;
		const baseLeft = own.left - x;
		const baseTop = own.top - y;
		this.limits = {
			left: boundary.left - baseLeft - pin[0],
			top: boundary.top - baseTop - pin[1],
			right: boundary.right - baseLeft - pin[2],
			bottom: boundary.bottom - baseTop - pin[3]
		};
		return this;
	}

	_start(event) {
		if (this.destroyed || event.button > 0 || this._isCancelled(event.target)) return;
		this._finishRelease();
		this.updateLimits();
		this._prime(event);
		this.pointerId = event.pointerId;
		this.element.setPointerCapture?.(event.pointerId);
		this._bindDocument('pointermove', e => this._pointerMove(e));
		this._bindDocument('pointerup', e => this._end(e));
		this._bindDocument('pointercancel', e => this._end(e));
		this._setState(isZero(this.threshold) ? 'drag' : 'threshold');
		if (this.state === 'drag') this._beginDrag();
		event.preventDefault?.();
	}

	_prime(event) {
		const point = eventPoint(event);
		const rect = rectOf(this.element);
		this.startClientX = this.prevMouseX = point.x;
		this.startClientY = this.prevMouseY = point.y;
		this.innerOffsetX = point.x - rect.left;
		this.innerOffsetY = point.y - rect.top;
		this.initX = this.prevX;
		this.initY = this.prevY;
		this.sniperOffsetX = 0;
		this.sniperOffsetY = 0;
		this.speed = 0;
		this.angle = 0;
		this.timestamp = Date.now();
	}

	_pointerMove(event) {
		if (event.pointerId !== undefined && this.pointerId !== undefined && event.pointerId !== this.pointerId) return;
		const point = eventPoint(event);
		if (this.state === 'threshold') {
			const dx = point.x - this.startClientX;
			const dy = point.y - this.startClientY;
			const t = this.threshold;
			if (dx >= t[0] && dx <= t[2] && dy >= t[1] && dy <= t[3]) return;
			this._beginDrag();
		}
		if (this.state === 'drag') this.drag(event);
	}

	_beginDrag() {
		this._setState('drag');
		this._selection = this.element.ownerDocument.documentElement.style.userSelect;
		this.element.ownerDocument.documentElement.style.userSelect = 'none';
		this._emit('dragstart');
	}

	drag(event) {
		if (!event) return this;
		const point = eventPoint(event);
		const dx = point.x - this.prevMouseX;
		const dy = point.y - this.prevMouseY;
		if (this.sniper && (event.ctrlKey || event.metaKey)) {
			this.sniperOffsetX += dx * this.sniperSlowdown;
			this.sniperOffsetY += dy * this.sniperSlowdown;
		}
		const now = Date.now();
		const elapsed = Math.max(1, now - this.timestamp);
		this.speed = Math.min(Math.hypot(dx, dy) / elapsed * this.velocity, this.maxSpeed);
		this.angle = Math.atan2(dy, dx);
		this.timestamp = now;
		this.prevMouseX = point.x;
		this.prevMouseY = point.y;
		this.ctrlKey = !!event.ctrlKey;
		this.shiftKey = !!event.shiftKey;
		this.metaKey = !!event.metaKey;
		this.altKey = !!event.altKey;
		this.move(
			this.initX + point.x - this.startClientX - this.sniperOffsetX,
			this.initY + point.y - this.startClientY - this.sniperOffsetY
		);
		this._checkDrops();
		this._emit('drag');
		event.preventDefault?.();
		return this;
	}

	_end(event) {
		if (event.pointerId !== undefined && this.pointerId !== undefined && event.pointerId !== this.pointerId) return;
		this._unbindDocument();
		this.element.ownerDocument.documentElement.style.userSelect = this._selection;
		if (this.state === 'drag') {
			this._emit('release');
			this._finishDrop();
			if (this.release && this.speed > 1) this._release();
			else this._finishDrag();
		} else this._setState('idle');
		this.pointerId = undefined;
	}

	_release() {
		this._setState('release');
		this.element.style.transition = `${this.releaseDuration}ms ease-out ${this.css3 ? 'transform' : 'left, top'}`;
		this.move(
			this.prevX + this.speed * Math.cos(this.angle),
			this.prevY + this.speed * Math.sin(this.angle)
		);
		this._emit('track');
		this._releaseTimer = setTimeout(() => this._finishDrag(), this.releaseDuration);
	}

	_finishRelease() {
		clearTimeout(this._releaseTimer);
		if (this.element) this.element.style.transition = '';
	}

	_finishDrag() {
		this._finishRelease();
		this._emit('dragend');
		this._setState('idle');
	}

	_bindDocument(type, listener) {
		const document = this.element.ownerDocument;
		document.addEventListener(type, listener, { passive: false });
		this._documentBindings.push([type, listener]);
	}

	_unbindDocument() {
		const document = this.element?.ownerDocument;
		if (document) for (const [type, listener] of this._documentBindings) document.removeEventListener(type, listener);
		this._documentBindings = [];
	}

	_isCancelled(target) {
		return this._resolve(this.cancel).some(element => element === target || element.contains(target));
	}

	move(x = this.prevX, y = this.prevY) {
		const limits = this.limits || { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
		if (this.axis === 'x') y = this.prevY;
		if (this.axis === 'y') x = this.prevX;
		if (this.repeat === true || this.repeat === 'both' || this.repeat === 'x') x = wrap(x, limits.left, limits.right);
		else x = clamp(x, limits.left, limits.right);
		if (this.repeat === true || this.repeat === 'both' || this.repeat === 'y') y = wrap(y, limits.top, limits.bottom);
		else y = clamp(y, limits.top, limits.bottom);
		this.setCoords(x, y);
		return this;
	}

	getCoords() {
		if (!this.css3) return [number(this.element.style.left), number(this.element.style.top)];
		return readTranslate(this.element);
	}

	setCoords(x = this.prevX, y = this.prevY) {
		x = round(x, this.precision);
		y = round(y, this.precision);
		this.deltaX = x - this.prevX;
		this.deltaY = y - this.prevY;
		this.prevX = x;
		this.prevY = y;
		this.movementX = x - this.initX;
		this.movementY = y - this.initY;
		this._coords = [x, y];
		if (this.css3) this.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
		else {
			this.element.style.position = 'absolute';
			this.element.style.left = `${x}px`;
			this.element.style.top = `${y}px`;
		}
		return this;
	}

	_checkDrops() {
		const targets = this._resolve(this.droppable);
		const next = targets.find(target => intersects(rectOf(this.element), rectOf(target), this.droppableTolerance)) || null;
		if (next === this.dropTarget) return;
		if (this.dropTarget) {
			if (this.droppableClass) this.dropTarget.classList.remove(this.droppableClass);
			this._emit('dragout', this.dropTarget);
			emitElement(this.dropTarget, 'dragout', this);
		}
		this.dropTarget = next;
		if (next) {
			if (this.droppableClass) next.classList.add(this.droppableClass);
			this._emit('dragover', next);
			emitElement(next, 'dragover', this);
		}
	}

	_finishDrop() {
		if (!this.dropTarget) return;
		const target = this.dropTarget;
		if (this.droppableClass) target.classList.remove(this.droppableClass);
		this._emit('drop', target);
		emitElement(target, 'drop', this);
		this.dropTarget = null;
	}

	destroy() {
		if (this.destroyed) return;
		this._unbindDocument();
		for (const [handle, type, listener] of this._handleBindings) handle.removeEventListener(type, listener);
		this._handleBindings = [];
		this._finishRelease();
		for (const name of ['idle', 'threshold', 'drag', 'release']) this.element.classList.remove(`draggy-${name}`);
		Draggable.cache.delete(this.element);
		this._events.clear();
		this.destroyed = true;
	}
}

function eventPoint(event) {
	const touch = event.touches?.[0] || event.changedTouches?.[0];
	return { x: touch?.clientX ?? event.clientX ?? 0, y: touch?.clientY ?? event.clientY ?? 0 };
}

function rectOf(element) {
	const rect = element.getBoundingClientRect();
	const width = rect.width ?? rect.right - rect.left;
	const height = rect.height ?? rect.bottom - rect.top;
	return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width, height };
}

function viewportRect(document) {
	const width = document.documentElement.clientWidth || globalThis.innerWidth || 0;
	const height = document.documentElement.clientHeight || globalThis.innerHeight || 0;
	return { left: 0, top: 0, right: width, bottom: height, width, height };
}

function pinRect(values) {
	values.width = values[2] - values[0];
	values.height = values[3] - values[1];
	return values;
}

function readTranslate(element) {
	const match = /translate(?:3d)?\s*\(\s*(-?[\d.]+)px(?:\s*,|\s+)\s*(-?[\d.]+)px/.exec(element.style.transform || '');
	return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

function number(value) { return Number.parseFloat(value) || 0; }
function clamp(value, min, max) { return min > max ? (min + max) / 2 : Math.max(min, Math.min(value, max)); }
function wrap(value, min, max) {
	const size = max - min;
	return Number.isFinite(size) && size > 0 ? ((value - min) % size + size) % size + min : min;
}
function round(value, step) {
	if (step === 0) return value;
	step = Number(step) || 1;
	return Number((Math.round(value / step) * step).toFixed(decimalPlaces(step)));
}
function decimalPlaces(value) { return (String(value).split('.')[1] || '').length; }
function isZero(values) { return values.every(value => value === 0); }
function intersects(a, b, tolerance) {
	const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
		* Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
	const smaller = Math.min(a.width * a.height, b.width * b.height);
	return smaller > 0 && overlap > 0 && overlap / smaller >= tolerance;
}
function emitElement(element, name, detail) {
	if (typeof CustomEvent !== 'undefined') element.dispatchEvent(new CustomEvent(name, { detail }));
}
