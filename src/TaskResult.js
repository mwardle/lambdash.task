var _ = require('lambdash');

var TaskResult = _.Type.sum('TaskResult', {Rejected: {value: null}, Resolved: {value: null}});

TaskResult.isRejected = TaskResult.case({
    Rejected: true,
    Resolved: false
});

TaskResult.isResolved = TaskResult.case({
    Rejected: false,
    Resolved: true
});

/**
 * @sig (a -> c) -> (b -> c) -> TaskResult a b -> c
 */
TaskResult.taskresult = _.curry(function(rejectedFn, resolvedFn, taskresult){
    return TaskResult.case({
        Rejected: rejectedFn,
        Resolved: resolvedFn
    }, taskresult);
});

TaskResult.rejecteds = _.filter(TaskResult.isRejected);

TaskResult.resolveds = _.filter(TaskResult.isResolved);

TaskResult.caught = _.curry(function(fn) {
    return _.curryN(fn.length, function(){
        try {
            return TaskResult.Resolved(fn.apply(this, arguments));
        } catch (e) {
            return TaskResult.Rejected(e);
        }
    });
});

TaskResult.compare = _.curry(function(rejected, resolved) {
    if (TaskResult.isRejected(rejected)) {
        if (TaskResult.isRejected(resolved)) {
            return _.compare(rejected.value, resolved.value);
        }

        return _.LT;
    }

    if (TaskResult.isRejected(resolved)) {
        return _.GT;
    }

    return _.compare(rejected.value, resolved.value);
});

TaskResult.map = _.curry(function(fn, taskresult) {
    return TaskResult.isRejected(taskresult) ? taskresult : TaskResult.Resolved(fn(taskresult.value));
});

TaskResult.fold = _.curry(function(fn, init, taskresult) {
    return TaskResult.case({
        Rejected: init,
        Resolved: function(value) {
            return fn(init, value);
        }
    }, taskresult);
});

TaskResult.foldr = TaskResult.foldl = TaskResult.fold;

TaskResult.of = TaskResult.Resolved;

TaskResult.ofRejected = TaskResult.Rejected;

TaskResult.concat = _.curry(function(left, right){
    if (TaskResult.isRejected(left)){
        return left;
    }
    if (TaskResult.isRejected(right)){
        return right;
    }

    return TaskResult.of(_.concat(left.value, right.value));
});

TaskResult.ap = _.curry(function(apply, taskresult) {
    return TaskResult.isRejected(apply) ? apply : TaskResult.map(apply.value, taskresult);
});

TaskResult.flatten = _.curry(function(taskresult) {
    return TaskResult.isRejected(taskresult) ? taskresult : taskresult.value;
});

TaskResult.show = TaskResult.case({
    Rejected: function(value) {
        return "TaskResult.Rejected(" + _.show(value) + ")";
    },
    Resolved: function(value) {
        return "TaskResult.Resolved(" + _.show(value) + ")";
    }
});

module.exports = TaskResult;