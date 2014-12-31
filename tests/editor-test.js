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
      var ast = parse("()"),
          actual = ed.splitSexp(ast, 1),
          expected = {
            start: 0, end: 4, errors: [], type: "toplevel",
            children: [
              {start: 0,end: 2, children: [], type: "list"},
              {start: 2,end: 4, children: [], type: "list"}]
          };
      expect(actual.ast).to.containSubset(expected, d(actual));
      expect(actual.ast).to.not.equal(ast); // no identity
      expect(actual.changes).deep.equals([
        ['insert', 1, ")("]
      ]);
      expect(actual.newIndex).equals(2);
    });

    it("(|foo)->()|(foo), updates child indexes", function() {
      var actual = ed.splitSexp(parse("(foo)"), 1),
          expected = {
            start: 0, end: 7, errors: [], type: "toplevel",
            children: [
              {start: 0,end: 2, children: [], type: "list"},
              {start: 2,end: 7, children: [{start:3,end:6}]}]
          };
      expect(actual.ast).to.containSubset(expected, d(actual));
    });

    it("(|)(bar)->()()(bar), updates following indexes", function() {
      var actual = ed.splitSexp(parse("()(bar)"), 1),
          expected = {
            start: 0, end: 9, errors: [], type: "toplevel",
            children: [
              {start: 0,end: 2, children: [], type: "list"},
              {start: 2,end: 4, children: [], type: "list"},
              {start: 4,end: 9, children: [{start:5,end:8}]}]
          };
      expect(actual.ast).to.containSubset(expected, d(actual));
    });

    it("[|]->[][], uses correct paren for change", function() {
      var actual = ed.splitSexp(parse("[]"), 1),
          expected = [["insert", 1, "]["]];
      expect(actual.changes).to.containSubset(expected, d(actual));
    })
  });

});
