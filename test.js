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
const TaskDependency = Task.Dependency;

function setup() {
	let t = new Task(`test`, r => { r(`done.`) });
	let t2 = new Task(`test2`, r => { r(`test2:done.`) });
	let t3 = new Task(`test3`, r => { r(`test3:done.`) });
	let manager = new TaskManager();
	return { t, t2, t3, manager };
}

beforeEach(() => {
	log.clear();
	Task.reset();
	Task.options({
		defaultConsole: logger,
		colorSupport: 0,
		defaultLogLevel: 3
	});
});

describe(`TaskManager`, () => {
	describe(`methods`, () => {
		it(`newTask`, () => {
			let tm = new TaskManager();
			tm.newTask('test', resolve => resolve('DONE.'));
			assert.ok(tm.get('test') instanceof Task);
			assert.equal(tm.get('test').displayName, 'test');
		});
	});
});

describe(`TaskDependency`, () => {
	describe(`members`, () => {
		let task = new Task(`TASK`, r => { r(`DONE`) });
		let a = new TaskDependency(task, Promise.resolve(`RESOL:A`)); a.resolve();
		let b = new TaskDependency(task, Promise.reject(`ERROR:B`)); b.resolve();
		let c = new TaskDependency(task, Promise.resolve(`RESOL:C`), `CHRIS`); c.resolve();
		let d = new TaskDependency(task, new Task(`TASK:D`, r => { r(`DONE`) })); d.resolve();
		compareMembers({ a, b, c, d }, {
			name: { a:'', b:'', c:`CHRIS`, d:`TASK:D` },
			isResolved: { a:true, b:false },
			hasError: { a:false, b:true },
			resol: { a:`RESOL:A`, c:`RESOL:C` },
			error: { a:null, b:`ERROR:B` },
			expr: { a:`an anonymous dependency`, c:`the dependency 'CHRIS'`, d:`the dependency 'TASK:D'` }
		});
	});
});

describe(`Task`, () => {
	describe('type check', () => {
		let t = new Task('test', resolve => resolve());
		it(`typeof task == 'function'`, () => {
			assert.equal(typeof t, 'function');
		});
		it(`task instanceof Task`, () => {
			assert.ok(t instanceof Task);
		});
	});
	describe(`members`, () => {
		let dep = new Task('dep', resolve => { resolve('dep:done.') });
		let a = new Task('A', resolve => { resolve('a:done.') }, [dep]);
		let b = new Task('B', resolve => { resolve('b:done.') }); b.setLogLevel(1);
		let c = new Task('C', resolve => { resolve('e:done.') }); c.register();
		let d = new Task(resolve => { resolve('d:done.') });
		compareMembers({ a, b, c, d }, {
			displayName: { a:'A', b:'B', c:'C', d:'' },
			label: { a:'[A]', b:'[B]', c:'[C]', d:'[anonymous task]' },
			hasName: { a:true, b:true, c:true, d:false },
			hasDep: { a:true, b:false, c:false, d:false },
			isRegistered: { a:false, b:false, c:true, d:false },
			logLevel: { a:3, b:1 },
			manager: { a:null, b:null, c:TaskManager.global(), d:null }
		});
	});
	describe(`methods`, () => {
		beforeEach(() => {
			TaskManager.global().clear();
		});
		it(`__call`, done => {
			let t = new Task('test', resolve => {
				setTimeout(resolve, 1000, 'RESOLUTION');
			});
			assert.equal(t.isBusy, false);
			let p = t();
			assert.ok(t.isBusy);
			p.then(r => {
				assert.equal(r, t.resol, 'RESOLUTION');
				assert.ok(t.isDone);
				assert.equal(t.isIdle, t.isBusy, t.isFailed, false);
				done();
			}).catch(done);
		});
		it(`__call :: rejection`, done => {
			let t = new Task('test', (resolve, reject) => { reject('REJECTED') });
			t().then(() => {
				assert.fail(`shouldn't reach here`);
				done();
			}).catch(err => {
				assert.ok(err instanceof Task.JobFailure);
				assert.equal(err.info.thrown, 'REJECTED');
				assert.ok(t.isFailed);
				assert.equal(t.isIdle, t.isBusy, t.isDone, false);
				done();
			}).catch(done);
		});
		it(`__call :: error`, done => {
			let t = new Task('test', () => {
				throw 'ERROR';
			});
			t().then(() => {
				assert.fail(`shouldn't reach here`);
				done();
			}).catch(err => {
				assert.ok(err instanceof Task.JobFailure);
				assert.equal(err.info.thrown, 'ERROR');
				assert.ok(t.isFailed);
				assert.equal(t.isIdle, t.isBusy, t.isDone, false);
				done();
			}).catch(done);
		});
		it(`__call :: this`, done => {
			let t = new Task('test', function (resolve) {
				assert.strictEqual(t, this);
				resolve();
			});
			t().then(done).catch(done);
		});
		it(`__call :: 3rd param is the task itself`, done => {
			let t = new Task('test', (resolve, reject, self) => {
				assert.strictEqual(t, self);
				resolve();
			});
			t().then(done).catch(done);
		});
		it(`__call :: no params`, done => {
			let t = new Task('test', () => {
				return 'RESOLUTION';
			});
			t().then(r => {
				assert.equal(r, t.resol, 'RESOLUTION');
				assert.ok(t.isDone);
				done();
			}).catch(done);
		});
		it(`__call :: no params :: error`, done => {
			let t = new Task('test', () => {
				throw 'ERROR';
			});
			t().then(r => {
				assert.fail(`shouldn't reach here`);
				done();
			}).catch(err => {
				assert.ok(err instanceof Task.JobFailure);
				assert.equal(err.info.thrown, 'ERROR');
				assert.ok(t.isFailed);
				done();
			}).catch(done);
		});
		it(`register`, () => {
			let { t } = setup();
			assert.strictEqual(t.register(), t);
		});
		it(`register(manager)`, () => {
			let { t, manager } = setup();
			t.register(manager);
			assert.strictEqual(t.manager, manager);
		});
		it(`deregister`, () => {
			let { t } = setup();
			let manager = TaskManager.global();
			t.register();
			assert.ok(t.isRegistered);
			assert.ok(manager.has(t));
			t.deregister();
			assert.ok(!t.isRegistered);
			assert.ok(!manager.has(t));
		});
		it(`depend`, done => {
			let { t, t2, t3 } = setup();
			t.depend(t2, t3);
			assert.ok(t.hasDep);
			t().then(resol => {
				assert.ok(t.isDone);
				assert.ok(t2.isDone);
				assert.ok(t3.isDone);
				assert.equal(t.resol, resol);
				assert.equal(t.resol, `done.`);
				assert.equal(t2.resol, `test2:done.`);
				assert.equal(t3.resol, `test3:done.`);
				done();
			}).catch(done);
		});
		it(`depend(string)`, done => {
			let { t, t2, t3 } = setup();
			t.depend(`test2`, `test3`);
			t.register();
			t2.register();
			t3.register();
			t().then(resol => {
				assert.ok(t.isDone);
				assert.ok(t2.isDone);
				assert.ok(t3.isDone);
				assert.equal(t.resol, resol);
				assert.equal(t.resol, `done.`);
				assert.equal(t2.resol, `test2:done.`);
				assert.equal(t3.resol, `test3:done.`);
				done();
			}).catch(done);
		});
		it(`dep`, done => {
			let t = new Task(`TASK`);
			t.depend({
				depA: Promise.resolve(`RESOL:A`),
				depB: Promise.resolve(`RESOL:B`)
			}).run().then(() => {
				assert.equal(t.dep(0), t.dep('depA'), `RESOL:A`);
				assert.equal(t.dep(1), t.dep('depB'), `RESOL:B`);
				done();
			}).catch(done);
		});
	});
	describe(`options`, () => {
		it(`colorSupport`, () => {
			let t = new Task('test', resolve => { resolve() });
			Task.option('colorSupport', 0);
			t.log(`foo`);
			Task.option('colorSupport', 1);
			t.log(`foo`);
			assert.equal(log.lines[0], `[test] foo`);
			assert.notEqual(log.lines[1], `[test] foo`);
		});
	});
});
