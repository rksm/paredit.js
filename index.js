/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var Immutable = isNodejs ? module.require("Immutable") : window.Immutable;
  var exports = isNodejs ? module.exports : (window.paredit = {});
  run(Immutable, exports);

})(function(i, exports) {

  exports.reader = {

    readSeq: function(src) {
      return readSeq(null, i.Seq(src), i.List())[1].toJS();
    },

    readSexp: function(src) {
      return readSexp(null, i.Seq(src), i.List())[1].toJS()[0];
    },
  };

  var eos = {};
  var close = {'[': ']', '(': ')', '{': '}'};
  var symRe = /[^\s\[\]\(\)\{\}]/;

  function readSexp(contextStart, stream, context) {
    var ch = stream.first();

    if (!ch && contextStart) {
      throw new Error("Early end, expected to close "
        + contextStart + " with " + close[contextStart])
    }

    if (!ch || /\s/.test(ch)) return [stream.rest(), context];
    if (ch === '"') return readString(stream, context);
    if (/[0-9]/.test(ch)) return readNumber(stream, context);
    if (symRe.test(ch)) return readSymbol(stream, context);

    if (ch === close[contextStart]) return [stream, context, eos];

    if (ch === "(" || ch === "[" || ch === "{") {
      var nested = readSeq(ch, stream.rest(), i.List());
      var nextCh = nested[0].first();
      if (nextCh !== close[ch])
        throw new Error("Expected '" + close[ch] + "' but read " + nextCh);
      return [nested[0].rest(), context.push(nested[1])];
    }

    throw new Error("No rule for reading: " + stream.slice(0,40).toJS().join(""));
  }

  function readSeq(contextStart, stream, context) {
    var result, counter = 0;
    while (true) {
      counter++; if (counter > 100) throw new Error("endless loop");
      result = readSexp(contextStart, stream, context);
      stream = result[0]; context = result[1];
      if (result[2] === eos || stream.size === 0) break;
    };
    return [stream, context];
  }

  function readNumber(src) {
    var n = Number(src);
    return isNaN(n) ? null : n;
  }
  
  function readString(stream, context) {
    var str = '"'; stream = stream.rest();
    while (true) {
      str += stream.takeWhile(function(str, c) { return c !== '"'; }).join("");
      stream = stream.slice(str.length+1);
      if (str[str.length-1] === '\\') {
        str += '"'; 
      } else break;
    }
    return [stream.rest(), context.push(str)];
  }

  function readSymbol(stream, context) {
    var sym = stream.takeWhile(function(c) { return symRe.test(c); }).join("");
    return [stream.slice(sym.length), context.push(sym)];
  }

  function readNumber(stream, context) {
    var sym = stream.takeWhile(function(c) { return /[0-9]/.test(c); }).join("");
    return [stream.slice(sym.length), context.push(Number(sym))];
  }

});
