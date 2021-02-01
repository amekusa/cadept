const { Exception } = require('generic-exceptions');

/**
 * The base class of all the {@link Task} related exceptions.
 * @extends Exception@generic-exceptions
 * @hideconstructor
 */
class TaskException extends Exception {
	/**
	 * Additional informations for debug.
	 *
	 * #### Properties:
	 * | Name | Type | Description |
	 * |-----:|:-----|:------------|
	 * | `task` | {@link Task} | The erroneous task |
	 * | `thrown` | `any` | The thrown error |
	 *
	 * @member TaskException#info
	 * @type {object}
	 * @readonly
	 */
}

/**
 * The exception that is thrown when an error occurred during task execution.
 * @extends TaskException
 * @hideconstructor
 */
class TaskJobFailure extends TaskException {
	static get message() {
		return `an error occurred during the task execution`;
	}
}

/**
 * The exception that is thrown to indicate that a task can't be executed due to its dependency failed to resolve.
 * @extends TaskException
 * @hideconstructor
 */
class TaskDepFailure extends TaskException {
	/**
	 * Additional informations for debug.
	 *
	 * #### Properties:
	 * | Name | Type | Description |
	 * |-----:|:-----|:------------|
	 * | `task` | {@link Task} | The dependent task |
	 * | `dep` | {@link Dependency} | The erroneous dependency |
	 * | `index` | `int` | The index of `dep` |
	 * | `thrown` | `any` | The thrown error |
	 *
	 * @member TaskDepFailure#info
	 * @type {object}
	 * @readonly
	 */

	static get message() {
		return `a task can't be executed due to its dependency failed to resolve`
	}
}

export {
	TaskException,
	TaskJobFailure,
	TaskDepFailure
};
