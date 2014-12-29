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

function pos(i,r,c) { return {idx: i, row: r, column: c}; };

var d = lively.lang.obj.inspect

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
      expect(readSeq("()")).deep.equals([[]]);
    });

    it('reads simple list', function() {
      expect(readSeq("(foo bar)")).deep.equals([["foo", "bar"]]);
    });

    it('reads nested lists', function() {
      expect(readSeq("(foo bar) (baz (zzz)) zork"))
        .deep.equals([["foo", "bar"], ["baz", ["zzz"]], "zork"]);
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

  describe("transforming results", function() {

    it("transform function gets read data", function() {
      var log = [];
      function xform(type, read, start, end) {
        log.push([type, read, start, end]);
      }
      var res = readSexp("foo", xform);
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
      var res = readSeq('(foo ("bar" (baz) 23))', xform);
      var expected = [{
        start: 0,end: 23,type: "sexp",
        children: [
          {start: 1,end: 4,type: "symbol"},
          {start: 5,end: 21,type: "sexp",
           children: [
            {start: 6,end: 9,type: "string"},
            {start: 10,end: 16,type: "sexp",
             children: [{start: 11,end: 14,type: "symbol"}]},
            {start: 17,end: 19,type: "number"}]
          }]
      }];
      expect(res).deep.equals(expected, d(res));
    });

  });

  describe("read errors", function() {
    it("embeds error infos for premature ending", function() {
      expect(readSexp("(foo (bar)"))
        .deep.equals({
          error: "Expected closing ')' at line 1 column 11",
          start: pos(0,0,0), end: pos(11,0,11)});
    });
  });

});
