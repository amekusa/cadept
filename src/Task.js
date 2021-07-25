import Callable from './Callable.js';
import TaskManager from './TaskManager.js';
import TaskDependency from './TaskDependency.js';
import {
	TaskException,
	TaskJobFailure,
	TaskDepFailure
} from './errors.js';

const { Exception, InvalidType } = require('generic-exceptions');
const flexParams = require('flex-params');
const conso1e = require('conso1e');
const chalk = require('chalk');
const c = new chalk.Instance();

const local = {
	states: {
		IDLE: 0,
		BUSY: 1,
		DONE: 2,
		FAILED: 3
	},
	logLevels: {
		DEFAULT: -1,
		SILENT: 0,
		ERROR: 1,
		WARN: 2, WARNING: 2,
		ALL: 3, VERBOSE: 3
	},
	options: null
};

/**
 * A task dependency.
 * If it is a string, that means it is a task name.
 * @typedef {Task|Promise|string} Dependee
 */
/**
 * A task dependency can also be a function.
 * @callback Dependee
 * @param {function} resolve Call this inside the function to signal that it is resolved
 * @param {function} reject Call this inside the function on errors
 */

/**
 * A task that is callable as a function.
 * A called task returns a [Promise]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise}.
 * @author amekusa.com
 *
 * @example <caption>Executing a task</caption>
 * var task = new Task('greet', () => { console.log('Hello!') });
 * task(); // "Hello!"
 *
 * @example <caption>Promise</caption>
 * var task = new Task('notify', resolve => {
 *   setTimeout(() => {
 *     console.warn('Hey!');
 *     resolve('task done.');
 *   }, 3000);
 * });
 *
 * task() // runs asnychronously, and returns a promise
 * .then(resolved => { // runs after 3 seconds
 *   console.log(resolved); // "task done."
 * });
 *
 * @example <caption>Task dependencies</caption>
 * var taskA = new Task('A', resolve => {
 *   setTimeout(() => { console.log('task A done.'); resolve() }, 3000);
 * });
 * var taskB = new Task('B', resolve => {
 *   setTimeout(() => { console.log('task B done.'); resolve() }, 6000);
 * });
 * var taskC = new Task('C', () => {
 *   console.log('task C done.');
 * }, [taskA, taskB]); // dependencies
 *
 * taskC(); // outputs:
 * // "task A done."
 * // "task B done."
 * // "task C done."
 *
 * // NOTE: taskA and taskB run in parallel
 *
 * @example <caption>Omitting some constructor parameters</caption>
 * new Task('task B', [taskA]);      // name and dependencies (no job)
 * new Task(() => { ... }, [taskA]); // job and dependencies (no name)
 * new Task(() => { ... });          // only job (no name, no dependencies)
 * new Task([taskA]);                // only dependencies (no name, no job)
 *
 * @example <caption>Adding dependencies</caption>
 * var taskA = new Task('task A', () => { ... });
 * var taskB = new Task('task B', () => { ... });
 * var taskC = new Task('task C', () => { ... });
 * taskC.depend(taskA, taskB);       // add taskA and taskB as dependencies
 * taskC();
 *
 * @example <caption>Error Handling</caption>
 * var task = new Task((resolve, reject) => {
 *   throw 'I AM ERROR';
 *   // or
 *   reject('I AM ERROR');
 * });
 * task().catch(e => {
 *   // NOTE: e is a TaskJobFailure instance
 *   console.error(e.info.thrown); // 'I AM ERROR'
 * });
 */
class Task extends Callable {
	/**
	 * @param {string} [name] Task name
	 * @param {function} [fn] Task job
	 * @param {Dependee[]} [deps] Task dependencies
	 */
	constructor(...args) {
		super();
		this._manager = null;
		this._resolved = null;
		this._promise = null;
		this._state = local.states.IDLE;
		this._console = local.options.defaultConsole.subcontext();
		this._logLevel = local.logLevels.DEFAULT;
		this._deps = [];
		this._namedDeps = {};
		flexParams(args, [
			{ name:'string', fn:['function', null], deps:['array|object', []] },
			{ name:'string', deps:'array|object' },
			{ fn:'function', deps:['array|object', []] },
			{ deps:'array|object' }
		], r => {
			this._name = r.name || '';
			this._fn = r.fn || (resolve => resolve());
			if (r.deps) this.depend(r.deps);
		}, { throw: true });
	}
	/**
	 * {@link TaskManager} class
	 * @type {class}
	 * @readonly
	 */
	static get Manager() {
		return TaskManager;
	}
	/**
	 * {@link TaskDependency} class
	 * @type {class}
	 * @readonly
	 */
	static get Dependency() {
		return TaskDependency;
	}
	/**
	 * {@link TaskException} class
	 * @type {class}
	 * @readonly
	 */
	static get Exception() {
		return TaskException;
	}
	/**
	 * {@link TaskJobFailure} class
	 * @type {class}
	 * @readonly
	 */
	static get JobFailure() {
		return TaskJobFailure;
	}
	/**
	 * {@link TaskDepFailure} class
	 * @type {class}
	 * @readonly
	 */
	static get DepFailure() {
		return TaskDepFailure;
	}
	/**
	 * Name of this task
	 * @type {string}
	 * @readonly
	 */
	get displayName() {
		return this._name;
	}
	/**
	 * @type {string}
	 * @ignore
	 */
	get label() {
		return this._name ? `[${c.cyan(this._name)}]` : '[anonymous task]';
	}
	/**
	 * Whether this task has name
	 * @type {boolean}
	 * @readonly
	 */
	get hasName() {
		return !!this._name;
	}
	/**
	 * Whether this task has any dependency
	 * @type {boolean}
	 * @readonly
	 */
	get hasDep() {
		return this._deps.length > 0;
	}
	/**
	 * The current state of this task
	 *
	 * | Possible State | Meaning |
	 * |---------------:|:--------|
	 * | `IDLE` | The initial state |
	 * | `BUSY` | Resolving |
	 * | `DONE` | Resolved |
	 * | `FAILED` | Failed to resolve |
	 *
	 * @type {string}
	 * @readonly
	 */
	get state() {
		for (let i in local.states) {
			if (local.states[i] == this._state) return i;
		}
		return 'UNKNOWN';
	}
	/**
	 * Whether this task is idle
	 * @type {boolean}
	 * @readonly
	 */
	get isIdle() {
		return this._state == local.states.IDLE;
	}
	/**
	 * Whether this task is done
	 * @type {boolean}
	 * @readonly
	 */
	get isDone() {
		return this._state == local.states.DONE;
	}
	/**
	 * Whether this task is busy
	 * @type {boolean}
	 * @readonly
	 */
	get isBusy() {
		return this._state == local.states.BUSY;
	}
	/**
	 * Whether this task is failed
	 * @type {boolean}
	 * @readonly
	 */
	get isFailed() {
		return this._state == local.states.FAILED;
	}
	/**
	 * Whether this task is registered for a {@link TaskManager}
	 * @type {boolean}
	 * @readonly
	 */
	get isRegistered() {
		return !!this._manager;
	}
	/**
	 * The resolved value
	 * @type {any}
	 * @readonly
	 */
	get resolved() {
		if (!this.isDone) {
			this.warn(`Not resolved yet`);
			return null;
		}
		return this._resolved;
	}
	/**
	 * The console object to ouput the logs
	 * @type {conso1e}
	 */
	get console() {
		return this._console;
	}
	/**
	 * The manager that this task has registered for
	 * @type {TaskManager|null}
	 * @readonly
	 */
	get manager() {
		return this._manager;
	}
	/**
	 * The log threshold
	 * @type {integer}
	 * @readonly
	 */
	get logLevel() {
		return this._logLevel == local.logLevels.DEFAULT ? local.options.defaultLogLevel : this._logLevel;
	}
	set console(x) {
		this._console = x instanceof conso1e ? x : conso1e.wrap(x);
	}
	toString() {
		return `[${this.constructor.name} ` + (this.displayName ? `'${this.displayName}'` : `(anonymous)`) + ']';
	}
	toJSON() {
		let r = {
			displayName: this.displayName,
			state: this.state,
			isRegistered: this.isRegistered,
			hasDep: this.hasDep
		};
		if (this.isDone) r.resolved = this._resolved;
		return r;
	}
	/**
	 * Registers this task for a {@link TaskManager}.
	 * @param {TaskManager} [manager] The {@link TaskManager} instance to register this task for.
	 * If omitted, [option:defaultManager]{@link Task.option} is used.
	 * @return {Task} this object
	 */
	register(manager = null) {
		manager = manager ? InvalidType.check(manager, TaskManager) : local.options.defaultManager;
		manager.add(this);
		return this;
	}
	_register(manager) {
		this._manager = manager;
	}
	/**
	 * Deregisters this task from a {@link TaskManager}.
	 * @return {Task} this object
	 */
	deregister() {
		if (!this._manager) throw new Exception(`the task ${this.label} is not registered`);
		this._manager.remove(this.displayName);
		return this;
	}
	_deregister() {
		this._manager = null;
	}
	/**
	 * Finds and returns the resolution of a dependency.
	 * @param {number|string} key Index or name of a dependency
	 * @return {any} the resolution of the dependency
	 */
	dep(key) {
		if (typeof key === 'number' && key < this._deps.length) return this._deps[key].resol;
		for (let dep of this._deps) {
			if (dep.name === key) return dep.resol;
		}
		throw new Exception(`no such dependency as '${key}'`);
	}
	/**
	 * Sets a log threshold.
	 * @param {integer|string} level Log level in an integer or a string form (recommended).
	 * String form is case-insensitive.
	 *
	 * | Log Level (in a string form) | Meaning |
	 * |-----------------------------:|:--------|
	 * | `DEFAULT` | Follows to the [option]{@link Task.option}: `defaultLogLevel` |
	 * | `SILENT` | Do not output any logs |
	 * | `ERROR` | Log only errors |
	 * | `WARN`, `WARNING` | Log warnings and errors |
	 * | `ALL`, `VERBOSE` | Output every single log |
	 *
	 * @return {Task} this object
	 */
	setLogLevel(level) {
		this._logLevel = typeof level === 'string' ? local.logLevels[level.toUpperCase()] : level;
		return this;
	}
	/**
	 * Logs a message, object, or any kind of value.
	 * @param {...any} msg Any type of value to log
	 * @return {Task} this object
	 */
	log(...msg) {
		if (this.logLevel >= local.logLevels.ALL && this._name) this.console.log(this.label, ...msg);
		return this;
	}
	/**
	 * Logs `msg` as a warning.
	 * @param {...any} msg Any type of value to log
	 * @return {Task} this object
	 */
	warn(...msg) {
		if (this.logLevel >= local.logLevels.WARN) this.console.warn(this.label, ...msg);
		return this;
	}
	/**
	 * Logs `msg` as an error.
	 * @param {...any} msg Any type of value to log
	 * @return {Task} this object
	 */
	error(...msg) {
		if (this.logLevel >= local.logLevels.ERROR) this.console.error(this.label, ...msg);
		return this;
	}
	/**
	 * Adds one or more dependencies.
	 * @param {...Dependee} deps One or more dependencies to add.
	 * @return {Task} this object
	 * @throws an error if this task is not idle
	 */
	depend(...deps) {
		if (!this.isIdle) throw new Exception(`the task ${this.label} is not idle`, { task: this, state: this.state });
		for (let dep of deps) {
			if (Array.isArray(dep)) this.depend(...dep); // RECURSE:
			else if (dep instanceof Task) this._depend(dep, dep.displayName);
			else if (dep instanceof Promise) this._depend(dep);
			else if (typeof dep === 'object') {
				for (let key in dep) this._depend(dep[key], key);
			} else this._depend(dep);
		}
		return this;
	}
	_depend(dep, name = null) {
		dep = dep instanceof TaskDependency ? dep : new TaskDependency(this, dep, name);
		if (dep.name && dep.name in this._namedDeps) throw new Exception(`the dependency name '${dep.name}' already exists`);
		this._deps.push(dep);
		return this;
	}
	/**
	 * @alias
	 * @return {Promise}
	 */
	run() {
		return this.__call();
	}
	/**
	 * @override
	 * @ignore
	 * @return {Promise}
	 */
	__call() {
		if (!this._promise) {
			this._state = local.states.BUSY;
			let resolver = (resolve, reject) => {
				this.log(`${c.yellow('Running')} ...`);
				let _resolve = arg => {
					this._state = local.states.DONE;
					this._resolved = arg;
					this.log(`${c.green('Resolved')}`);
					return resolve(arg);
				};
				return this._fn.length ?
					this._fn(_resolve, reject) :
					_resolve(this._fn());
			};
			let errHandler = err => {
				this._state = local.states.FAILED;
				if (!err) err = 'unknown reason';
				this.error(`${c.red('Failed')}:`, err);
				throw new TaskJobFailure(null, {
					task: this,
					thrown: err
				}, true);
			};
			if (this.hasDep) {
				this.log(`${c.yellow('Resolving')} dependencies ...`);
				let promises = [];
				for (let i = 0; i < this._deps.length; i++) {
					let dep = this._deps[i];
					promises.push(dep.resolve().then(resol => {
						if (dep.name) this._namedDeps[dep.name] = resol;
						return resol;
					}, err => {
						throw { dep, i, err };
					}));
				}
				this._promise = Promise.all(promises).then(() => {
					this.log(`All the dependencies have been ${c.green('resolved')}`);
					return new Promise(resolver).catch(errHandler);
				}, err => {
					this._state = local.states.FAILED;
					this.error(`${c.red('Dependency Error')}:`, `dep: ${c.yellow(err.dep)}, index: ${c.yellow(err.i)}`);
					throw new TaskDepFailure(null, {
						task: this,
						dep: err.dep,
						index: err.i,
						thrown: err.err
					}, true);
				});

			} else this._promise = new Promise(resolver).catch(errHandler);
		}
		return this._promise;
	}
	/**
	 * Returns the specified option value, or assigns a new value to it.
	 *
	 * ##### Available Options:
	 * | Name | Default Value | Description |
	 * |-----:|:--------------|:------------|
	 * | `defaultManager` | The global {@link TaskManager} instance | The default {@link TaskManager} |
	 * | `defaultConsole` | The global `console` | The default console to output logs |
	 * | `defaultLogLevel` | `'WARNING'` | The default log level |
	 * | `colorSupport` | CLI: `1`, browser: `0` | The default color support level for the console |
	 *
	 * @param {string} name Option name
	 * @param {any} [value]
	 * @return {any|class}
	 * the option value, or Task class if the 2nd argument was provided
	 */
	static option(name, value = undefined) {
		Exception.check(name, ...Object.keys(local.options));
		if (arguments.length < 2) return local.options[name];
		switch (name) {
		case 'defaultManager':
			InvalidType.check(value, TaskManager);
			break;
		case 'defaultConsole':
			InvalidType.check(value, 'object');
			if (!(value instanceof conso1e)) value = conso1e.wrap(value);
			break;
		case 'defaultLogLevel':
			InvalidType.check(value, 'string', 'int');
			if (typeof value === 'string') value = local.logLevels[value.toUpperCase()];
			break;
		case 'colorSupport':
			InvalidType.check(value, 'int');
			c.level = value;
			break;
		default:
			InvalidType.check(value, typeof local.options[name]);
		}
		local.options[name] = value;
		return this;
	}
	/**
	 * Returns all the option values in a plain object form.
	 * If an object is provided as the argument, assigns the each property value to the corresponding option.
	 * @param {object} [opts] Name-value pairs to assign
	 * @return {object|class} the options as an object, or Task class if the argument was provided
	 */
	static options(opts = null) {
		if (!opts) return Object.assign({}, local.options);
		for (let i in opts) this.option(i, opts[i]);
		return this;
	}
	/**
	 * Resets all the options to the initial values.
	 * @return {class} the Task class
	 */
	static reset() {
		local.options = {
			defaultManager: TaskManager.global(),
			defaultConsole: conso1e.global(),
			defaultLogLevel: local.logLevels.WARN,
			colorSupport: typeof window === 'undefined' ? 1 : 0
		};
		c.level = local.options.colorSupport;
		return this;
	}
}

Task.reset();
export default Task;
