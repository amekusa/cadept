import Callable from './Callable';
import Manager from './TaskManager';

const { Exception, InvalidType } = require('generic-exceptions');
const flexParams = require('flex-params');
const conso1e = require('conso1e');
const chalk = require('chalk');
const c = new chalk.Instance();

const local = {
	states: {
		IDLE: 0,
		BUSY: 1,
		DONE: 2
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
 * @typedef {Task|Promise|string} Dependency
 **/

/**
 * A task dependency can also be a function.
 * @callback Dependency
 * @param {function} resolve Call this inside the function to signal that it is resolved
 * @param {function} reject Call this inside the function on errors
 **/

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
 */
class Task extends Callable {
	/**
	 * @param {string} name Task name
	 * @param {function} fn Task job
	 * @param {Dependency[]} deps Task dependencies
	 */
	constructor(...args) {
		super();
		this._manager = null;
		this._resolved = null;
		this._promise = null;
		this._state = local.states.IDLE;
		this._console = local.options.defaultConsole.subcontext();
		this._logLevel = local.logLevels.DEFAULT;
		flexParams(args, [
			{ name:'string', fn:'function', deps:['array', []] },
			{ name:'string', deps:'array' },
			{ fn:'function', deps:['array', []] },
			{ deps:'array' }
		], r => {
			this._name = r.name || '';
			this._fn = r.fn || (resolve => resolve());
			this._deps = [];
			this.depend(...r.deps);
		}, { throw: true });
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
		return !!(this._deps && this._deps.length);
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
			this.warn(`not resolved yet`);
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
	/**
	 * Registers this task for a {@link TaskManager}.
	 * @param {TaskManager} [manager] The {@link TaskManager} instance to register this task for.
	 * If omitted, [option:defaultManager]{@link Task.option} is used.
	 * @return {Task} this object
	 */
	register(manager = null) {
		manager = manager ? InvalidType.check(manager, Manager) : local.options.defaultManager;
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
		this._logLevel = typeof level == 'string' ? local.logLevels[level.toUpperCase()] : level;
		return this;
	}
	/**
	 * Logs a message, object, or any kind of value.
	 * @param {...any} msg Any type of value to log
	 * @return {Task} this object
	 */
	log(msg) {
		if (this.logLevel >= local.logLevels.ALL && this._name) this.console.log(this.label, msg);
		return this;
	}
	/**
	 * Logs `msg` as a warning.
	 * @param {...any} msg Any type of value to log
	 * @return {Task} this object
	 */
	warn(msg) {
		if (this.logLevel >= local.logLevels.WARN) this.console.warn(this.label, msg);
		return this;
	}
	/**
	 * Adds one or more dependencies.
	 * @param {...Dependency} deps One or more dependencies to add.
	 * @return {Task} this object
	 * @throws an error if this task is not idle
	 */
	depend(...deps) {
		if (!this.isIdle) throw new Error(`the task ${this.label} is not idle`);
		for (let dep of deps) {
			InvalidType.check(dep, Task, 'string', 'function', Promise);
			this._deps.push(dep);
		}
		return this;
	}
	_resolver(resolve, reject) {
		this.log(`${c.yellow('running')}...`);
		let _resolve = arg => {
			this.log(`${c.green('resolved.')}`);
			this._state = local.states.DONE;
			this._resolved = arg;
			return resolve(arg);
		};
		return this._fn(_resolve, reject);
	}
	/**
	 * @override
	 * @ignore
	 * @return {Promise}
	 */
	__call() {
		if (this._promise) return this._promise;
		this._state = local.states.BUSY;
		if (this.hasDep) {
			this.log(`${c.yellow('Resolving')} dependencies ...`);
			let promises = [];
			for (let dep of this._deps) {
				let promise = null;
				if (dep instanceof Task) promise = dep();
				else if (dep instanceof Promise) promise = dep;
				else if (typeof dep == 'function') promise = new Promise(dep);
				else if (typeof dep == 'string') {
					if (!this._manager) throw new Exception(`the task ${this.label} is not registered`);
					let task = this._manager.get(dep);
					if (!task) throw new Exception(`no such task as '${dep}'`);
					promise = task();
				} else throw new InvalidType.failed(dep, Task, Promise, 'function', 'string');
				promises.push(promise);
			}
			this._promise = Promise.all(promises).then(() => {
				this.log(`All the dependincies have been ${c.green('resolved')}`);
				return new Promise(this._resolver.bind(this));
			});
		} else this._promise = new Promise(this._resolver.bind(this));
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
			InvalidType.check(value, Manager);
			break;
		case 'defaultConsole':
			InvalidType.check(value, 'object');
			if (!(value instanceof conso1e)) value = conso1e.wrap(value);
			break;
		case 'defaultLogLevel':
			InvalidType.check(value, 'string', 'int');
			value = local.logLevels[value.toUpperCase()];
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
			defaultManager: Manager.global(),
			defaultConsole: conso1e.global(),
			defaultLogLevel: local.logLevels.WARN,
			colorSupport: typeof window == 'undefined' ? 1 : 0
		};
		c.level = local.options.colorSupport;
		return this;
	}
}

Task.reset();
Task.Manager = Manager;
export default Task;
