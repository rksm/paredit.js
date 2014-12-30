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
var parse = function(src) {
  return paredit.parse(src, {addSourceForLeafs: true});
};

describe('paredit navigator', function() {

  var ast1 = parse("(aaa bbb [cc dddd e]) ()");

  describe("basic movements", function() {
    
    describe("forwardSexp", function() {

      it("|(...)->(...)|", function() {
        expect(nav.forwardSexp(ast1, 0)).eq(21);
        expect(nav.forwardSexp(ast1, 1)).eq(4);
      });

      it("| (...)->(...)|", function() { 
        expect(nav.forwardSexp(ast1, 4)).eq(8);
      });

    });

    describe("backwardSexp", function() {

      it("(...)|->|(...)", function() {
        expect(nav.backwardSexp(ast1, 24)).eq(22);
        expect(nav.backwardSexp(ast1, 21)).eq(0);
        expect(nav.backwardSexp(ast1, 4)).eq(1);
      });

      it("(...) |->|(...)", function() { 
        expect(nav.backwardSexp(ast1, 5)).eq(1);
      });

    });

    describe("forwardDown", function() {

      it("|(...)->(|...)", function() {
        expect(nav.forwardDownSexp(ast1, 0)).eq(1);
        expect(nav.forwardDownSexp(ast1, 1)).eq(10);
        expect(nav.forwardDownSexp(ast1, 22)).eq(23);
      });

    });

    describe("backwardUp", function() {

      it("(..|.)->|(...)", function() {
        expect(nav.backwardUpSexp(ast1, 8)).eq(0);
        expect(nav.backwardUpSexp(ast1, 15)).eq(9);
        expect(nav.backwardUpSexp(ast1, 21)).eq(21);
      });

    });
  });

  describe("sexp boundaries", function() {
    
    describe('range for idx', function() {
      it("...xxx|...->...*xxx*...", function() {
        expect(nav.sexpRange(parse("  aaa  "), 5)).deep.eq([2,5]);
      });
  
      it("(xxx|)->(*xxx*)", function() {
        expect(nav.sexpRange(parse("(aa)"), 3)).deep.eq([1,3]);
        expect(nav.sexpRange(parse("(aa bbb)"), 3)).deep.eq([1,3]);
      });
  
      it(".(xxx.|.)..->..(*xxx..*)..", function() {
        expect(nav.sexpRange(parse(" (aaa  ) "), 6)).deep.eq([2,7]);
      });

      it("(.|.)->(*...*)", function() {
        expect(nav.sexpRange(parse("(   )"), 2)).deep.eq([1,4]);
      });

      it("|()->*()*", function() {
        expect(nav.sexpRange(parse("()"), 0)).deep.eq([0,2]);
        expect(nav.sexpRange(parse("()"), 2)).deep.eq([0,2]);
      });

      it('".|."->"*...*"', function() {
        expect(nav.sexpRange(parse('"foo"'), 2)).deep.eq([1,4]);
      });
  
      it("ignores toplevel", function() {
        expect(nav.sexpRange(parse("a  a"), 2)).deep.eq(null);
      });
      
    })

    describe("expansion", function() {

      it(".(*xxx*)..->..*(xxx)*..", function() {
        expect(nav.sexpRangeExpansion(parse(" (aaa) "), 2,5)).deep.eq([1,6]);
      });

      it(".(xx*x)*..->..*(xxx)*..", function() {
        expect(nav.sexpRangeExpansion(parse(" (aaa) "), 4,6)).deep.eq([1,6]);
      });

      it('."*xxx*")..->..*"xxx"*..', function() {
        expect(nav.sexpRangeExpansion(parse(' "aaa" '), 2,5)).deep.eq([1,6]);
      });

      it('."*xx*x")..->.."*xxx*"..', function() {
        expect(nav.sexpRangeExpansion(parse(' "aaa" '), 2,4)).deep.eq([2,5]);
      });

      it("(*x* x)->(*x xx*)", function() {
        expect(nav.sexpRangeExpansion(parse("(a aa)"), 1,2)).deep.eq([1,5]);
      });

      it("dont expand to toplevel", function() {
        expect(nav.sexpRangeExpansion(parse(" (a) a"), 1,4)).deep.eq(null);
      });

    });

  });
});
