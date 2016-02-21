# Task

A task is an asynchronous computation.

## Task data type

A task is a container type that holds a single operation.
The task data type implements [lambdash's](https://github.com/mwardle/lambdash.git) Semigroup, Functor, Applicative, Monad, and Show interfaces.

A task object has the signature `{exec: (a -> ()) -> (b -> ()) -> ()}`
A task objects signature is written as `Task a b` where a is the type of the task's rejected value and b is the type of the task's resolved value.
A task should be thought of as containing either a rejected value or a resolved value
despite the fact that no value has been computed until the task's computation is executed.

## Functions

### Task :: `((a -> ()) -> (b -> ()) -> ()) -> Task a b`

Creates a task.
The function passed to `Task` should take two arguments.
The first argument is a function that should be called if the task results in a rejected (errored) state with the error value.
The second argument is a function that should be called with the resolved (successful) result of the task.
The provided function should call either the rejected or resolved function exactly once.

```javascript

    var task = Task(function(reject, resolve){
        // unnecessary asynchronicity
        process.nextTick(function(){
            resolve("Some Result");
        });
    });

    Task.fork(function(reason){
        // handle failure
    }, function(result) {
        // result === "Some Result"
    }, task)

```

### Task.of :: `b -> Task a b`

Creates a Task that resolves to the given value.

```javascript

    var task = Task.of("Some Result");

    Task.fork(function(reason){
        // handle failure
    }, function(result) {
        // result === "Some Result"
    }, task);

```

### Task.resolve :: `b -> Task a b`

This is an alias of Task.of.

### Task.reject :: `a -> Task a b`

Creates a Task that will always reject with the given reason.

```javascript

    var task = Task.reject("Something wrong happened");

    Task.fork(function(reason){
        // reason is "Something wrong happened";
    }, function(result) {
        // this does not execute
    }, task);

```

### Task.map :: `(b -> d) -> Task a b -> Task a d`

Creates a new task which applies a function to the resolved value of another task.
If the mapped task rejects, the new task will reject without any change.

```javascript

    var task1 = Task.of(1);
    var task2 = Task.map(_.add(2), task1);

    Task.fork(function(reason){
        // this does not run;
    }, function(result) {
        // result is 3
    }, task2);



    var task3 = Task.reject(1);
    var task4 = Task.map(_.add(2), task3);

    Task.fork(function(reason){
        // reason is still 1 here
    }, function(result) {
        // this does not run
    }, task4);

```

### Task.mapRejected :: `(b -> d) -> Task a b -> Task a d`

Creates a new task which applies a function to the rejected value of another task.
If the mapped task resolves, the new task will resolve without any change.

```javascript

    var task1 = Task.reject(1);
    var task2 = Task.mapRejected(_.add(2), task1);

    Task.fork(function(reason){
        // reason is 3 here
    }, function(result) {
        // this does not run
    }, task2);



    var task3 = Task.of(1);
    var task4 = Task.mapRejected(_.add(2), task3);

    Task.fork(function(reason){
        // this does not run
    }, function(result) {
        // result is still 1 here
    }, task4);

```

### Task.recover :: `(a -> Boolean) -> (a -> b) -> Task a b -> Task a b`

Returns a new task which potentially recovers another task from a rejected state.
If the given task resolves rather than rejects, this function has no affect.

This function has 3 parameters:

1. condition: a function that accepts a rejection reason and returns a boolean. If the condition returns true, the transform will be called and the task will resolve.
2. transform: a function that accepts a rejection reason and returns a value that will be resolved by the task.
3. task: the task that is being recovered


```javascript

    var reject1 = Task.reject("oh no");
    var reject2 = Task.reject("oh boy");

    var recoverOhNo = Task.recover(_.eq("oh no"), _.always("all ok"));

    Task.fork(function(reason){
        // does not run
    }, function(result) {
        // result is "all ok"
    }, recoverOhNo(reject1));

    Task.fork(function(reason){
        // reason is still "oh boy"
    }, function(result) {
        // does not run since the condition did not pass
    }, recoverOhNo(reject2));

```

### Task.alwaysRecover :: `(a -> b) -> Task a b -> Task a b`

Functions the same as recover, but without the condition.

### Task.concatSeries :: `Semigroup b => Task a b -> Task a b -> Task a b`

Returns a task that concatenates the resolved values of two tasks with serial execution.

If either of the tasks rejects, the new task will reject with the same value.

```javascript

    var left = Task.delay(30, Task.of([1,2]));
    var right = Task.delay(20, Task.of([3,4]));
    var task = Task.concatSeries(left, right);

    Task.fork(function(reason){
        // does not run
    }, function(result){
        // result is [1,2,3,4]
        // the whole thing should take about 50 ms (20 + 30)
    }, task);

    left = Task.delay(30, Task.reject("oh no"));
    right = Task.delay(20, Task.reject("oh boy"));
    var reject = Task.concatSeries(left, right);

    Task.fork(function(reason){
        // reason is "oh no" since the right task will not be executed at all
    }, function(result){
        // will not run
    }, reject);

```

### Task.concatParallel :: `Semigroup b => Task a b -> Task a b -> Task a b`

Returns a task that concatenates the resolved values of two tasks with parallel execution.

If either of the tasks rejects, the new task will reject with the same value.

```javascript

    var left = Task.delay(30, Task.of([1,2]));
    var right = Task.delay(20, Task.of([3,4]));
    var task = Task.concatParallel(left, right);

    Task.fork(function(reason){
        // does not run
    }, function(result){
        // result is [1,2,3,4]
        // the whole thing should take about 30 ms (max of 20 and 30)
    }, task);

    left = Task.delay(30, Task.reject("oh no"));
    right = Task.delay(20, Task.reject("oh boy"));
    var reject = Task.concatParallel(left, right);

    Task.fork(function(reason){
        // reason is "oh boy" since the right task will reject earlier
    }, function(result){
        // will not run
    }, reject);

```

### Task.concat :: `Semigroup b => Task a b -> Task a b -> Task a b`

This is an alias for Task.concatParallel

### Task.ap :: `Task a (b -> d) -> Task a b -> Task a d`

Returns a task which applies a resolved value of one task the the resolved value of another.

If either task rejects, the new task will reject with the same value.
If the first task rejects, the second will not run.

```javascript

    var task = Task.ap(Task.of(_.add(2)), Task.of(1));

    Task.fork(function(reason){
        // will not run
    }, function(result){
        // result is 3 here
    }, task);

```

### Task.flatten :: `Task a (Task a b) -> Task a b`

Returns a task which calls the nested result of another task.

```javascript

    var task = Task.of(Task.of("ok"));
    var flattened = Task.flatten(task);

    Task.fork(function(reason){
        // will not run
    }, function(result){
        // result is "ok" here
    }, flattened);

```

### Task.chain :: `(b -> Task a d) -> Task a b -> Task a d`

Monadically flat-maps a task.

This function is equivalent to `_.compose(Task.flatten, Task.map)` though the implementation is slightly more efficient.

```javascript

    var readFile = Task.taskify(fs.readFile)(_, 'utf8');
    var jsonify = function(data) {
        try {
            return Task.of(JSON.parse(data));
        } catch (e) {
            return Task.reject(e);
        }
    }

    var task = Task.chain(jsonify, readFile('somefile.json'));
    // alternatively ...
    // var task = _.composeM(jsonify, readFile)(Task.of('somefile.json'));

    Task.fork(function(reason){
        // if there is an error reading the file
        // or if the file contained invalid json
        // this will run with the error
    }, function(obj) {
        // obj will be an object parsed from the json file
    }, task);

```

### Task.chainRejected :: `(a -> Task c b) -> Task a b -> Task c b`

Monadically flat-maps a tasks rejected value.

This function can be used to recover from an error.

```javascript

    var readFile = Task.taskify(fs.readFile)(_, 'utf8');
    var jsonify = function(data) {
        try {
            return Task.of(JSON.parse(data));
        } catch (e) {
            return Task.reject(e);
        }
    }

    var defaults = function(err) {
        return Task.of({ /* Some default settings */ });
    }

    var getSettings = Task.chain(jsonify, readFile('settings.json'));
    var getSettingsOrUseDefaults = Task.chainRejected(defaults, getSettings);

    Task.fork(function(reason){
        // this wont run since we recovered the error with the defaults
    }, function(obj) {
        // obj will be an object parsed from the json file
        // or it will be the default settings if an error occurred
    }, getSettingsOrUseDefaults);

```

### Task.series :: `(Monoid s, Foldable s) => s (Task a b) -> Task a (s b)`

Creates a task which runs a collection of tasks and collects them.
If any of the tasks reject, the new task will reject with the same value.

The tasks execute serially.
As such the run time of the new task will be approximately equal to the sum of the run times of all the tasks.

The order of the resolved values is stable.

```javascript

    var tasks = [
        Task.delay(20, Task.of(1)),
        Task.delay(30, Task.of(2)),
        Task.delay(10, Task.of(3))
    ];

    var task = Task.series(tasks);

    Task.fork(function(reason) {
        // would run if any of the tasks rejected
    }, function (result) {
        // result is [1,2,3]
        // The task will take about 60 ms to complete (20 + 30 + 10)
    }, task);

```

### Task.parallel :: `(Monoid s, Foldable s) => s (Task a b) -> Task a (s b)`

Creates a task which runs a collection of tasks and collects them.
If any of the tasks reject, the new task will reject with the same value.

The tasks execute in parallel.
As such the run time of the new task will be approximately equal to the longest running task in the collection.

The order of the resolved values is stable.

```javascript

    var tasks = [
        Task.delay(20, Task.of(1)),
        Task.delay(30, Task.of(2)),
        Task.delay(10, Task.of(3))
    ];

    var task = Task.parallel(tasks);

    Task.fork(function(reason) {
        // would run if any of the tasks rejected
        // with the reason of the earliest rejected task
    }, function (result) {
        // result is [1,2,3]
        // The task will take about 30 ms to complete (max of 20,30,10)
    }, task);

```

Task.partition :: `(Monoid s, Foldable s) => s (Task a b) -> Task a (s s (a|b)))`

Creates a task which runs a collection of tasks collecting the rejected and resolved values in separate collections.
As an example, this may be useful for validation where all failures should be collected rather than just the first.

The tasks are run in parallel and the order of the rejected and resolved collections is **not stable**.

The created task will never reject.


```javascript

    var validate = _.curry(function(validation, prop, obj) {
        var _valid = function(value) {
            return validation(value) ? Task.of(prop + "is ok") : Task.reject(prop + "is invalid");
        }
        return Task.chain(_valid, Task.of(obj[prop]));
    });

    var validations = [
        validate(_.Str.member, "a"),
        validate(_.gt(2), "b"),
        validate(_.eq(5), "c")
    ];

    function validateObj(obj, onResolved) {
        var tasks = _.map(_.apply([obj]));

        Task.fork(_.noop, onResolved, Task.partition(tasks));
    }

    var obj = {
        a: "ok",
        b: 1,
        c: 5
    }

    validateObj(obj, function(results){
        var failures = results[0];
        var successes = results[1];

        // failures is ['b is invalid']
        // successes is ['a is ok', 'c is ok']
        // however the order of successes may be different
    });


```

### Task.fork :: `(a -> ()) -> (b -> ()) -> Task a b -> ()`

Forces a task to reject or resolve with a rejected and resolved callback.

Until a task has been forked, it has not run any computations.

### Task.bimap :: `(a -> c) -> (b -> d) -> Task a b -> Task c d`

Maps both the rejected and resolved values of a task.
The behavior is equivalent to calling Task.map and Task.mapRejected separately.

```javascript

    var rejectedMap = function(reason) {
        return reason + ", which is really bad.";
    }

    var resolvedMap = function(result) {
        return reason + ", which is really good.";
    }

    var mapGoodBad = Task.bimap(rejectedMap, resolvedMap);

    var task = mapGoodBad(Task.of("We made it"));

    Task.fork(function(reason){
        // won't run
    }, function(result) {
        // result is "We made it, which is really good.";
    }, task);

    task = mapGoodBad(Task.reject("We didn't make it"));

    Task.fork(function(reason){
        // reason is "We didn't make it, which is really bad."
    }, function(result) {
        // won't run
    }, task);

```

### Task.taskify :: `Function -> Task a b`

Creates a function from a regular node-style, async function which instead returns a Task.

The function's last parameter must be a callback.
The function must execute the callback with an error as the first argument.

```javascript

    var divideAsync = function(a, b, callback) {
        if (b === 0) {
            callback('Division by zero is a bad thing');
            return;
        }

        callback(null, a / b);
    }

    var divide = Task.taskify(divideAsync);

    var task1 = divide(16, 8);
    var task2 = divide(172, 0);

    Task.fork(function(reason){
        // not run
    }, function(result){
        // result is 2 here
    }, task1);

    Task.fork(function(reason){
        // reason is "Division by zero is a bad thing"
    }, function(result){
        // not run
    }, task2);


```

Task.taskify2 :: `Function -> Task a b`

This is very similar to `Task.taskify` except that the given async function is expected
not to pass any error to its callback function.

```javascript

    var divideAsync = function(a, b, callback) {
        // Division can never result in an error...
        callback(a / b);
    }

    var divide = Task.taskify2(divideAsync);

    var task1 = divide(16, 8);
    var task2 = divide(172, 0);

    Task.fork(function(reason){
        // not run
    }, function(result){
        // result is 2 here
    }, task1);

    Task.fork(function(reason){
        // not run
    }, function(result){
        // result is NaN here
    }, task2);


```

### Task.immediate :: `Task a b -> Task a b`

Creates a task from another task.
The new task will run in a non-blocking manner.

```javascript
    var nonBlockingTask = Task.immediate(Task.of("whatever"));
```

### Task.delay :: `Number -> Task a b -> Task a b`

Creates a task from another task which will delay the task for a specified number of milliseconds.

```javascript
    var delayedTask = Task.delay(200, Task.of("whatever"));
```
### Task.timeoutWith :: `(Number -> a) -> Number -> Task a b -> Task a b`

Sets a timeout for a task.

If the task takes too long to execute, the first parameter will be called
with the given time and the task will reject with the returned value.

```javascript
    var task = Task.delay(40, Task.of("ok"));

    var errFn = function(time){ return Error("Took too long (" + time + "ms)") };
    var time = 20;

    var timeoutTask = Task.timeoutWith(errFn, time, task);

    Task.fork(function(reason){
        // reason will be Error: "Took too long (20ms)"
    }, function(result){
        // won't run since the task took too long
    }, timeoutTask);

```

### Task.timeout :: `Number -> Task a b -> Task a b`

Sets a timeout for a task.

This works the same as Task.timeoutWith except that the first argument is already
applied to return an instance of Task.TimeoutError when a timeout occurs.

```javascript
    var task = Task.delay(40, Task.of("ok"));

    var time = 20;

    var timeoutTask = Task.timeout(time, task);

    Task.fork(function(reason){
        // reason will be TimeoutError: "Task timed out after 20ms."
    }, function(result){
        // won't run since the task took too long
    }, timeoutTask);

```

### Task.caught :: `Task a b -> Task a b`

Creates a task from another which will catch an error if any and reject
with the error.

### Task.show :: `Task a b -> String`

Always returns the string "Task".

## Prototype

For convenience, several of the Task module functions are attached to the prototype.
Specifically, every Task function with accepts a task as its
final argument is attached to the prototype.
The signature is the same in all cases except that the last parameter is preapplied
with `this`, except in the case of the three concat functions and the ap function which
preapply their first parameter with `this` since it is more natural.

```javascript

    // will resolve in 200 ms after forked
    var delayed = Task.of("whatever").delay(200);

    // will always reject with the throw error
    var caught = Task.of(function(reject, resolve){
        throw Error('whatever');
    }).caught();

    // will always resolve to [1,2,3,4,5,6]
    var concated = Task.of([1,2,3]).concat(Task.of([4,5,6]));

    // will always resolve to 9
    Task.of(1)
        .chain(v => Task.resolve(v + 2))
        .chain(v => Task.resolve(v * 3));

```

## Implements

Task implements the following lambdash interfaces:

1. Functor
2. Semigroup (Only if a tasks resolved type implements semigroup)
3. Applicative
4. Monad
5. Show
