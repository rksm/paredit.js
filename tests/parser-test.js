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
      expect(readSexp("'123")).eq("'123");
    });

    it("reads slash", function() {
      expect(readSexp("foo/bar")).eq("foo/bar");
    });

    it("reads keywords", function() {
      expect(readSexp(":foo")).eq(":foo");
    });
  });

  describe("examples", function() {
    it("reads threaded", function() {
      expect(readSeq("(-> foo->bar @baz .*)"))
        .deep.equals([["->", "foo->bar", "@baz", ".*"]]);
    });

    it("deref sexp", function() {
      expect(readSeq("@(foo)"))
        .deep.equals(["@", ["foo"]]);
    });
  });
});
