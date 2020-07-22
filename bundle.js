(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = global || self, global.adeptask = factory());
}(this, (function () { 'use strict';

	/**
	 * Extensible Function
	 */
	class Callable extends Function {
		constructor() {
			super('...args', 'return this.__self.__call(...args)');
			this.__self = this.bind(this);
			return this.__self;
		}
		/**
		 * Runs when the instance is called as function.
		 * Override to implement
		 */
		__call() {}
	}

	const flexParams = require('flex-params');
	const conso1e = require('conso1e');
	const chalk = require('chalk');
	const { red, green, blue, cyan, magenta, yellow, gray } = chalk;

	const states = {
		IDLE: 0,
		BUSY: 1,
		DONE: 2
	};

	let defaultConsole = conso1e.global();

	/**
	 * Task
	 * @author amekusa.com
	 *
	 * TODO: Task grouping by name
	 * TODO: Task management by name
	 */
	class Task extends Callable {
		/**
		 * @param   {string} name
		 * @param {function} fn   (optional)
		 * @param   {Task[]} deps (optional)
		 */
		constructor(name, ...args) {
			super();
			this.displayName = name;
			flexParams(args, [
				{ fn:'function', deps:['array', []] },
				{ deps:'array' }
			], r => {
				this._deps = r.deps;
				this._fn = r.fn || (resolve => resolve());
			});
			this._state = states.IDLE;
			this._resolved = null;
			this._promise = null;
			this._console = null;
		}
		/**
		 * @type {boolean}
		 */
		get hasDep() {
			return (this._deps && this._deps.length);
		}
		/**
		 * @type {boolean}
		 */
		get isIdle() {
			return this._state == states.IDLE;
		}
		/**
		 * @type {boolean}
		 */
		get isDone() {
			return this._state == states.DONE;
		}
		/**
		 * @type {boolean}
		 */
		get isBusy() {
			return this._state == states.BUSY;
		}
		/**
		 * @type {any}
		 */
		get resolved() {
			if (!this.isDone) throw new Error(`${this.expr} is not resolved yet`);
			return this._resolved;
		}
		/**
		 * @type {conso1e}
		 */
		get console() {
			return this._console || defaultConsole;
		}
		/**
		 * @type {string}
		 */
		get expr() {
			return `Task '${cyan(this.displayName)}'`;
		}
		set console(x) {
			if (typeof x != 'object') throw new Error('Invalid Argument');
			this._console = x instanceof conso1e ? x : conso1e.wrap(x);
		}
		_resolver(resolve, reject) {
			this.console.log(`${this.expr} is ${yellow('running')}...`);
			let _resolve = arg => {
				this.console.log(`${this.expr} has been ${green('resolved')}`);
				this._state = states.DONE;
				this._resolved = arg;
				return resolve(arg);
			};
			return this._fn(_resolve, reject);
		}
		/**
		 * Adds a new dependency
		 * @param {Task} newDep
		 * @return {Task} Self
		 */
		addDep(newDep) {
			if (!this.isIdle) throw new Error(`${this.expr} is already resolved or running`);
			this._deps.push(newDep);
			return this;
		}
		/**
		 * @override
		 * @return {Promise}
		 */
		__call() {
			if (this._promise) return this._promise;
			this._state = states.BUSY;
			if (this.hasDep) {
				this.console.log(`${yellow('Resolving')} dependencies of ${this.expr}`);
				let promises = [];
				for (let dep of this._deps) promises.push(dep());
				this._promise = Promise.all(promises).then(() => {
					this.console.log(`All the dependincies of ${this.expr} have been ${green('resolved')}`);
					return new Promise(this._resolver.bind(this));
				});

			} else this._promise = new Promise(this._resolver.bind(this));
			return this._promise;
		}
	}

	/**
	 * Sets the default console
	 * @param {object|conso1e} console
	 * @return {class} Task class
	 */
	Task.setDefaultConsole = function (console) {
		if (typeof console != 'object') throw new Error('Invalid Argument');
		defaultConsole = console instanceof conso1e ? console : conso1e.wrap(console);
		return Task;
	};

	return Task;

})));
