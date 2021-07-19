import Task from './Task.js';
const { Exception, InvalidType } = require('generic-exceptions');

const local = {
	INITIAL: Symbol('INITIAL')
};

/**
 * A dependency of a task
 */
class TaskDependency {
	/**
	 * @param {Task} depender
	 * @param {Dependee} dependee
	 * @param {string} [name]
	 */
	constructor(depender, dependee, name = null) {
		this._depender = InvalidType.check(depender, Task)
		this._dependee = InvalidType.check(dependee, Task, Promise, 'function', 'string');
		if (name === null) {
			if (dependee instanceof Task) this._name = dependee.displayName;
			else if (typeof dependee === 'string') this._name = dependee;
			else this._name = '';
		} else this._name = String(name);
		this._resol = local.INITIAL;
		this._error = local.INITIAL;
	}
	/**
	 * The name of this dependency
	 * @type {string}
	 * @readonly
	 */
	get name() {
		return this._name;
	}
	/**
	 * Whether this dependency has been resolved
	 * @type {boolean}
	 * @readonly
	 */
	get isResolved() {
		return this._resol !== local.INITIAL;
	}
	/**
	 * Whether this dependency has encountered an error while resolving itself
	 * @type {boolean}
	 * @readonly
	 */
	get hasError() {
		return this._error !== local.INITIAL;
	}
	/**
	 * The resolution of the dependency
	 * @type {any}
	 * @readonly
	 */
	get resol() {
		if (this.hasError) throw new Exception(`${this.expr} has an error`);
		if (!this.isResolved) throw new Exception(`${this.expr} is not resolved`);
		return this._resol;
	}
	/**
	 * The error that this dependency encountered while resolving itself
	 * @type {any}
	 * @readonly
	 */
	get error() {
		return this.hasError ? this._error : null;
	}
	/**
	 * @ignore
	 */
	get expr() {
		return this.name ? `the dependency '${this.name}'` : `an anonymous dependency`;
	}
	/**
	 * Tries to resolve the dependency and returns a `Promise` object
	 * @return {Promise}
	 */
	resolve() {
		let r;
		if (this._dependee instanceof Task) r = this._dependee();
		else if (this._dependee instanceof Promise) r = this._dependee;
		else if (typeof this._dependee == 'function') r = new Promise(this._dependee);
		else if (typeof this._dependee == 'string') {
			let manager = this._depender.manager;
			if (!manager) throw new Exception(`the task ${this._depender.label} is not registered`);
			let task = manager.get(this._dependee);
			if (!task) throw new Exception(`no such task as '${this._dependee}'`);
			r = task();
		} else throw new InvalidType.failed(this._dependee, Task, Promise, 'function', 'string');
		return r;
	}
}

export default TaskDependency;
