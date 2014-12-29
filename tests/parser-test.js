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

  var sut = paredit.reader;

  it('reads symbol', function() {
    expect(sut.readSeq("foo")).deep.equals(["foo"]);
  });

  it('reads next symbol', function() {
    expect(sut.readSexp("foo bar")).deep.equals(["foo"]);
  });

  describe("sequences and nestedness", function() {

    it('reads sequence', function() {
      expect(sut.readSeq("foo bar baz")).deep.equals(["foo", "bar", "baz"]);
    });

    it('reads empty sexp', function() {
      expect(sut.readSeq("()")).deep.equals([[]]);
    });

    it('reads simple list', function() {
      expect(sut.readSeq("(foo bar)")).deep.equals([["foo", "bar"]]);
    });

    it('reads nested lists', function() {
      expect(sut.readSeq("(foo bar) (baz (zzz)) zork"))
        .deep.equals([["foo", "bar"], ["baz", ["zzz"]], "zork"]);
    });

    it('reads vector syntax', function() {
      expect(sut.readSeq("(foo [bar])"))
        .deep.equals([["foo", ["bar"]]]);
    });
  });

  describe("whitespace", function() {
    it('ignores whitespace', function() {
      expect(sut.readSeq(" \n    foo   ")).deep.equals(["foo"]);
      expect(sut.readSeq("barr   foo")).deep.equals(["barr", "foo"]);
      expect(sut.readSeq("  (   bar   )  ")).deep.equals([["bar"]]);
    });
  });

  describe("strings", function() {

    it("reads strings", function() {
      expect(sut.readSeq('"fooo"')).deep.equals(['"fooo"']);
    });

    it("escapes", function() {
      expect(sut.readSeq('"fo\\"oo"')).deep.equals(['"fo\\"oo"']);
    });

  })

  describe("numbers", function() {
    it("reads number value", function() {
      expect(sut.readSeq('123')).deep.equals([123]);
    });
  });

  describe("symbols", function() {
    it("reads quoted", function() {
      expect(sut.readSeq("'123")).deep.equals(["'123"]);
    });

  });
});
