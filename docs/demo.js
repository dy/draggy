import Draggable from '../draggy.js';

const free = document.querySelector('#free');
const coordinates = free.querySelectorAll('b');
const freeDrag = new Draggable(free, {
	within: 'parent',
	threshold: 4,
	droppable: '#dropzone',
	droppableClass: 'active'
});

freeDrag.on('drag', function () {
	coordinates[0].textContent = Math.round(this.prevX);
	coordinates[1].textContent = Math.round(this.prevY);
});

new Draggable(document.querySelector('#axis'), { within: 'parent', axis: 'x' });

document.querySelector('[data-copy]').addEventListener('click', async event => {
	await navigator.clipboard?.writeText('npm i draggy');
	event.currentTarget.querySelector('span').textContent = 'copied';
});
