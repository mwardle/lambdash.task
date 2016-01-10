var _ = require('lambdash');

Task = _.Type.product('Task', {exec: _.Fun});

var immediate = process && _.Fun.member(process.nextTick)
    ? process.nextTick
    : setTimeout;

/**
 * Creates a task that resolves to a given value
 *
 * @sig b -> Task a b
 */
Task.of = _.curry(function(value){
    return Task(function(reject, resolve){
        resolve(value);
    });
});

/**
 * An alias of Task.of
 *
 * @sig b -> Task a b
 */
Task.resolve = Task.of;

/**
 * Creates a task that rejects with a given value
 *
 * @sig a -> Task a b
 */
Task.reject = _.curry(function(value){
    return Task(function(reject, resolve){
        reject(value);
    });
});

/**
 * @sig (b -> d) -> Task a b -> Task a d
 */
Task.map = _.curry(function(fn, task){
    return Task(function(reject, resolve){
        task.exec(reject, _.compose(resolve, fn));
    });
});

/**
 * @sig (a -> c) -> Task a b -> task c b
 */
Task.mapRejected = _.curry(function(fn, task){
    return Task(function(reject, resolve){
        task.exec(_.compose(reject, fn), resolve);
    });
});

/**
 * Potentially recovers a task from a rejected to a resolved state
 *
 * This function will only run if the task is rejected upon execution.
 *
 * The first parameter is a predicate to test if the recovery should happen.
 * If the predicate returns true, the task will resolve with the result of
 * executing the transform function with the rejected value.
 *
 * @sig (a -> Boolean) -> (a -> b) -> Task a b -> Task a b
 * @since 0.5.0
 *
 * @example
 *
 *      var fail = Task.reject("oh no");
 *
 *      var taskOk = Task.recover(_.eq("oh no"), _.always("ok"), fail);
 *      Task.fork(function(failure){
 *          // this doesn't happen because the condition passed
 *      }, function(result){
 *          // result is "ok" here
 *      }, taskOk);
 *
 *      var taskOhNo = Task.recover(_.eq("oh boy"), _.always("ok"), fail);
 *      Task.fork(function(failure){
 *          // failure is "oh no" here
 *      }, function(result){
 *          // this doesn't happen because the condition didn't pass
 *      }, taskOhNo);
 */
Task.recover = _.curry(function(cond, transform, task){
    return Task(function(reject, resolve){
        var _recover = function(value) {
            if (cond(value)) {
                resolve(transform(value));
            } else {
                reject(value);
            }
        };
        task.exec(_recover, resolve);
    });
});

/**
 * Same as recover except without the condition.
 *
 * @sig (a -> b) -> Task a b -> Task a b
 */
Task.alwaysRecover = Task.recover(_.T);

/**
 * @sig Semigroup b => Task a b -> Task a b -> Task a b
 */
Task.concatSeries = _.curry(function(left, right){
    return Task(function(reject, resolve){
        left.exec(reject, function(l){
            right.exec(reject, function(r){
                resolve(_.concat(l,r));
            });
        })
    });
});

/**
 * @sig Semigroup b => Task a b -> Task a b -> Task a b
 */
Task.concatParallel = _.curry(function(left, right) {
    return Task(function(reject, resolve){
        var l;
        var r;
        var lRet = false;
        var rRet = false;
        var rejected = false;
        function _rej(r){
            if (!rejected){
                rejected = true;
                reject(r);
            }
        }

        left.exec(_rej, function(result){
            l = result;
            lRet = true;
            if (rRet) {
                resolve(_.concat(l, r));
            }
        });

        right.exec(_rej, function(result){
            r = result;
            rRet = true;
            if (lRet) {
                resolve(_.concat(l, r));
            }
        })

    });
});

/**
 * @sig Semigroup b => Task a b -> Task a b -> Task a b
 */
Task.concat = Task.concatParallel;


/**
 * Creates a task that applies the resolved value of one task to the value of another task.
 *
 * @sig Task a (b -> d) -> Task a b -> Task a d
 */
Task.ap = _.curry(function(apply, task) {
    return Task(function(reject, resolve) {
        apply.exec(reject, function(fnResult){
            task.exec(reject, function(result){
                resolve(fnResult(result));
            });
        });
    });
});

/**
 * Returns a task which flattens a nested task.
 *
 * @sig Task a (Task a b) -> Task a b
 */
Task.flatten = _.curry(function(task) {
    return Task(function(reject, resolve){
        task.exec(reject, function(result){
            result.exec(reject, resolve);
        });
    });
});

/**
 * Monadically flatMaps a tasks resolved value.
 *
 * @sig (b -> Task a d) -> Task a b -> Task a d
 */
Task.chain = _.curry(function(fn, task){
    return Task(function(reject, resolve){
        task.exec(reject, function(result){
            fn(result).exec(reject, resolve);
        });
    });
});

/**
 * Monadically flatMaps a tasks rejected value.
 *
 * @sig (b -> Task a d) -> Task a b -> Task a d
 */
Task.chainRejected = _.curry(function(fn, task){
    return Task(function(reject, resolve){
        task.exec(function(result){
            fn(result).exec(reject, resolve);
        }, resolve);
    });
});

/**
 * @sig (Monoid s, Foldable s) => s (Task a b) -> Task a (s b)
 */
Task.series = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);

    if (_.isEmpty(tasks)) {
        // cannot do anything with an empty list of tasks
        return Task.of(M.empty());
    }

    return _.foldr(function(accum, task){
        return Task.concatSeries(Task.map(M.of, task), accum);
    }, Task.of(M.empty()), tasks);
});

/**
 * @sig (Monoid s, Foldable s) => s (Task a b) -> Task a (s b)
 */
Task.parallel = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);

    if (_.isEmpty(tasks)) {
        // cannot do anything with an empty list of tasks
        return Task.of(M.empty());
    }

    return _.foldr(function(accum, task){
        return Task.concatParallel(Task.map(M.of, task), accum);
    }, Task.of(M.empty()), tasks);
});

/**
 * Runs a collection of tasks in parallel, returning the rejected and resolved values as separate collections.
 *
 * @sig (Monoid s, Foldable s) => s (Task a b) -> Task a (s s (a|b)))
 */
Task.partition = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);
    var l = _.length(tasks);

    if (l === 0) {
        // cannot do anything with an empty list of tasks
        return Task.of(_.concat(M.of(M.empty()), M.of(M.empty())));
    }

    var completed = 0;
    var resolveds = M.empty();
    var rejects = M.empty();



    return Task(function(reject, resolve){

        var _check = function(){
            completed += 1;
            if (completed === l) {
                resolve(_.concat(M.of(rejects), M.of(resolveds)));
            }
        };
        var _rej = function(value){
            rejects = _.append(value, rejects);
            _check();
        };
        var _res = function(value){
            resolveds = _.append(value, resolveds);
            _check();
        };

        return _.foldr(function(accum, task){
            task.exec(_rej, _res);
        }, null, tasks);
    });

});


/**
 * Executes a task.
 *
 * The first function will be called if the task is rejected.
 * The second function will be called if the task is resolved.
 *
 * @sig (a -> ()) -> (b -> ()) -> Task a b -> ()
 */
Task.fork = _.curry(function(rejected, resolved, task){
    task.exec(rejected, resolved);
});

/**
 * Maps both the rejected and resolved value of a task.
 *
 * @sig (a -> c) -> (b -> d) -> Task a b -> Task c d
 */
Task.bimap = _.curry(function(rejected, resolved, task){
    return Task(function(reject, resolve){
        task.exec(_.compose(reject, rejected), _.compose(resolve, resolved));
    });
});

Task.fromAsync = _.curry(function(async) {
    return Task(function(reject, resolve){
        async(function(err, result){
            err == null ? resolve(result) : reject(err);
        });
    });
});

Task.fromAsync2 = _.curry(function(async) {
    return Task(function(reject, resolve){
        async(resolve);
    });
});

/**
 * Creates a function from a normal async function that returns a task.
 *
 * @example
 *
 *      var stat = Task.taskify(fs.stat);
 *      var task = stat('somefile.txt');
 *      Task.fork(onRejected, onResolved, task);
 */
Task.taskify = _.curry(function(async) {
    return _.curryN(async.length - 1, function(){
        return Task.fromAsync(_.curry(async).apply(this, arguments));
    });
});

/**
 * Creates a function from a normal async function that returns a task.
 *
 * @example
 *
 *      var stat = Task.taskify(fs.stat);
 *      var task = stat('somefile.txt');
 *      Task.fork(onRejected, onResolved, task);
 */
Task.taskify2 = _.curry(function(async) {
    return _.curryN(async.length - 1, function(){
        return Task.fromAsync2(_.curry(async).apply(this, arguments));
    });
});

/**
 * Makes a task run async (non-blocking).
 *
 * @sig Task a b -> Task a b
 */
Task.immediate = _.curry(function(task){
    return Task(function(reject, resolve){
        immediate(function(){
            task.exec(reject, resolve);
        });
    });
});

/**
 * Makes a task wait to run for a specified number of milliseconds.
 *
 * @sig Number -> Task a b -> Task a b
 */
Task.delay = _.curry(function(delay, task){
    return Task(function(reject, resolve){
        setTimeout(function(){
            task.exec(reject, resolve);
        }, delay);
    });
});


Task.show = _.always('Task');

module.exports = Task;
