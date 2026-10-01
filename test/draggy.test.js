import assert from 'node:assert/strict';
import test from 'node:test';
import Draggable from '../draggy.js';

class FakeClassList {
	constructor() { this.names = new Set(); }
	add(name) { if (name) this.names.add(name); }
	remove(name) { if (name) this.names.delete(name); }
	contains(name) { return this.names.has(name); }
	toggle(name, force) { force ? this.add(name) : this.remove(name); }
}

class FakeTarget extends EventTarget {
	constructor(document, rect = { left: 0, top: 0, width: 50, height: 50 }) {
		super();
		this.ownerDocument = document;
		this.parentElement = null;
		this.children = [];
		this.style = {};
		this.classList = new FakeClassList();
		this.baseRect = rect;
	}
	append(element) { element.parentElement = this; this.children.push(element); }
	contains(element) { return element === this || this.children.some(child => child.contains(element)); }
	setPointerCapture() {}
	getBoundingClientRect() {
		const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(this.style.transform || '');
		const x = Number(match?.[1] || 0);
		const y = Number(match?.[2] || 0);
		const { left, top, width, height } = this.baseRect;
		return { left: left + x, top: top + y, right: left + x + width, bottom: top + y + height, width, height };
	}
}

class FakeDocument extends EventTarget {
	constructor() {
		super();
		this.documentElement = { clientWidth: 800, clientHeight: 600, style: {} };
		this.matches = new Map();
	}
	querySelectorAll(selector) { return this.matches.get(selector) || []; }
}

function fixture(options = {}) {
	const document = new FakeDocument();
	const container = new FakeTarget(document, { left: 0, top: 0, width: 300, height: 200 });
	const element = new FakeTarget(document, { left: 10, top: 20, width: 50, height: 40 });
	container.append(element);
	return { document, container, element, draggy: new Draggable(element, { within: 'parent', ...options }) };
}

function pointer(type, values) {
	const event = new Event(type, { cancelable: true });
	Object.assign(event, { button: 0, pointerId: 1, clientX: 0, clientY: 0, ...values });
	return event;
}

test('moves, rounds, and reports coordinates without dependencies', () => {
	const { draggy, element } = fixture({ precision: 0.5 });
	draggy.move(42.24, 35.76);
	assert.deepEqual(draggy.getCoords(), [42, 36]);
	assert.equal(element.style.transform, 'translate3d(42px, 36px, 0)');
	assert.deepEqual([draggy.deltaX, draggy.deltaY], [42, 36]);
});

test('constrains motion to the container and selected axis', () => {
	const { draggy } = fixture({ axis: 'x' });
	draggy.move(999, 100);
	assert.deepEqual(draggy.getCoords(), [240, 0]);
	draggy.axis = 'y';
	draggy.move(100, -999);
	assert.deepEqual(draggy.getCoords(), [240, -20]);
});

test('supports thresholded pointer dragging and lifecycle events', () => {
	const { document, element, draggy } = fixture({ threshold: 10 });
	const events = [];
	for (const name of ['dragstart', 'drag', 'release', 'dragend']) draggy.on(name, () => events.push(name));
	element.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 30 }));
	assert.equal(draggy.state, 'threshold');
	document.dispatchEvent(pointer('pointermove', { clientX: 23, clientY: 32 }));
	assert.equal(draggy.state, 'threshold');
	document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 60 }));
	document.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 60 }));
	assert.deepEqual(events, ['dragstart', 'drag', 'release', 'dragend']);
	assert.equal(draggy.state, 'idle');
	assert.deepEqual(draggy.getCoords(), [30, 30]);
});

test('honors handles, cancellation, and reuses an element controller', () => {
	const { document, element, container, draggy } = fixture();
	const handle = new FakeTarget(document);
	const cancel = new FakeTarget(document);
	handle.append(cancel);
	container.append(handle);
	draggy.configure({ handle, cancel });
	cancel.dispatchEvent(pointer('pointerdown'));
	assert.equal(draggy.state, 'idle');
	handle.dispatchEvent(pointer('pointerdown'));
	assert.equal(draggy.state, 'drag');
	assert.equal(new Draggable(element), draggy);
});

test('detects drop targets and cleans up listeners and cache', () => {
	const { document, element, draggy } = fixture({ droppable: '.target', droppableClass: 'active' });
	const target = new FakeTarget(document, { left: 100, top: 20, width: 60, height: 60 });
	document.matches.set('.target', [target]);
	let dropped;
	draggy.on('drop', value => { dropped = value; });
	element.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 30 }));
	document.dispatchEvent(pointer('pointermove', { clientX: 120, clientY: 30 }));
	assert.equal(target.classList.contains('active'), true);
	document.dispatchEvent(pointer('pointerup', { clientX: 120, clientY: 30 }));
	assert.equal(dropped, target);
	assert.equal(target.classList.contains('active'), false);
	draggy.destroy();
	assert.equal(draggy.destroyed, true);
	assert.notEqual(new Draggable(element), draggy);
});

test('supports legacy position mode and repeat wrapping', () => {
	const { draggy, element } = fixture({ css3: false, repeat: 'x' });
	draggy.move(300, 25);
	assert.equal(element.style.left, '50px');
	assert.equal(element.style.top, '25px');
	assert.deepEqual(draggy.getCoords(), [50, 25]);
});
