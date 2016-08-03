"use strict";
var TypeChecks = require("./utils/TypeChecks");
var TimeUnit = require("../TimeUnit");
var assert = require("assert");

function TimeForwarder(timeServer, timerInterceptor, immediateInterceptor) {
  this.forwardingStartedSavedStack = undefined;
  this.timerInterceptor = timerInterceptor;  
  this.timeServer = timeServer;
  this.immediateInterceptor = immediateInterceptor; 
}

TimeForwarder.prototype.prepareTimeReport = function() {
  var currentTime = this.timeServer.currentTime.toMilliseconds();
  var targetTime = this.timeServer.targetTime.toMilliseconds();
    
  var timeReport = "Cannot release timers during event expiration " + 
    "current time: <<" + currentTime + ">> ms, target time: <<" + targetTime + ">> ms. ";
    
  if(targetTime === currentTime) {
    timeReport = timeReport + " Target time reached, but queue not cleared yet. ";
  }
 
  return timeReport; 
};

TimeForwarder.prototype.stopForwarding = function() {
  var that = this;
  return new that.schedule.Promise(function(resolve, reject) {
    if(that.isExpiringEvents()) {      
      return reject(new Error(that.prepareTimeReport() + 
	    "Expiring events requested at: " + that.forwardingStartedSavedStack));
    }
  
  return resolve();
  });
};

TimeForwarder.prototype.stopExpiringEvents = function() {
  this.forwardingStartedSavedStack = undefined;
};

TimeForwarder.prototype.enable = function(config) {
  this.schedule = {
    Promise: config.promiseScheduler,
    EndOfQueue: this.immediateInterceptor.endOfQueueScheduler()
  };
};

TimeForwarder.prototype.disable = function() {
  this.schedule = undefined;
};

TimeForwarder.prototype.startExpiringEvents = function() {
  this.forwardingStartedSavedStack = new Error().stack;  
};

TimeForwarder.prototype.isExpiringEvents = function() {
  return this.forwardingStartedSavedStack !== undefined;
};

TimeForwarder.prototype.advanceTime = function(timeToForward) {
  var advanceStep = new TimeUnit(timeToForward);  
  var that = this;

  return new that.schedule.Promise(function(resolve, reject) {
    if(advanceStep.isShorterThan(TimeUnit.milliseconds(0))) {
      return reject(new Error("Zurvan cannot move back in time. Requested step: << " + advanceStep.toMilliseconds() + "ms >>"));
    }

    if(that.isExpiringEvents()) {
      return reject(new Error(that.prepareTimeReport() + 
	    "Forwarding requested from: " + that.forwardingStartedSavedStack));
    }

    that.timeServer.targetTime = that.timeServer.currentTime.extended(advanceStep);
    that.startExpiringEvents();
    
    // that's a workaround until proper solution is ready - in certain cases this theoretically might not work,
	// i.e. pathological chains of setImmediate/process.nextTick
	// but I wasn't able to find out such scenario, so I'm leaving it here for now

	var numberOfRequestedCyclesAroundSetImmediateQueue = 4;
	var numberOfExecutedCycles = 0;
	
	function cycleAroundSetImmediateQueue() {
		if(numberOfExecutedCycles++ < numberOfRequestedCyclesAroundSetImmediateQueue) {
			that.schedule.EndOfQueue(cycleAroundSetImmediateQueue);
		}
		else {
			fireTimersOneByOne();
		}
	}
  
    that.schedule.EndOfQueue(cycleAroundSetImmediateQueue);
  
    function fireTimersOneByOne() {
      if(that.immediateInterceptor.areAwaiting()) {
        that.schedule.EndOfQueue(function() {
          fireTimersOneByOne();
        });
        return;
      }
  
      var closestTimer = that.timerInterceptor.nextTimer();
      if(closestTimer && !closestTimer.dueTime.isLongerThan(that.timeServer.targetTime)) {
        closestTimer.clear();
        that.timeServer.currentTime.setTo(closestTimer.dueTime);
        that.schedule.EndOfQueue(function() {
          closestTimer.expire();
          that.schedule.EndOfQueue(function() {
            fireTimersOneByOne();
          });
        });
      }
      else {
        that.timeServer.currentTime.setTo(that.timeServer.targetTime);
        that.stopExpiringEvents();
        resolve();
      }
    }
  });
};


TimeForwarder.prototype.expireAllTimeouts = function() {
  var lastTimeout = this.timerInterceptor.lastTimeout();
  if(lastTimeout) {
    var that = this;
  return this.advanceTime(lastTimeout.dueTime.shortened(that.timeServer.currentTime)).then(function() {
    return that.expireAllTimeouts();
  });
  }
  
  return this.advanceTime(0);
};

TimeForwarder.prototype.forwardTimeToNextTimer = function() {
  var closestTimer = this.timerInterceptor.nextTimer();
  if(closestTimer) {
    return this.advanceTime(closestTimer.dueTime.shortened(this.timeServer.currentTime));
  }
  return this.advanceTime(0);  
};

TimeForwarder.prototype.fireAllOutdatedTimers = function() {
  var closestTimer = this.timerInterceptor.nextTimer();
  while(closestTimer && !closestTimer.dueTime.isLongerThan(this.timeServer.currentTime)) {
    closestTimer.clear();
    this.schedule.EndOfQueue(closestTimer.expire.bind(closestTimer));
    closestTimer = this.timerInterceptor.nextTimer();
  }
};

function assertValidBlockStep(blockStep) {
  if(blockStep.isShorterThan(TimeUnit.milliseconds(0))) {
    throw new Error("Zurvan cannot move back in time. Requested step: << " + blockStep.toMilliseconds() + "ms >>");
  }  
}

TimeForwarder.prototype.blockSystem = function(timeToBlock) {
  var blockStep = new TimeUnit(timeToBlock);
  assertValidBlockStep(blockStep);
    
  if(!this.isExpiringEvents()) {
    assert(this.timeServer.targetTime.isEqualTo(this.timeServer.currentTime));
    this.timeServer.targetTime.add(blockStep);
  }
  else if(this.timeServer.targetTime.isShorterThan(this.timeServer.currentTime.extended(blockStep))) {
    throw new Error("Cannot block system during advancing for longer than requested advance time. Currently at: << " + 
      this.timeServer.currentTime.toMilliseconds() + " >> ms, target: << " + this.timeServer.targetTime.toMilliseconds() + 
      " ms >>, requested step: << " + blockStep.toMilliseconds() + " ms >>. Forwarding requested from: " + this.forwardingStartedSavedStack);
  }

  this.timeServer.currentTime.add(blockStep);
  this.fireAllOutdatedTimers();
};

module.exports = TimeForwarder;