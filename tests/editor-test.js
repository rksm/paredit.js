/*global process, beforeEach, afterEach, describe, it*/

var isNodejs = typeof module !== "undefined" && module.require;
var paredit = isNodejs ? module.require("../index") : window.paredit;

var expect, i;
if (isNodejs) {
  var chai = module.require('chai');
  chai.use(module.require('chai-subset'));
  expect = chai.expect;
} else { expect = window.chai.expect; }

var d = JSON.stringify;

var ed = paredit.editor;
var parse = function(src) {
  return paredit.parse(src, {addSourceForLeafs: true});
};

function times(n, ch) { return new Array(n+1).join(ch); }

function expectIndent(src, expected) {
  var actual = ed.indentRange(parse(src), src, 0,src.length);
  expect(actual.src).to.eql(expected);
}

function expectChangesAndIndex(actual, changes, idx) {
  if (!changes) expect(actual).to.eq(null,d(actual));
  else expect(actual.changes).to.deep.eq(changes, d(actual.changes));
  if (typeof idx == "number") expect(actual.newIndex).equals(idx);
}

function edit(methodName/*,args*/) {
  // a bit prettier than
  // expectChangesAndIndex(
  //   ed.wrapAround(parse("()"), "()", 1, '(', ')'),
  //   [['insert', 1, "("],
  //   ['insert', 2, ")"]],
  //   2);

  var args = Array.prototype.slice.call(arguments);
  var method = args.shift();
  return {
    transforms: function(title, fromTo) {
      if (typeof fromTo === "undefined") {
        fromTo = title;
        title = undefined;
      }
      var from = fromTo.split("->")[0];
      var to = fromTo.split("->")[1];
      title = (title ? title+":" : "") + from + "->" + to;
      return {
        withChanges: function(changes) {
          return it(title, function() {
            var src = from.replace(/\|/, "");
            var idx = from.indexOf("|");
            if (idx === -1) throw new Error("need from index! -> |");
            var newIdx = to.indexOf("|");
            if (newIdx === -1) newIdx = undefined;
            expectChangesAndIndex(
              ed[method].apply(ed, [parse(src), src, idx].concat(args)),
              changes, newIdx);
          });
        },
      }

    },
  }
}
function itTransforms(title, fromTo, method, args, changes) {
  if (typeof changes === "undefined") {
    changes = args; args = method; method = fromTo; fromTo = title;
    title = undefined;
  }
  var from = fromTo.split("->")[0];
  var to = fromTo.split("->")[1];
  title = (title ? title+":" : "") + from + "->" + to;
  return it(title, function() {
    var src = from.replace(/\|/, "");
    var idx = from.indexOf("|");
    if (idx === -1) throw new Error("need from index! -> |");
    var newIdx = to.indexOf("|");
    if (newIdx === -1) newIdx = undefined;
    expectChangesAndIndex(
      ed[method](parse(src), src, idx, args),
      changes, newIdx);
  });
}

describe('paredit editor', function() {

  describe("splitting", function() {
    it("(|)->()| ()", function() {
      var actual = ed.splitSexp(parse("()"), "()", 1);
      expect(actual.changes).deep.equals([['insert', 1, ") ("]]);
      expect(actual.newIndex).equals(2);
    });

    it("(|foo)->()| (foo), updates child indexes", function() {
      var actual = ed.splitSexp(parse("(foo)"), "(foo)", 1);
      expect(actual.changes).deep.equals([['insert', 1, ") ("]]);
    });

    it("[|]->[]| [], uses correct paren for change", function() {
      var actual = ed.splitSexp(parse("[]"), "[]", 1);
      expect(actual.changes).to.deep.equal([["insert", 1, "] ["]], d(actual));
    });

    describe("strings", function() {
      it('"fo|o"->"fo"| "o"', function() {
        var actual = ed.splitSexp(parse('"foo"'), '"foo"', 3);
        expectChangesAndIndex(actual, [["insert", 3, '" "']], 4);
      });
    });
  });

  describe("wrap around", function() {

    it("(|)->((|))", function() {
      expectChangesAndIndex(
        ed.wrapAround(parse("()"), "()", 1, '(', ')'),
        [['insert', 1, "("],
         ['insert', 2, ")"]],
        2);
    });

    it("|a->(|a)", function() {
      expectChangesAndIndex(
        ed.wrapAround(parse("a"), "a", 0, '(', ')'),
        [['insert', 0, "("],
         ['insert', 2, ")"]], 1);
    });

    it("|a bb->(|a bb)", function() {
      expectChangesAndIndex(
        ed.wrapAround(parse("a bb"), "a bb", 0, '(', ')', {count: 2}),
        [['insert', 0, "("],
         ['insert', 5, ")"]], 1);
    });

  });

  describe("splice", function() {
    edit('spliceSexp')
      .transforms('(aa| bb)->aa| bb')
      .withChanges([['remove', 6, 1],['remove', 0, 1]]);

    edit('spliceSexp')
      .transforms('"foo |bar"->foo |bar')
      .withChanges([['remove', 8, 1],['remove', 0, 1]]);
  });

  describe("splice and kill", function() {

    edit('spliceSexpKill', {backward: true})
      .transforms("(aa |bb)->|bb")
      .withChanges(
        [['remove', 6, 1],
         ['remove', 1, 3],
         ['remove', 0, 1]]);

    edit('spliceSexpKill', {backward: true})
      .transforms("(|bb)->|bb")
      .withChanges(
        [['remove', 3, 1],
         ['remove', 0, 1]]);

    edit('spliceSexpKill', {backward: true})
      .transforms("aa (x|y)->aa |y")
      .withChanges(
        [['remove', 6, 1],
         ['remove', 4, 1],
         ['remove', 3, 1]]);

    edit('spliceSexpKill', {backward: false, count: 2})
      .transforms("(aa |bb cc)->aa |")
      .withChanges(
        [['remove', 9, 1],
         ['remove', 4, 5],
         ['remove', 0, 1]]);

    edit('spliceSexpKill', {backward: true})
      .transforms("(\"f|oo\" bb)->|oo bb")
      .withChanges(
        [['remove', 9, 1],
         ['remove', 5, 1],
         ['remove', 2, 1],
         ['remove', 1, 1],
         ['remove', 0, 1]]);
  });

  describe("closeAndNewline", function() {

    edit("closeAndNewline")
      .transforms(" (aa| bb)-> (aa bb)\n |")
      .withChanges([['insert', 8, "\n "]]);

    edit("closeAndNewline", ']')
      .transforms("[(aa| bb)]->[(aa bb)]\n|")
      .withChanges([['insert', 9, "\n"]]);

  });

  describe("barfSexp", function() {
    edit("barfSexp", {backward: true})
      .transforms("backward: ", "(foo (bar baz |quux) zot)->(foo bar (baz |quux) zot)")
      .withChanges([
        ['insert', 10, '('],
        ['remove', 5, 1]]);

    edit("barfSexp", {backward: false})
      .transforms("forward: ", "(foo (bar baz |quux) zot)->(foo (bar baz |) zot)")
      .withChanges(
        [['remove', 18, 1],
         ['insert', 14, ')']]);
  });

  describe("slurpSexp", function() {
    edit("slurpSexp", {backward: false, count: 2})
      .transforms("forward: ", "(a (a |b) c d)->(a (a |b c d))")
      .withChanges(
        [['insert', 12, ')'],
         ['remove', 7, 1]]);


    edit("slurpSexp", {backward: true, count: 2})
      .transforms("backward: ", "(x y z (a |b) c d)->(x (y z a |b c d))")
      .withChanges(
        [['remove', 7, 1],
         ['insert', 3, '(']]);
  });

  describe("killSexp", function() {
    edit("killSexp",{backward: false, count: 2})
      .transforms("forward: ","(a |b c d)->(a | d)")
      .withChanges([['remove', 3, 3]]);

    edit("killSexp",{backward: true, count: 2})
      .transforms("backward: ","(a |b c d)->(|b c d)")
      .withChanges([['remove', 1, 2]]);

    edit("killSexp",{backward: true})
      .transforms("string: ",'("fo|o" b)->("|o" b)')
      .withChanges([['remove', 2, 2]]);

    edit("killSexp",{backward: true})
      .transforms('fo|o->|o')
      .withChanges([['remove', 0, 2]]);

    edit("killSexp",{backward: true})
      .transforms("comment: ",'(;fo|oo\nb)->(|oo\nb)')
      .withChanges([['remove', 1, 3]]);
  });

  describe("deletion", function() {
    edit("delete")
      .transforms()
      .withChanges();
    it("deletes non list-like things: (abc|)->(a|)", function() {
      expectChangesAndIndex(
        ed.delete(parse("(abc)"), "(abc)", 4, {backward: true, count: 2}),
        [['remove', 2, 2]], 2);
    });

    it("does not delete forward ad end of list: (abc|)->(abc|)", function() {
      expectChangesAndIndex(
        ed.delete(parse("(abc)"), "(abc)", 4, {backward: false, count: 2}),
        [], 4);
    });

    it("deletes empty lists backward: (|)->|", function() {
      expectChangesAndIndex(
        ed.delete(parse("()"), "()", 1, {backward: true}),
        [['remove', 0, 2]], 0);
    });
    it("deletes empty lists backward but only at begining: ( |)->(|)", function() {
      expectChangesAndIndex(
        ed.delete(parse("( )"), "( )", 2, {backward: true}),
        [['remove', 1, 1]], 1);
    });
    it("deletes empty lists forward: (|)->|", function() {
      expectChangesAndIndex(
        ed.delete(parse("()"), "()", 1, {backward: false}),
        [['remove', 0, 2]], 0);
    });
    it("deletes empty lists forward on toplevel: |()->|", function() {
      expectChangesAndIndex(
        ed.delete(parse("()"), "()", 0, {backward: false}),
        [['remove', 0, 2]], 0);
    });

    it('deletes empty strings: "|"->|', function() {
      expectChangesAndIndex(
        ed.delete(parse('""'), '""', 1, {backward: false}),
        [['remove', 0, 2]], 0);
    });
  });

  describe("transpose", function() {
    it("(xxx |yyy)->(xxx yyy|)", function() {
      expectChangesAndIndex(
        ed.transpose(parse("(xxx yyy)"), "(xxx yyy)", 5, {}),
        [['insert', 8, " xxx"],
         ['remove', 1, 4]], 8);
    });
    it("((a)|(b))->((a) (b)|)", function() {
      expectChangesAndIndex(
        ed.transpose(parse("((a)(b))"), "((a)(b))", 4, {}),
        [['insert', 7, " (a)"],
         ['remove', 1, 3]], 8);
    });
    it("(|yyy)->(|yyy)", function() {
      expectChangesAndIndex(ed.transpose(parse("(yyy)"), "(yyy)", 1, {}), null);
    });
    it("( | )->( | )", function() {
      expectChangesAndIndex(ed.transpose(parse("(  )"), "(  )", 2, {}), null);
    });
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

    it("updates ast for empty form", function() {
      var src = "(\n)";
      var actual = ed.indentRange(parse(src), src, 1,src.length);
      var expected = {type: "toplevel", children: [{start: 0, end:4}]};
      expect(actual.ast).to.containSubset(expected, d(actual.ast));

    });

    it("indents special forms correctly", function() {
      expectIndent("(defn\nx\ny)", "(defn\n  x\n  y)");
    });

    it("indents multiple toplevel sexps at once", function() {
      expectIndent("(\n)\n(\n)", "(\n )\n(\n )");
    });

  });
});
