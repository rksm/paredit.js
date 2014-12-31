/*global process, beforeEach, afterEach, describe, it*/

var isNodejs = typeof module !== "undefined" && module.require;
var paredit = isNodejs ? module.require("../index") : window.paredit;

var expect, i;
if (isNodejs) {
  var chai = module.require('chai');
  chai.use(module.require('chai-subset'));
  expect = chai.expect;
} else { expect = window.chai.expect; }

var d = typeof lively !== "undefined" ? lively.lang.obj.inspect : console.dir;

var ed = paredit.editor;
var parse = function(src) {
  return paredit.parse(src, {addSourceForLeafs: true});
};

describe('paredit editor', function() {

  describe("splitting", function() {
    it("(|)->()|()", function() {
      var actual = ed.splitSexp(parse("()"), 1);
      expect(actual.changes).deep.equals([['insert', 1, ")("]]);
      expect(actual.newIndex).equals(2);
    });

    it("(|foo)->()|(foo), updates child indexes", function() {
      var actual = ed.splitSexp(parse("(foo)"), 1);
      expect(actual.changes).deep.equals([['insert', 1, ")("]]);
    });

    it("[|]->[][], uses correct paren for change", function() {
      var actual = ed.splitSexp(parse("[]"), 1);
      expect(actual.changes).to.deep.equal([["insert", 1, "]["]], d(actual));
    })
  });

});
