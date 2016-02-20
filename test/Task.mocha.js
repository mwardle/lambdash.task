var assert = require('assert');

var _ = require('lambdash');
var Task = require('../src/Task');

function delayedTask(delay, fn, rejected) {
    return Task(function(reject, resolve){
        setTimeout(function(){
            rejected ? reject(fn()) : resolve(fn());
        }, delay);
    });
}

var tt = _.thunk(assert, true);
var tf = _.thunk(assert, false);

var equal = _.curryN(2, assert.equal.bind(assert));

describe('Task', function(){


    describe('#of', function(){
        it('should a task that resolves to the passed value', function(done){
            var task = Task.of('ok');
            assert(Task.member(task));

            task.exec(tf, _.compose(done, equal("ok")));
        });
    });

    describe('#reject', function(){
        it('should a task that rejects with the passed value', function(done){
            var task = Task.reject('oops');
            assert(Task.member(task));

            task.exec(_.compose(done, equal("oops")), tf);
        });
    });

    describe('#map', function(){
        it('should create a new task whose result is mapped with the provided function', function(done){
            var task = Task.map(_.add(1), Task.of(1));

            assert(Task.member(task));

            task.exec(tf, _.compose(done, equal(2)));
        });

        it('should create a new task whose result is the rejected value if the result of the original task is a reject', function(done){
            var task = Task.map(_.add(1), Task.reject(1));

            assert(Task.member(task));

            task.exec(_.compose(done, equal(1)), tf);
        });
    });

    describe('#mapRejected', function(){
        it('should create a new task whose rejection is mapped with the provided function', function(done){
            var task = Task.mapRejected(_.add(1), Task.reject(1));

            assert(Task.member(task));

            task.exec(_.compose(done, equal(2)), tf);
        });

        it('should create a new task whose result is the resolved value if the result of the original task is resolved', function(done){
            var task = Task.mapRejected(_.add(1), Task.of(1));

            assert(Task.member(task));

            task.exec(tf, _.compose(done, equal(1)));
        });
    });

    describe('#recover', function(){
        it('should recover from a rejected state if the predicate returns true', function(done){
            var t = Task.recover(_.eq(1), _.add(2), Task.reject(1));

            Task.fork(tf, _.compose(done, equal(3)), t);
        });

        it('should not recover from a rejected state if the predicate returns false', function(done){
            var t = Task.recover(_.eq(2), _.add(2), Task.reject(1));

            Task.fork(_.compose(done, equal(1)), tf, t);
        });

        it('should not recover from a resolved state', function(done){
            var t = Task.recover(_.eq(2), _.add(2), Task.of(1));

            Task.fork(tf, _.compose(done, equal(1)), t);
        });
    });

    describe('#concatSeries', function(){
        it('should concatenate two async functions with a serial execution order', function(done){
            var inc = 0;
            function getInc(){
                inc += 1;
                return [inc];
            }
            var t1 = delayedTask(20, getInc);
            var t2 = delayedTask(10, getInc);

            var t3 = Task.concatSeries(t1, t2);
            var t4 = Task.concatSeries(t2, t1);

            t3.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result.length, 2);
                assert.equal(result[0], 1);
                assert.equal(result[1], 2);

                t4.exec(tf, function(result){
                    assert(_.Arr.member(result));
                    assert.equal(result.length, 2);
                    assert.equal(result[0], 3);
                    assert.equal(result[1], 4);

                    done();
                });
            });

        });

        it('should return a rejected value if either task comes back rejected', function(done){
            var t1 = Task.of(["ok"]);
            var t2 = Task.reject("err1");
            var t3 = Task.reject("err2");

            var t4 = Task.concatSeries(t1, t2);
            var t5 = Task.concatSeries(t2, t1);
            var t6 = Task.concatSeries(t2, t3);

            t4.exec(function(result){
                assert.equal(result, "err1");

                t5.exec(function(result) {
                    assert.equal(result, "err1");

                    t6.exec(function(result) {
                        assert.equal(result, "err1");
                        done();
                    }, tf);
                }, tf);
            }, tf);
        });

        it('should allow for multiple concatenations', function(done){
            var t1 = Task.of([1]);
            var t2 = Task.of([2]);
            var t3 = Task.of([3]);

            var t4 = Task.concat(Task.concat(t1, t2), t3);
            var t5 = Task.concat(t1, Task.concat(t2, t3));

            t4.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result.length, 3);
                assert.equal(result[0], 1);
                assert.equal(result[1], 2);
                assert.equal(result[2], 3);

                t5.exec(tf, function(result){
                    assert(_.Arr.member(result));
                    assert.equal(result.length, 3);
                    assert.equal(result[0], 1);
                    assert.equal(result[1], 2);
                    assert.equal(result[2], 3);
                    done();
                });
            });
        });
    });

    describe('#concatParallel', function(){
        it('should concatenate two async functions with a parallel execution order', function(done){
            var inc = 0;
            function getInc(){
                inc += 1;
                return [inc];
            }
            var t1 = delayedTask(20, getInc);
            var t2 = delayedTask(10, getInc);

            var t3 = Task.concatParallel(t1, t2);
            var t4 = Task.concatParallel(t2, t1);

            t3.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result.length, 2);
                assert.equal(result[0], 2);
                assert.equal(result[1], 1);

                t4.exec(tf, function(result){
                    assert(_.Arr.member(result));
                    assert.equal(result.length, 2);
                    assert.equal(result[0], 3);
                    assert.equal(result[1], 4);

                    done();
                });
            });

        });

        it('should return a rejected value if either task comes back rejected', function(done){
            var t1 = Task.of(["ok"]);
            var t2 = Task.reject("err1");
            var t3 = Task.reject("err2");

            var t4 = Task.concatParallel(t1, t2);
            var t5 = Task.concatParallel(t2, t1);
            var t6 = Task.concatParallel(t2, t3);

            t4.exec(function(result){
                assert.equal(result, "err1");

                t5.exec(function(result) {
                    assert.equal(result, "err1");

                    t6.exec(function(result) {
                        assert.equal(result, "err1");
                        done();
                    }, tf);
                }, tf);
            }, tf);
        });

        it('should allow for multiple concatenations', function(done){
            var t1 = Task.of([1]);
            var t2 = Task.of([2]);
            var t3 = Task.of([3]);

            var t4 = Task.concatParallel(Task.concatParallel(t1, t2), t3);
            var t5 = Task.concatParallel(t1, Task.concatParallel(t2, t3));

            t4.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result.length, 3);
                assert.equal(result[0], 1);
                assert.equal(result[1], 2);
                assert.equal(result[2], 3);

                t5.exec(tf, function(result){
                    assert(_.Arr.member(result));
                    assert.equal(result.length, 3);
                    assert.equal(result[0], 1);
                    assert.equal(result[1], 2);
                    assert.equal(result[2], 3);
                    done();
                });
            });
        });
    });


    describe('#series', function(){

        it('should create a task from a foldable value that executes all functions serially', function(done){
            var inc = 0;
            var getInc = function(){
                inc += 1;
                return inc;
            };
            var task = Task.series([
                delayedTask(30, getInc),
                delayedTask(20, getInc),
                delayedTask(40, getInc),
                delayedTask(10, getInc)
            ]);

            task.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result[0], 1);
                assert.equal(result[1], 2);
                assert.equal(result[2], 3);
                assert.equal(result[3], 4);
                done();
            });
        });

        it('should return a reject if any of the values reject', function(done){
            var inc = 0;
            var getInc = function(){
                inc += 1;
                return inc;
            };
            var task = Task.series([
                delayedTask(30, getInc, true),
                delayedTask(20, getInc),
                delayedTask(40, getInc),
                delayedTask(10, getInc)
            ]);

            task.exec(_.compose(done, equal(1)), tf);
        });

        it('should resolve with an empty collection if given an empty collection', function(done){
            var task = Task.series([]);
            task.exec(tf, _.compose(done, function(v){
                assert(_.Arr.member(v));
                assert.equal(v.length, 0);
            }));
        });
    });

    describe('#parallel', function(){

        it('should create a task from a foldable value that executes all functions in parallel', function(done){
            var inc = 0;
            var getInc = function(){
                inc += 1;
                return inc;
            };
            var task = Task.parallel([
                delayedTask(30, getInc),
                delayedTask(20, getInc),
                delayedTask(40, getInc),
                delayedTask(10, getInc)
            ]);

            task.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert.equal(result[0], 3);
                assert.equal(result[1], 2);
                assert.equal(result[2], 4);
                assert.equal(result[3], 1);
                done();
            });
        });

        it('should return a reject if any of the values reject', function(done){
            var inc = 0;
            var getInc = function(){
                inc += 1;
                return inc;
            };
            var task = Task.parallel([
                delayedTask(30, getInc, true),
                delayedTask(20, getInc),
                delayedTask(40, getInc),
                delayedTask(10, getInc)
            ]);

            task.exec(_.compose(done, equal(3)), tf);
        });

        it('should resolve with an empty collection if given an empty collection', function(done){
            var task = Task.parallel([]);
            task.exec(tf, _.compose(done, function(v){
                assert(_.Arr.member(v));
                assert.equal(v.length, 0);
            }));
        });
    });

    describe('#partition', function(){

        it('should create a task from a foldable value that executes all functions in parallel', function(done){
            var inc = 0;
            var getInc = function(){
                inc += 1;
                return inc;
            };
            var task = Task.partition([
                delayedTask(30, getInc),
                delayedTask(20, getInc),
                delayedTask(40, getInc),
                delayedTask(10, getInc, true)
            ]);

            task.exec(tf, function(result){
                assert(_.Arr.member(result));
                assert(_.Arr.member(result[0]));
                assert(_.Arr.member(result[1]));
                assert.equal(result[0].length, 1);
                assert.equal(result[1].length, 3);
                done();
            });
        });

        it('should resolve with an empty resolved and rejected collection if given an empty collection', function(done){
            var task = Task.partition([]);
            task.exec(tf, _.compose(done, function(v){
                assert(_.Arr.member(v));
                assert.equal(v.length, 2);
                assert.equal(v[0].length, 0);
                assert.equal(v[1].length, 0);
            }), tf);
        });
    });

    describe('#ap', function(){
        it('should apply a task that resolves to a function to a task that resolves to a value', function(done){
            var taskFn = Task.of(_.add(1));
            var taskV = Task.of(1);

            var t = Task.ap(taskFn, taskV);

            t.exec(tf, _.compose(done, equal(2)));
        });

        it('should return a reject if the function task is rejected', function(done){
            var taskFn = Task.reject(1);
            var taskV = Task.reject(2);

            var t = Task.ap(taskFn, taskV);

            t.exec(_.compose(done, equal(1)), tf);
        });

        it('should return a reject if the value task is rejected', function(done){
            var taskFn = Task.of(_.add(1));
            var taskV = Task.reject(2);

            var t = Task.ap(taskFn, taskV);

            t.exec(_.compose(done, equal(2)), tf);

        });

    });

    describe('#flatten', function(){
        it('should resolve to the value contained in a nested task', function(done){
            var task = Task.flatten(Task.of(Task.of(1)));

            task.exec(tf, _.compose(done, equal(1)))
        });

        it('should return a rejected value if given a task that rejects', function(done){
            var task = Task.flatten(Task.reject('oops'));

            task.exec(_.compose(done, equal('oops')), tf);
        });
    });

    describe('#chain', function(){
        it('should flatmap a task', function(done){
            var fn = function(number) {
                return Task.of(number + 1);
            };

            var task = Task.chain(fn, Task.of(1));

            task.exec(tf, _.compose(done, equal(2)));
        });

        it('should return a reject if the initial value is rejected', function(done){
            var fn = function(number) {
                return Task.of(number + 1);
            };

            var task = Task.chain(fn, Task.reject(1));

            task.exec(_.compose(done, equal(1)), tf);
        });
    });

    describe('#chainRejected', function(){
        it('should flatmap a task\'s rejected value', function(done){
            var fn = function(number) {
                return Task.of(number + 1);
            };

            var task = Task.chainRejected(fn, Task.reject(1));

            task.exec(tf, _.compose(done, equal(2)));
        });

        it('should return the original value if the value is resolved', function(done){
            var fn = function(number) {
                return Task.of(number + 1);
            };

            var task = Task.chainRejected(fn, Task.of(1));

            task.exec(tf, _.compose(done, equal(1)));
        });
    });


    describe('#fork', function(){
        it('should execute a task with a rejected and resolved function', function(done){
            var t = Task.of(1);

            Task.fork(tf, _.compose(done, equal(1)), t);

        });

        it('should execute a task with a rejected and resolved function', function(done){
            var t = Task.reject(1);

            Task.fork(_.compose(done, equal(1)),tf, t);

        });
    });

    describe('#bimap', function() {
        it('should create a new task which maps the right and the left of an existing task', function(done){
            var t1 = Task.of(1);
            var t2 = Task.reject(4);

            var fn1 = _.add(1);
            var fn2 = _.sub(1);

            Task.bimap(fn1, fn2, t1).exec(tf, function(v){
                assert.equal(v, 0);
                Task.bimap(fn1, fn2, t2).exec(_.compose(done, equal(5)), tf);
            });
        });
    });

    describe('#fromAsync', function(){
        it('should create a task from an async function', function(done){
            var fn = function(cb) {
                process.nextTick(function(){
                    cb(null, "ok");
                });
            };

            var task = Task.fromAsync(fn);

            task.exec(tf, _.compose(done, equal('ok')));
        });

        it('should reject if the function calls back with an error', function(done){
            var fn = function(cb) {
                cb("oh no", "ok");
            };

            var task = Task.fromAsync(fn);

            task.exec(_.compose(done, equal('oh no')), tf);
        });
    });

    describe('#immediate', function(){
        it('should not affect the outcome of a task', function(done){
            var task = Task.immediate(Task.of(1));
            task.exec(tf, _.compose(done, equal(1)));
        });
    });

    describe('#delay', function(){
        it('should not affect the outcome of a task', function(done){
            var start = Date.now();
            var task = Task.delay(40, Task.of(1));
            task.exec(tf, _.compose(done, function(){
                assert(Date.now() - start > 40);
                assert(Date.now() - start < 50);
            }, equal(1)));
        });
    });

    describe('#timeoutWith', function(){
        it('should resolve if the timeout is greater than the time the task takes', function(done){
            var task = Task.delay(20, Task.of(1));
            var totask = Task.timeoutWith(_.alwaysThrow(Error, "timeout"), 40)(task);


            totask.exec(tf, function(value){
                // make sure it doesn't reject later from the timeout
                assert.equal(value, 1);
                setTimeout(done, 30);
            });
        });

        it('should reject if the timeout is greater than the time the task takes', function(done){
            var task = Task.delay(20, Task.reject(1));
            var totask = Task.timeoutWith(_.alwaysThrow(Error, "timeout"), 40)(task);


            totask.exec(function(value){
                // make sure it doesn't reject later from the timeout
                assert.equal(value, 1)
                setTimeout(done, 30);
            }, tf);
        });

        it('should reject with the timeout if it takes too long even though it would resolve', function(done){
            var task = Task.delay(40, Task.of(1));
            var totask = Task.timeoutWith(_.always(2), 20)(task);


            totask.exec(function(value){
                // make sure it doesn't resolve later
                assert.equal(value, 2)
                setTimeout(done, 30);
            }, tf);
        });

        it('should reject with the timeout if it takes too long even though it would reject', function(done){
            var task = Task.delay(40, Task.reject(1));
            var totask = Task.timeoutWith(_.always(2), 20)(task);


            totask.exec(function(value){
                // make sure it doesn't resolve later
                assert.equal(value, 2)
                setTimeout(done, 30);
            }, tf);
        });
    });

    describe('#timeout', function(){
        it('should resolve if the timeout is greater than the time the task takes', function(done){
            var task = Task.delay(20, Task.of(1));
            var totask = Task.timeout(40)(task);


            totask.exec(tf, function(value){
                // make sure it doesn't reject later from the timeout
                assert.equal(value, 1);
                setTimeout(done, 30);
            });
        });

        it('should reject if the timeout is greater than the time the task takes', function(done){
            var task = Task.delay(20, Task.reject(1));
            var totask = Task.timeout(40)(task);


            totask.exec(function(value){
                // make sure it doesn't reject later from the timeout
                assert.equal(value, 1)
                setTimeout(done, 30);
            }, tf);
        });

        it('should reject with the timeout if it takes too long even though it would resolve', function(done){
            var task = Task.delay(40, Task.of(1));
            var totask = Task.timeout(20)(task);


            totask.exec(function(value){
                // make sure it doesn't resolve later
                assert(value instanceof Error);
                assert(value instanceof Task.TimeoutError);
                assert(value.stack);
                assert.equal(value.message, "Task timed out after 20ms");
                setTimeout(done, 30);
            }, tf);
        });

        it('should reject with the timeout if it takes too long even though it would reject', function(done){
            var task = Task.delay(40, Task.reject(1));
            var totask = Task.timeout(20)(task);


            totask.exec(function(value){
                // make sure it doesn't resolve later
                assert(value instanceof Error);
                assert(value instanceof Task.TimeoutError);
                assert(value.stack);
                assert.equal(value.message, "Task timed out after 20ms");
                setTimeout(done, 30);
            }, tf);
        });
    });

    describe('#caught', function(done){
        it('should catch an exception and reject the task with it', function(done){
            var task = Task(function(reject,resolve){
                throw new Error('catch me');
            });

            var caught = Task.caught(task);

            caught.exec(function(reason){
                assert.equal(reason instanceof Error, true);
                assert.equal(reason.message, 'catch me');
                done();
            }, tf);
        });

    });


    describe('#taskify', function(){
        it('should create a function from a regular async function that returns a task', function(done){
            var async = function(a, b, callback) {
                callback(null, a + b);
            };

            var taskified = Task.taskify(async);

            assert(_.Fun.member(taskified));
            assert.equal(taskified.length, 2);

            var add1 = taskified(1);

            assert(_.Fun.member(add1));
            assert.equal(add1.length, 1);

            var task = add1(2);

            assert(Task.member(task));

            task.exec(tf, _.compose(done, equal(3)));
        });
    });

    describe('#taskify2', function(){
        it('should create a function from a regular async function that returns a task', function(done){
            var async = function(a, b, callback) {
                callback(a + b);
            };

            var taskified = Task.taskify2(async);

            assert(_.Fun.member(taskified));
            assert.equal(taskified.length, 2);

            var add1 = taskified(1);

            assert(_.Fun.member(add1));
            assert.equal(add1.length, 1);

            var task = add1(2);

            assert(Task.member(task));

            task.exec(tf, _.compose(done, equal(3)));
        });
    });



    describe('@implements', function(){
        it('should implement Functor', function(){
            assert(_.Functor.member(Task.of(1)));
        });

        it('should implement Semigroup', function(){
            assert(_.Semigroup.member(Task.of(1)));
        });

        it('should implement Applicative', function(){
            assert(_.Applicative.member(Task.of(1)));
        });

        it('should implement Monad', function(){
            assert(_.Monad.member(Task.of(1)));
        });

        it('should implement Show', function(){
            assert(_.Monad.member(Task.of(1)));
        });
    });


});
