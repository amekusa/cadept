import { Exception } from 'generic-exceptions';

/**
 * @extends Exception@generic-exceptions
 * @ignore
 */
class TaskException extends Exception {}

/**
 * Thrown when an error occurred during task execution.
 * @extends TaskException
 * @ignore
 */
class TaskJobFailure extends TaskException {
	static get message() {
		return `A task cannot be resolved due to an error occurred during the task execution.`;
	}
}

/**
 * Thrown to indicate that a task can't be executed due to its dependency failed to resolve.
 * @extends TaskException
 * @ignore
 */
class TaskDepFailure extends TaskException {
	static get message() {
		return `A task cannot be executed due to its dependency failed to resolve.`
	}
}

export {
	TaskException,
	TaskJobFailure,
	TaskDepFailure
};
