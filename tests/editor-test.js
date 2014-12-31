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

function times(n, ch) { return new Array(n+1).join(ch); }

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

  describe("rewrite ast", function() {
    it("replaces nodes and constructs new ast", function() {
      var ast = parse("(a (c d) d) e"),
          target = ast.children[0].children[1].children[0], // c
          replacement = [{start: 4,end: 7,source: "ccc",type: "symbol"}],
          actual = ed.rewrite(ast, target, replacement),
          expected = parse("(a (ccc d) d) e");
      expect(actual).to.containSubset(expected, d(actual));
    });
  });

  describe("indentation", function() {
    
    it("indents sexp parts on newline", function() {
      var src = "(foo\nbar)";
      var actual = ed.indentRange(parse(src), src, 6,6);
      expect(actual.changes).to.deep.equal([["insert", 5, " "]], d(actual.changes));
    });

    it("indents multiple lines", function() {
      var src = "(foo\nbar\n    baz)";
      var actual = ed.indentRange(parse(src), src, 6,15);
      var expected = [
        ["insert", 5, " "],
        ["remove", 10/*!not 9 since change of prev line*/, 3]]
      expect(actual.changes).to.deep.equal(expected, d(actual.changes));
    })

    it("indents according to parent list", function() {
      var src = "  (foo bar\n      baz)";
      var actual = ed.indentRange(parse(src), src, 17,17);
      var expected = [
        ["insert", 11, times("  (foo ".length - "      ".length, " ")]];
      expect(actual.changes).to.deep.equal(expected, d(actual.changes));
    });


    it("recognizes special forms", function() {
      var src = "(defn foo\n[]\n(let []\na))"
      var actual = ed.indentRange(parse(src), src, 1,23);
      var expected = [
        ["insert",10,"  "],
        ["insert",15,"  "],
        ["insert",25,"    "]];
      expect(actual.changes).to.deep.equal(expected, d(actual.changes));
    });
  });
});
