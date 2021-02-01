**CADEPT** ( **C**allable **A**sync **DEP**endency **T**ask ) is an asynchronous task class with dependency management features.

[![Build Status](https://travis-ci.com/amekusa/cadept.svg?branch=master)](https://travis-ci.com/amekusa/cadept) [![codecov](https://codecov.io/gh/amekusa/cadept/branch/master/graph/badge.svg)](https://codecov.io/gh/amekusa/cadept) [![npm](https://img.shields.io/badge/dynamic/json?label=npm%0Apackage&query=%24%5B%27dist-tags%27%5D%5B%27latest%27%5D&url=https%3A%2F%2Fregistry.npmjs.org%2Fcadept%2F)](https://www.npmjs.com/package/cadept)

[📘 Documentations](https://amekusa.github.io/cadept/latest/Task.html)


## Getting Started

Install the package with NPM:

```sh
npm i cadept
```

And `require()` it:

```js
const Task = require('cadept');
```

or `import` it as an ES module:

```js
import Task from 'cadept';
```

## Usage

```js
// Create a task
const task = new Task((resolve, reject) => {

  /* do stuff */

  resolve(); // Finish
});

task(); // Run a task
```

A task instance is callable just like a function. And it runs **asynchronously**.

The called task returns a **Promise** object so you can hook on the task resolution (or rejection) like this:

```js
const task = new Task((resolve, reject) => {
  resolve('Task Complete.');
});

task().then(result => {
  console.log(result); // output: 'Task Complete.'
});
```

If you prefer simpler syntax, you can also write like this:

```js
const task = new Task(() => {
  return 'Task Complete.';
});

task().then(result => {
  console.log(result); // output: 'Task Complete.'
});
```



### Adding task dependencies

A task can be associated with another tasks as its **dependencies**.

```js
const task_X = new Task(resolve => {
  console.log('task_X: OK');
  resolve();
});

const task_Y = new Task(resolve => {
  console.log('task_Y: OK');
  resolve();
});

const task_Z = new Task(resolve => {
  console.log('task_Z: OK');
  resolve();
}, [task_X, task_Y]); // Dependencies

task_Z(); // Run task_Z
```

Output:

```js
task_X: OK
task_Y: OK
task_Z: OK
```

The 2nd parameter of `Task()` is an array of dependency tasks, which are `task_X` and `task_Y` in the above example. When the dependent task ( `task_Z` ) is called, it calls its dependencies in parallel, prior to execute its own function, awaiting all the dependencies are resolved.

Alternatively, you can also use `depend()` to add dependencies to a task.

```js
task_Z.depend(task_X, task_Y);
task_Z();
```



For more instructions, examples, and advanced usages, please see:
[📘 Documentations](https://amekusa.github.io/cadept/latest/Task.html)



And also check the real-world example:
[**p5-livesketch**/index.js](https://github.com/amekusa/p5-livesketch/blob/master/index.js)



---

## Author
[Satoshi Soma (amekusa.com)](https://amekusa.com)

