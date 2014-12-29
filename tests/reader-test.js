/*global process, beforeEach, afterEach, describe, it*/

var isNodejs = typeof module !== "undefined" && module.require;
var paredit = isNodejs ? module.require("../index") : window.paredit;

var expect, i;
if (isNodejs) {
  var chai = module.require('chai');
  chai.use(module.require('chai-subset'));
  expect = chai.expect;
} else { expect = window.chai.expect; }

function pos(i,r,c) { return {idx: i, row: r, column: c}; };
function printPos(p) { return p.idx + ":" + p.row + ":" + p.column; }

var d = lively.lang.obj.inspect;

describe('reading sexps', function() {

  var readSeq = paredit.reader.readSeq;
  var readSexp = paredit.reader.readSexp;

  it('reads symbol', function() {
    expect(readSeq("foo")).deep.equals(["foo"]);
  });

  it('reads next symbol', function() {
    expect(readSexp("foo bar")).eq("foo");
  });

  describe("sequences and nestedness", function() {

    it('reads sequence', function() {
      expect(readSeq("foo bar baz")).deep.equals(["foo", "bar", "baz"]);
    });

    it('reads empty sexp', function() {
      expect(readSeq("()")).deep.equals([[]], d(readSeq("()")));
    });

    it('reads simple list', function() {
      expect(readSeq("(foo bar)")).deep.equals([["foo", "bar"]]);
    });

    it('reads nested lists', function() {
      expect(readSeq("(foo bar) (baz (zzz)) zork"))
        .deep.equals([["foo", "bar"], ["baz", ["zzz"]], "zork"], d(readSeq("(foo bar) (baz (zzz)) zork")));
    });

    it('reads vector syntax', function() {
      expect(readSeq("(foo [bar])"))
        .deep.equals([["foo", ["bar"]]]);
    });

    it('reads map syntax', function() {
      expect(readSeq("{:foo bar :baz zork}"))
        .deep.equals([[":foo", "bar", ":baz", "zork"]]);
    });
  });

  describe("whitespace", function() {
    it('ignores whitespace', function() {
      expect(readSeq(" \n    foo   ")).deep.equals(["foo"]);
      expect(readSeq("barr   foo")).deep.equals(["barr", "foo"]);
      expect(readSeq("  (   bar   )  ")).deep.equals([["bar"]]);
    });
  });

  describe("strings", function() {

    it("reads strings", function() {
      expect(readSexp('"fooo"')).eq('"fooo"');
    });

    it("escapes", function() {
      expect(readSexp('"fo\\"oo"')).eq('"fo\\"oo"');
    });

  })

  describe("numbers", function() {
    it("reads number value", function() {
      expect(readSexp('123')).eq(123);
    });
  });

  describe("symbols", function() {
    it("reads quoted", function() {
      expect(readSexp("'foo")).eq("'foo");
    });

    it("reads slash", function() {
      expect(readSexp("foo/bar")).eq("foo/bar");
    });

    it("reads keywords", function() {
      expect(readSexp(":foo")).eq(":foo");
    });
  });

  describe("commas", function() {
    it("are ignored", function() {
      expect(readSexp("{:x 1, :y a, :z b}"))
        .deep.equals([":x",1,":y","a",":z","b"]);
    });
  });

  describe("comments", function() {
    it("aren't ignored", function() {
      expect(readSeq("; foo\n(baz ;; bar  \n  zork)"))
        .deep.equals(["; foo\n", ["baz", ";; bar  \n", "zork"]])
    });
  });

  describe("macro syntax", function() {
    it("syntax quotes", function() {
      expect(readSeq("`x")).deep.equals(["`", "x"])
    });

    it("reads it", function() {
      expect(readSeq("`(fred x ~x lst ~@lst 7 8 :nine)"))
        .deep.equals(["`", ["fred", "x", "~", "x", "lst", "~@", "lst", 7, 8, ":nine"]]);
    });

  });

  describe("examples", function() {
    it("reads threaded", function() {
      expect(readSeq("(-> foo->bar @baz .*)"))
        .deep.equals([["->", "foo->bar", "@", "baz", ".*"]]);
    });

    it("deref sexp", function() {
      expect(readSeq("@(foo)")).deep.equals(["@", ["foo"]]);
    });

    it("annotation ", function() {
      expect(readSeq("(def ^private foo)"))
        .deep.equals([["def", "^", "private", "foo"]]);
    });

    it("var quote ", function() {
      expect(readSeq("#'foo")).deep.equals(["#", "'foo"]);
    });

    it("anonym fun literal ", function() {
      expect(readSeq("#(foo %)")).deep.equals(["#", ["foo", "%"]]);
    });

    it("map with string", function() {
      expect(readSeq("{:doc \"A\"}")).deep.equals([[":doc", '"A"']], d(readSeq("{:doc \"A\"}")));
    });

    it("nested map with number", function() {
      expect(readSeq("({2})")).deep.equals([[[2]]], d(readSeq("({2})")));
    });
  });

  describe("tagging positions", function() {
    it("correctly tracks sexps", function() {
      var p = [];
      function xform(type, read, start, end) {
        if (type === 'sexp')
          p.push(printPos(start) + "-" + printPos(end));
      }
      readSeq("(a (bb\nc))", xform);
      expect(p).deep.equals([ '3:0:3-9:1:2', '0:0:0-10:1:3' ]);
    })
  });

  describe("transforming results", function() {

    it("transform function gets read data", function() {
      var log = [];
      function xform(type, read, start, end) { log.push([type, read, start, end]); }
      readSexp("foo", xform);
      expect(log).deep.equals([['symbol', "foo", pos(0,0,0), pos(3,0,3)]]);
    });

    it("transforms the tree", function() {
      var counter = 0;
      function xform(type, read, start, end) {
        return type !== "sexp" ? counter++ : read;
      }
      var res = readSeq('(foo ("bar" (baz) 23))', xform);
      expect(res).deep.equals([[0, [1, [2], 3]]]);
    });

    it("transforms the tree to get locations", function() {
      var counter = 0;
      function xform(type, read, start, end) {
        var result = {type: type, start: start.idx, end: end.idx}
        if (type === "sexp") result.children = read;
        return result;
      }
      var res = readSeq('foo (bar "xyz"\n(12) \'z)', xform);
      var expected = [
        {start: 0,end: 3,type: "symbol"},
        {start: 4,end: 23,type: "sexp", children: [
          {start:5,end:8,type: "symbol"},
          {start:9,end:14,type: "string"},
          {start:15,end:19,type: "sexp", children: [
            {start:16,end:18,type: "number"}
          ]},
          {start:20,end:22,type: "symbol"},
        ]}
      ];
      expect(res).deep.equals(expected, d(res));
    });

  });

  describe("read errors", function() {
    it("embeds error infos for premature ending", function() {
      expect(readSexp("(a(b)"))
        .deep.equals(['a', ['b'], {
          error: "Expected ')' but reached end of input at line 1 column 5",
          start: pos(0,0,0), end: pos(5,0,5)}], d(readSexp("(a(b)")));
    });

    it("unmatched square bracket 1", function() {
      expect(readSeq("(a)(x(let[bar y)z)(b)")).to.containSubset([
        ['a'],
        ['x', ['let', ['bar', 'y',
                      {error: "Expected ']' but got ')' at line 1 column 15"}],
              'z'],
              ['b'],
              {error: "Expected ')' but reached end of input at line 1 column 21"}],
      ]);
    });

    it("unmatched square bracket 2", function() {
      expect(readSeq("(a (b)](x y)")).to.containSubset([
        ['a', ['b'],
         {error: "Expected ')' but got ']' at line 1 column 6"}],
        ['x', 'y']]);
    });

    it("closed too often 1", function() {
      console.log(d(readSeq("(a))(x y)")));
      expect(readSeq("(a))(x y)")).to.containSubset([
        ["a"],
        {error: "Unexpected input: ')' at line 1 column 4"},
        ["x", "y"]]);
    });

  });

});
