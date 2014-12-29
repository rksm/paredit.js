/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : (window.paredit = {});
  run(exports);

})(function(exports) {

  exports.parser = {
    parseLisp: function(src) {
      return exports.reader.readSeq(src, function xform(type, read, start, end) {
        var result = {type: type, start: start.idx, end: end.idx}
        if (type === "sexp") result.children = read;
        return result;
      });
    }
  }

  exports.reader = {

    readSeq: function(src, xform) {
      return readSeq(null,src,Object.freeze([]),startPos(),xform).context;
    },

    readSexp: function(src, xform) {
      return readSexp(null,src,Object.freeze([]),startPos(),xform).context[0];
    }
  };

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // read logic

  var eosexp = {},
      close = {'[': ']', '(': ')', '{': '}'},
      symRe = /[^\s\[\]\(\)\{\},]/,
      readerSpecials = /[`@^#~]/;

  function readSexp(contextStart, input, context, pos, xform) {
    var ch = input[0];

    if (!ch && contextStart) {
      throw new Error("Early end, expected to close "
        + contextStart + " with " + close[contextStart])
    }

    if (!ch || /\s|,/.test(ch)) return {
      input: input.slice(1),
      context: context,
      pos: forward(pos, ch)
    };

    if (readerSpecials.test(ch)) return readReaderSpecials(input, context, pos, xform);
    if (ch === ';') return readComment(input, context, pos, xform);
    if (ch === '"') return readString(input, context, pos, xform);
    if (/[0-9]/.test(ch)) return readNumber(input, context, pos, xform);
    if (symRe.test(ch)) return readSymbol(input, context, pos, xform);

    if (ch === close[contextStart]) return {
      input: input,
      context: context,
      pos: forward(pos, ch),
      flag: eosexp
    };

    if (ch === "(" || ch === "[" || ch === "{") {
      var startPos = clonePos(pos);
      var nested = readSeq(ch, input.slice(1), Object.freeze([]), forward(pos, ch), xform);
      var nextCh = nested.input[0];

      var sexp, endPos, restInput;
      if (nextCh !== close[ch]) {
        var errPos = clonePos(nested.pos);
        var err = readError("Expected closing ')'", startPos, errPos);
        sexp = err;
        endPos = nested.pos;
        restInput = nested.input;
      } else {
        sexp = nested.context;
        endPos = forward(nested.pos, close[ch]);
        restInput = nested.input.slice(1);
      }

      sexp = callTransform(xform, "sexp", sexp, startPos, endPos);;
      context = context.concat([sexp]);

      return {input: restInput, context: context, pos: endPos}
    }
    
    var startPos = clonePos(pos), errPos = forward(pos, ch);
    var err = readError("No rule for reading: " + ch, startPos, errPos);
    context = context.concat([err]);
    return {input: input.slice(1), context: context, pos: errPos};
  }

  function readSeq(contextStart, input, context, pos, xform) {
    var result, counter = 0;
    while (true) {
      counter++; if (counter > 10000) throw new Error("endless loop at " + printPos(pos));
      result = readSexp(contextStart, input, context, pos, xform);
      input = result.input; context = result.context; pos = result.pos;
      if (result.flag === eosexp || input.length === 0) break;
    };
    return {input: input, context: context, pos: pos};
  }

  function readString(input, context, pos, xform) {
    var escaped = false;
    return takeWhile(input.slice(1), pos, function(c) {
      if (!escaped && c === '"') return false;
      if (escaped) escaped = false
      else if (c === "\\") escaped = true;
      return true;
    }, function(read, rest, prevPos, newPos) {
      read = '"' + read + rest[0];
      var result = callTransform(xform, "string", read, prevPos, newPos);
      rest = rest.slice(1)
      context = context.concat([result]);
      return {pos:newPos,input:rest,context:context};
    });
  }

  function readSymbol(input, context, pos, xform) {
    return takeWhile(input, pos,
      function(c) { return symRe.test(c); },
      function(read, rest, prevPos, newPos) {
        var result = callTransform(xform, "symbol", read, prevPos, newPos);
        context = context.concat([result]);
        return {pos: newPos,input:rest,context:context};
      });
  }

  function readNumber(input, context, pos, xform) {
    return takeWhile(input, pos,
      function(c) { return /[0-9]/.test(c); },
      function(read, rest, prevPos, newPos) {
        var result = callTransform(xform, "number", Number(read), prevPos, newPos);
        context = context.concat([result])
        return {pos:newPos,input:rest,context:context};
      });
  }

  function readComment(input, context, pos, xform) {
    return takeWhile(input, pos,
    function(c) { return !/\n/.test(c); },
    function(read, rest, prevPos, newPos) {
      var result = callTransform(xform, "comment", read+"\n", prevPos, newPos);
      rest = rest.slice(1);
      context = context.concat([result]);
      return {pos: newPos,input:rest,context:context};
    });
  }

  function readReaderSpecials(input, context, pos, xform) {
    return takeWhile(input, pos,
      function(c) { return readerSpecials.test(c); },
      function(read, rest, prevPos, newPos) {
        var result = callTransform(xform, "special", read, prevPos, newPos);
        context = context.concat([result]);
        return {pos: newPos,input:rest,context:context};
      });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function readError(msg, startPos, endPos) {
    return {
      error: msg + " at line "
          + (endPos.row+1) + " column " + endPos.column,
      start: startPos, end: endPos
    }
  }

  function callTransform(xform, type, read, start, end) {
    return xform ? xform(type, read, start, end) : read;
  }

  function takeWhile(string, pos, fun, withResultDo) {
    var startPos = clonePos(pos), result = "";
    for (var i = 0; i < string.length; i++) {
      if (fun(string[i])) result += string[i];
      else break;
    }
    return withResultDo(
      result, string.slice(result.length),
      startPos, forward(pos, result));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // position helpers

  function startPos() { return {idx: 0, column: 0, row: 0}; }

  function clonePos(pos) { return {idx: pos.idx, column: pos.column, row: pos.row}; }

  function printPos(pos) { return JSON.stringify(pos); }

  function forward(pos, read) {
    // note: pos is deliberately transient for performance
    pos.idx += read.length;
    var lines = read.split("\n");
    var ll = lines.length;
    pos.row += ll-1;
    var lastRowL = lines[ll-1].length;
    pos.column = ll > 1 ? lastRowL : pos.column + lastRowL;
    return pos;
  }

});
