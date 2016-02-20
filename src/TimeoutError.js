var captureStackTrace = require('capture-stack-trace');

var TimeoutError = function TimeoutError(time, extra) {
    if (!(this instanceof TimeoutError)) {
        return new TimeoutError(time);
    }
    captureStackTrace(this, this.constructor);
    this.name = TimeoutError.name;
    this.message = "Task timed out after " + time + 'ms';
    this.extra = extra || {};
}
TimeoutError.prototype = Object.create(Error.prototype);
TimeoutError.prototype.constructor = TimeoutError;

module.exports = TimeoutError;
