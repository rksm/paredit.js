/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  run(exports);

})(function(exports) {

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

  var eosexp = {}, eoinput = {}, // flags
      close = {'[': ']', '(': ')', '{': '}'},
      opening = Object.keys(close),
      closing = opening.map(function(k) { return close[k]; }),
      symRe = /[^\s\[\]\(\)\{\},]/,
      readerSpecials = /[`@^#~]/;

  function readSexp(contextStart, input, context, pos, xform) {
    var ch = input[0];

    // We have reached the end of input but expting more.
    if (!ch && contextStart && close[contextStart]) {
      return {input: input, context: context, pos: pos, flag: eoinput};
    }

    // If there is no contextStart and no char left we are at the topLevel
    // and done reading.
    if (!ch && !close[contextStart]) return {
      input: input,
      context: context,
      pos: pos,
      flag: eoinput
    }

    // 3. whitespace
    if (/\s|,/.test(ch)) return {
      input: input.slice(1),
      context: context,
      pos: forward(pos, ch)
    };

    // 4. Various read rules
    if (readerSpecials.test(ch)) return readReaderSpecials(input, context, pos, xform);
    if (ch === ';') return readComment(input, context, pos, xform);
    if (ch === '"') return readString(input, context, pos, xform);
    if (/[0-9]/.test(ch)) return readNumber(input, context, pos, xform);
    if (symRe.test(ch)) return readSymbol(input, context, pos, xform);

    if (closing.indexOf(ch) > -1) {
      if (!contextStart) {
        var junk = readJunk(input, context, pos, xform);
        return {input: junk.input, context: junk.context, pos: junk.pos}
      }
      return {input: input, context: context, pos: pos, flag: eosexp}
    }

    if (opening.indexOf(ch) > -1) {
      var startPos = clonePos(pos),
          nested = readSeq(ch, input.slice(1), Object.freeze([]), forward(pos, ch), xform),
          nextCh = nested.input[0];

      if (nextCh !== close[ch]) {
        var errPos = clonePos(nested.pos),
            errMsg = "Expected '" + close[ch] + "'"
                   + (nextCh ? " but got '" + nextCh + "'" :
                      " but reached end of input"),
            err = readError(errMsg, startPos, errPos);
        nested.context.push(err);
      }
      
      var endPos = nextCh ? forward(nested.pos, nextCh) : nested.pos;
      var restInput = nested.input.slice(nextCh ? 1 : 0);
      var sexp = callTransform(xform, "sexp", nested.context, startPos, endPos);;
      context = context.concat([sexp]);

      return {input: restInput, context: context, pos: endPos}
    }

    // If we are here, either there is a char not covered by the sexp reader
    // rules or we are toplevel and encountered garbage
    var startPos = clonePos(pos), errPos = forward(pos, ch);
    var err = readError("Unexpected character: " + ch, startPos, errPos);
    context = context.concat([err]);
    return {input: input.slice(1), context: context, pos: errPos};
  }

  function readSeq(contextStart, input, context, pos, xform) {
    var result, counter = 0;
    while (true) {
      counter++; if (counter > 10000) throw new Error("endless loop at " + printPos(pos));
      result = readSexp(contextStart, input, context, pos, xform);
      input = result.input; context = result.context; pos = result.pos;
      if (result.flag === eoinput || (result.flag === eosexp && (contextStart || !input.length)))
        break;

      // if (result.flag === eosexp && !contextStart)
      //   result = readJunk(input, context, pos, xform);
      // input = result.input; context = result.context; pos = result.pos;
    };
    return {input: input, context: context, pos: pos};
  }

  function readString(input, context, pos, xform) {
    var escaped = false;
    var startPos = clonePos(pos);
    var string = input[0];
    pos = forward(pos, input[0]); input = input.slice(1);
    return takeWhile(input, pos, function(c) {
      if (!escaped && c === '"') return false;
      if (escaped) escaped = false
      else if (c === "\\") escaped = true;
      return true;
    }, function(read, rest, prevPos, newPos) {
      string = string + read + rest[0];
      newPos = forward(newPos, rest[0]); rest = rest.slice(1);
      var result = callTransform(xform, "string", string, startPos, newPos);
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

  function readJunk(input, context, pos, xform) {
    return takeWhile(input, pos,
      // FIXME: there can be other junk except closing parens...
      function(c) { return closing.indexOf(c) > -1; },
      function(read, rest, prevPos, newPos) {
        var err = readError("Unexpected input: '" + read + "'", prevPos, newPos)
        var result = callTransform(xform, "junk", err, prevPos, newPos);
        context = context.concat([result]);
        return {pos: newPos,input:rest,context:context};
      });
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function readError(msg, startPos, endPos) {
    return {
      error: msg + " at line "
          + (endPos.row+1) + " column " + endPos.column,
      start: clonePos(startPos), end: clonePos(endPos)
    }
  }

  function callTransform(xform, type, read, start, end) {
    return xform ? xform(type, read, clonePos(start), clonePos(end)) : read;
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
