"use strict";
var assert = require("assert");
var zurvan = require("../zurvan");

describe('zurvan', function() {
  describe('after stopping time', function() {
    beforeEach(function() {
	  return zurvan.interceptTimers();
	});
	
	afterEach(function() {
	  return zurvan.releaseTimers();
	});

    it('resets process timers', function(done) {
	  assert.equal(0, process.uptime());
	  assert.deepEqual([0,0], process.hrtime());
	  done();
	});
	
	it('advances all times together, asynchronously', function(done) {
	  setTimeout(function() {
	    assert.equal(1.523, process.uptime());
		assert.deepEqual([1, 523e6], process.hrtime());
	  }, 1523);
	  
	  zurvan.advanceTime(1600).then(function() {
	    assert.equal(1.6, process.uptime());
		assert.deepEqual([1, 600e6], process.hrtime());
	    done();
	  });
	});
	
	it('can calculate diff in process.hrtime', function(done) {
	  var previousHrtime;
	  setTimeout(function() {
	    previousHrtime = process.hrtime();
		assert.deepEqual([1, 523e6], previousHrtime);
		
		setTimeout(function() {
		  var hrtimeDiff = process.hrtime(previousHrtime);
		  assert.deepEqual([10, 244e6], process.hrtime());
		  assert.deepEqual([8, 721e6], hrtimeDiff);
		}, 8721);
	  }, 1523);
	  
	  zurvan.advanceTime(11000).then(function() {
	    assert.deepEqual(process.hrtime(), [11, 0]);
	  }).then(done, done);
	});

  });
});