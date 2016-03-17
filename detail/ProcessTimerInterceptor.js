"use strict";
var assert = require("assert");
var FieldOverrider = require("./utils/FieldOverrider");
var TimeUnit = require("../TimeUnit");

function ProcessTimerInterceptor(timeServer) {
  this.timeServer = timeServer;
}

ProcessTimerInterceptor.prototype.intercept = function() {
  this.uptimeOverrider = new FieldOverrider(process, "uptime", this.uptime.bind(this));
  this.hrtimeOverrider = new FieldOverrider(process, "hrtime", this.hrtime.bind(this));  
};

ProcessTimerInterceptor.prototype.release = function() {
  var currentProcessTime = process.hrtime();
  this.uptimeOverrider.restore();
  this.hrtimeOverrider.restore();
  return currentProcessTime;
};

ProcessTimerInterceptor.prototype.uptime = function() {
  return this.timeServer.currentTime.toSeconds();
};

function toHrtimeFormat(time) {
  return [Math.floor(time.toSeconds()), time.toNanoseconds() % (TimeUnit.seconds.coefficient / TimeUnit.nanoseconds.coefficient)];
}

ProcessTimerInterceptor.prototype.hrtime = function(previousValue) {
  if(previousValue !== undefined) {
    assert(previousValue.length === 2);
	var previousTime = TimeUnit.seconds(previousValue[0]).extended(TimeUnit.nanoseconds(previousValue[1]));
	return toHrtimeFormat(this.timeServer.currentTime.shortened(previousTime));
  }
  
  return toHrtimeFormat(this.timeServer.currentTime);
};

module.exports = ProcessTimerInterceptor;