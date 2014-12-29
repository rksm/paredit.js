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
    it("are ignored", function() {
      expect(readSeq("; foo\n(baz ;; bar  \n  zork)"))
        .deep.equals([["baz", "zork"]])
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
  });

});
