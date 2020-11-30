import Task from './Task';

const { InvalidType } = require('generic-exceptions');
const flexParams = require('flex-params');

let instance = null;

/**
 * Owns and manages one or more tasks.
 */
class TaskManager {
	constructor() {
		this._tasks = {};
	}
	/**
	 * Creates a new task and registers it for this manager.
	 * @param {string} name Task name
	 * @param {function} [fn] Task job
	 * @param {Task[]} [deps] Task dependencies
	 * @return {Task} the created task
	 */
	newTask(...args) {
		return flexParams(args, [
			{ name:'string', fn:'function', deps:['array', []] },
			{ name:'string', deps:'array' }
		], () => {
			let task = new Task(...args);
			this._add(task);
			return task;
		}, { throw: true });
	}
	/**
	 * Registers a task for this manager.
	 * @param {Task} task The task to add
	 * @return {TaskManager} this object
	 */
	add(task) {
		InvalidType.check(task, Task);
		if (!task.hasName) throw new Exception(`anonymous task can't be added to a manager`);
		if (task.manager || this.has(task)) throw new Exception(`the task ${task.label} has already regitered`);
		this._add(task);
		return this;
	}
	_add(task) {
		this._tasks[task.displayName] = task;
		task._register(this);
	}
	/**
	 * Returns a task specified by name
	 * @param {string} taskName Name of the task to get
	 * @return {Task|null} the task, or `null` if it wasn't found
	 */
	get(taskName) {
		return (taskName in this._tasks) ? this._tasks[taskName] : null;
	}
	/**
	 * Returns whether this manager owns the specified task.
	 * @param {Task|string} task A task or task name
	 * @return {boolean}
	 */
	has(task) {
		let name = (task instanceof Task) ? task.displayName : task;
		return (name in this._tasks);
	}
	/**
	 * Returns a singleton instance of {@link TaskManager}.
	 * @return {TaskManager}
	 */
	static global() {
		if (!instance) instance = new this();
		return instance;
	}
}

export default TaskManager;
