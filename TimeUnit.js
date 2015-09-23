var assert = require("assert");

function standardTime(coefficient) {
  var StandardTimer = function(value) {
    return new TimeUnit(coefficient, value);
  };
  
  StandardTimer.coefficient = coefficient;
  return StandardTimer;
}

var standardTimers = {};
standardTimers.nanoseconds = standardTime(1);
standardTimers.microseconds = standardTime(1e3 * standardTimers.nanoseconds.coefficient);
standardTimers.milliseconds = standardTime(1e3 * standardTimers.microseconds.coefficient);
standardTimers.seconds = standardTime(1e3 * standardTimers.milliseconds.coefficient);
standardTimers.minutes = standardTime(60 * standardTimers.seconds.coefficient);
standardTimers.hours = standardTime(60 * standardTimers.minutes.coefficient);
standardTimers.days = standardTime(24 * standardTimers.hours.coefficient);
standardTimers.weeks = standardTime(7 * standardTimers.days.coefficient);

function TimeUnit(coefficient, value) {
  this.value = value;
  this.coefficient = coefficient;
}

TimeUnit.prototype.toStandardTime = function (timer) {
  return this.value * this.coefficient / timer.coefficient;
};

TimeUnit.prototype.add = function(time) {
  return this.setTo(this.extended(time));
};

TimeUnit.prototype.extended = function(time) {
  assert(time instanceof TimeUnit);
  var value = this.value;
  var coefficient = this.coefficient;
  
  if(coefficient > time.coefficient) {
    value = value * coefficient / time.coefficient + time.value;
	coefficient = time.coefficient;
  }
  else {
    value = time.value * time.coefficient / coefficient + value;
  }
  
  return new TimeUnit(value, coefficient);
};

TimeUnit.prototype.shortened = function(time) {
  return this.extended(new TimeUnit(-time.value, time.coefficient));
};

TimeUnit.prototype.minus = function(time) {
  return this.setTo(this.shortened(time));
};

TimeUnit.prototype.setTo = function(time) {
  assert(time instanceof TimeUnit);
  
  this.value = time.value;
  this.coefficient = time.coefficient;
  return this;
};

TimeUnit.prototype.toNanoseconds = function() {return this.toStandardTime(standardTimers.nanoseconds);};
TimeUnit.prototype.toMicroseconds = function() {return this.toStandardTime(standardTimers.microseconds);};
TimeUnit.prototype.toMilliseconds = function() {return this.toStandardTime(standardTimers.milliseconds);};
TimeUnit.prototype.toSeconds = function() {return this.toStandardTime(standardTimers.seconds);};
TimeUnit.prototype.toMinutes = function() {return this.toStandardTime(standardTimers.minutes);};
TimeUnit.prototype.toHours = function() {return this.toStandardTime(standardTimers.hours);};
TimeUnit.prototype.toDays = function() {return this.toStandardTime(standardTimers.days);};
TimeUnit.prototype.toWeeks = function() {return this.toStandardTime(standardTimers.weeks);};

module.exports = standardTimers;