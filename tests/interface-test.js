/*global process, beforeEach, afterEach, describe, it*/

var isNodejs = typeof module !== "undefined" && module.require;
var paredit = isNodejs ? module.require("../index") : window.paredit;

var expect, i;
if (isNodejs) {
  var chai = module.require('chai');
  chai.use(module.require('chai-subset'));
  expect = chai.expect;
} else { expect = window.chai.expect; }

describe('paredit interface', function() {

  it('has specialForms', function() {
    expect(paredit.specialForms).to.include("var");
  });

});
