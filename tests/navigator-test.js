/*global process, beforeEach, afterEach, describe, it*/

var isNodejs = typeof module !== "undefined" && module.require;
var paredit = isNodejs ? module.require("../index") : window.paredit;

var expect, i;
if (isNodejs) {
  var chai = module.require('chai');
  chai.use(module.require('chai-subset'));
  expect = chai.expect;
  i = module.require("immutable");
} else { expect = window.chai.expect; i = window.Immutable; }

var d = typeof lively !== "undefined" ? lively.lang.obj.inspect : console.dir;

var testSource1 = "(aaa bbb [cc dddd e])";
var testSource2 = "(defn foo\n"
                + "  \"documentation\n"
                + "   string\"\n"
                + "  [^String s]\n"
                + "  (let [a (XXX. yyy bbb)] ; comment\n"
                + "    (bb ccc a (+ ddd 23 \"foo\"))))\n";

function dummyEdit(source) {
  return {
    session: {doc: {}}
  }
}

var nav = paredit.navigator;

describe('paredit navigator', function() {

  var ast1 = paredit.parse(
    "(aaa bbb [cc dddd e] ())",
    {addSourceForLeafs: true});

  describe("basic movements", function() {
    
    describe("forwardSexp", function() {

      it("|(...)->(...)|", function() {
        expect(nav.forwardSexp(ast1, 0)).eq(24);
        expect(nav.forwardSexp(ast1, 1)).eq(4);
      });

      it("| (...)->(...)|", function() { 
        expect(nav.forwardSexp(ast1, 4)).eq(8);
      });

    });

    describe("backwardSexp", function() {

      it("(...)|->|(...)", function() {
        expect(nav.backwardSexp(ast1, 24)).eq(0);
        expect(nav.backwardSexp(ast1, 4)).eq(1);
      });

      it("(...) |->|(...)", function() { 
        expect(nav.backwardSexp(ast1, 5)).eq(1);
      });

    });

    describe("forwardDown", function() {

      it("|(...)->(|...)", function() {
        expect(nav.forwardDownSexp(ast1, 0)).eq(1);
        // expect(nav.forwardDownSexp(ast1, 1)).eq(10);
        // expect(nav.forwardDownSexp(ast1, 20)).eq(22);
      });

    });

    describe("backwardUp", function() {

      it("(..|.)->|(...)", function() {
        expect(nav.backwardUpSexp(ast1, 8)).eq(0);
        expect(nav.backwardUpSexp(ast1, 15)).eq(9);
        expect(nav.backwardUpSexp(ast1, 24)).eq(24);
      });

    });
  });
});
