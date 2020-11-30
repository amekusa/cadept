const assert = require('assert');
const { Exception, InvalidType } = require('generic-exceptions');

/* Utils */

const stream = require('stream');
class LogStream extends stream.Writable {
	constructor(options) {
		super(options);
		this.clear();
	}
	get data() {
		return Buffer.concat(this._chunks).toString('utf8').trim();
	}
	get lines() {
		return this.data.split('\n');
	}
	_write(chunk, enc, next) {
		this._chunks.push(chunk);
		next();
	}
	clear() {
		this._chunks = [];
	}
	assertLines(...args) {
		assert.deepEqual(this.lines, args);
	}
}

function setupLogger() {
	const r = {};
	r.log = new LogStream();
	r.logger = new console.Console(r.log);
	return r;
}

function falsy(value) {
	return !!!value;
}

function assertMembers(obj, members) {
	for (let member in members) {
		it(member, () => {
			let expected = members[member];
			if (!(member in obj)) assert.fail(`missing member: ${member}`);
			if (obj[member] !== expected) {
				assert.fail(new Exception(`unexpected value`, {
					member: member,
					expected: expected,
					actual: obj[member]
				}));
			}
		});
	}
}

function compareMembers(objects, members) {
	for (let member in members) {
		it(member, () => {
			let expects = members[member];
			if (typeof expects != 'object') throw new Exception(`invalid format`);
			for (let i in expects) {
				if (!(i in objects)) throw new Exception(`no such object as '${i}'`);
				let obj = objects[i];
				if (!(member in obj)) assert.fail(`missing member '${member}' in '${i}'`);
				if (obj[member] !== expects[i]) {
					assert.fail(new Exception(`unexpected value`, {
						object: i,
						member: member,
						expected: expects[i],
						actual: obj[member]
					}));
				}
			}
		});
	}
}

function assertMethods(obj, methods) {
	for (let method in methods) {
		if (!(method in obj)) assert.fail(`missing method: ${method}`);
		if (typeof obj[method] != 'function') assert.fail(`${method} is not a method`);
		let args = methods[method].args;
		let expected = methods[method].ex;
		let ret = obj[method](...args);
		if (ret !== expected) {
			assert.fail(new Exception(`unexpected return value`, {
				method: method,
				args: args,
				expected: expected,
				actual: ret
			}));
		}
	}
}

/* Tests */

const c = require('chalk');
const { log, logger } = setupLogger();
const Task = require('./bundle');
const TaskManager = Task.Manager;

beforeEach(() => {
	log.clear();
	Task.reset();
	Task.options({
		defaultConsole: logger,
		defaultLogLevel: 'all',
		colorSupport: 0
	});
});

describe('Task', () => {
	describe('members', () => {
		let dep = new Task('dep', resolve => { resolve('dep:done.') });
		let a = new Task('A', resolve => { resolve('a:done.') }, [dep]);
		let b = new Task('B', resolve => { resolve('b:done.') });
		let c = new Task('C', resolve => { setTimeout(resolve, 3000) }); c();
		let d = new Task(resolve => { resolve('d:done.') }); d();
		let e = new Task('E', resolve => { resolve('e:done.') }); e.register();
		compareMembers({a, b, c, d, e}, {
			displayName: { a:'A', b:'B', c:'C', d:'' },
			label: { a:'[A]', b:'[B]', c:'[C]', d:'[anonymous task]' },
			hasName: { a:true, d:false },
			hasDep: { a:true, b:false },
			isIdle: { a:true, b:true, c:false, d:false },
			isDone: { a:false, c:false, d:true },
			isBusy: { a:false, c:true, d:false },
			resolved: { a:null, d:'d:done.' },
			manager: { a:null, e:TaskManager.global() }
		});
	});
	describe('options', () => {
		it('colorSupport', () => {
			let t = new Task('test', resolve => { resolve() });
			t();
			log.assertLines(`[test] running...`, `[test] resolved.`);
		});
	});
});
