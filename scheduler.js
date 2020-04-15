
function Scheduler (loopInterval, coreFunction) {
  let active = false;
  let tasks = [];
  let mainLoopInterval = loopInterval;
  let timerId = null;
  let taskId = BigInt(0);
  
  let schedule = function () {
    let startTime = performance.now();
    
    for (let i=0; i < tasks.length; i++) {
      if (!active) break;
      
      // Decrement the timer for the task
      tasks[i].remainingMs -= mainLoopInterval;
      
      // Check if the time for this task is up
      if (tasks[i].remainingMs < 0) {
        // Call the task function
        tasks[i].callback.apply(tasks[i].context, tasks[i].arguments);
        
        // If the callback cleared the scheduler, quit here
        if (i >= tasks.length) break;
        
        if (tasks[i].repeat) {
          // If this is a repeating task, reset the time remaining
          tasks[i].remainingMs = tasks[i].intervalMs;
        }
        else {
          // If this is not a repeating task, remove it from the array
          tasks.splice(i, 1);
        }
      }
    }
    
    // Execute core function after all other tasks
    if (typeof coreFunction === 'function') {
      coreFunction();
    }
    
    // Schedule the next iteration
    if (active) {
      //console.log(mainLoopInterval - (performance.now() - startTime));
      timerId = setTimeout(schedule, Math.max(0, mainLoopInterval - (performance.now() - startTime)));
    }
  };
  
  let output = {
    // Add task
    add: function (callback, intervalMs, repeat, context, arguments) {
      let ms = parseInt(intervalMs);
      context = ((context && typeof context === 'object') ? context : null);
      taskId = taskId + 1n;
      
      if (typeof callback === 'function' && !isNaN(ms) && ms > 0) {
        tasks.push({
          taskId: taskId,
          callback: callback,
          intervalMs: ms,
          remainingMs: ms,
          repeat: repeat,
          context: context,
          arguments: arguments
        });
      }

      return taskId;
    },
    // Remove task
    remove: function (taskId) {
      for (let i=0; i < tasks.length; i++) {
        if (tasks[i].taskId === taskId) {
          tasks.splice(i, 1);
          return;
        }
      }
    },
    // Stop scheduler
    stop: function () {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
    // Start scheduler
    start: function () {
      active = true;
      if (!timerId) {
        timerId = setTimeout(schedule, mainLoopInterval);
      }
    },
    // Clear scheduler
    clear: function () {
      stop();
      
      // Let the existing tasks be garbage collected
      for (let i=0; i < tasks.length; i++) {
        tasks[i] = null;
      }
      
      tasks.length = 0;
    }
  };

  return output;
}
