/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  var util = isNodejs ? module.require('./util').util : window.paredit.util;
  var nav = isNodejs ? module.require("./navigator").navigator : window.paredit.navigator;
  var w = isNodejs ? module.require("./navigator").walk : window.paredit.walk;
  run(nav, w, util, exports);

})(function(nav, w, util, exports) {

  // (map (comp name first) (seq clojure.lang.Compiler/specials))
  exports.specialForms = [
    "&", "monitor-exit", /^case/, "try", /^reify/, "finally", /^loop/, "do",
    /^let/, /^import/, "new", /^deftype/, /^let/, "fn", "recur", "set!",
    ".", "var", "quote", "catch", "throw", "monitor-enter",

    'ns', /^def/,/^if/,/^when/,/->/, "while", "for",
    /^with/, "testing", "while", "cond", "condp"];

  var ed = exports.editor = {

    rewrite: function(ast, nodeToReplace, newNodes) {
      var indexOffset = newNodes.length ?
        last(newNodes).end - nodeToReplace.end :
        nodeToReplace.start - nodeToReplace.end;

      var parents = w.containingSexpsAt(ast, nodeToReplace.start);

      // Starting from the parent of the nodeToReplace: construct new
      // parents out of the changed child, bottom up
      // With that we don't need to modify the exising AST. Note that during
      // this recursive construction we need to update the children to the "right"
      // of the modification
      var replaced = parents.reduceRight(function(replacement, parent) {
        var idxInParent = parent.children.indexOf(replacement.original);
        var childList;

        if (idxInParent > -1) {
          childList = parent.children.slice(0,idxInParent)
            .concat(replacement.nodes)
            .concat(parent.children.slice(idxInParent+1)
              .map(moveNode.bind(null,indexOffset)));
        } else childList = parent.children;

        var newParent = util.merge(parent, {
          end: parent.end+indexOffset,
          children: childList
        });

        return {original: parent, nodes: [newParent]};
      }, {original: nodeToReplace, nodes: newNodes});

      return replaced.nodes[0];
    },

    spliceSexp: function(ast, src, idx) {
      var sexps = w.containingSexpsAt(ast,idx,w.hasChildren);
      if (!sexps.length) return null;
      var sexp = sexps.pop();

      // we are dealing with a list split
      var newIndex = idx-sexp.open.length,
          changes = [['remove', sexp.end-1, sexp.close.length],
                     ['remove', sexp.start, sexp.open.length]];

      return {changes: changes, newIndex: newIndex};
    },

    splitSexp: function(ast, src, idx) {
      var sexps = w.containingSexpsAt(ast,idx);
      if (!sexps.length) return null;
      var sexp = sexps.pop();
      if (!w.hasChildren(sexp) && sexp.type !== "string")
        return null;
      // we are dealing with a list or string split
      var insertion = sexp.close+" "+sexp.open,
          newIndex = idx+sexp.close.length,
          changes = [['insert', idx, insertion]];
      return {changes: changes, newIndex: newIndex};
    },

    killSexp: function(ast, src, idx, args) {
      args = args || {}
      var count = args.count || 1;
      var backward = args.backward;
      var sexps = w.containingSexpsAt(ast,idx, w.hasChildren);
      if (!sexps.length) return null;
      var parent = sexps.pop();

      if (backward) {
        var left = leftSiblings(parent, idx);
        if (!left.length) return null;
        var remStart = left.slice(-count)[0].start;
        var changes = [['remove', remStart, idx-remStart]];
        var newIndex = remStart;
      } else {
        var right = rightSiblings(parent, idx);
        if (!right.length) return null;
        var newIndex = idx;
        var changes = [['remove', idx, last(right.slice(0,count)).end-idx]];
      }

      return {changes: changes, newIndex: newIndex};
    },

    wrapAround: function(ast, src, idx, wrapWithStart, wrapWithEnd, args) {
      var count = (args && args.count) || 1;
      var sexps = w.containingSexpsAt(ast,idx, w.hasChildren);
      if (!sexps.length) return null;
      var parent = last(sexps);
      var sexpsToWrap = parent.children.filter(function(c) {
        return c.start >= idx; }).slice(0,count);
      var end = last(sexpsToWrap);
      var changes = [
        ['insert', idx, wrapWithStart],
        ['insert', (end ? end.end : idx) + wrapWithStart.length, wrapWithEnd]];
      return {changes: changes, newIndex: idx+wrapWithStart.length};
    },

    closeAndNewline: function(ast, src, idx, close) {
      close = close || ")"
      var sexps = w.containingSexpsAt(ast,idx, function(n) {
        return w.hasChildren(n) && n.close === close; });
      if (!sexps.length) return null;
      var parent = last(sexps),
          newlineIndent = times(rowColumnOfIndex(src, parent.start), ' '),
          insertion = "\n"+newlineIndent;
      var changes = [
        ['insert', parent.end, insertion]];
      return {changes: changes, newIndex: parent.end+insertion.length};
    },

    barfSexp: function(ast, src, idx, args) {
      var backward = args && args.backward;
      var sexps = w.containingSexpsAt(ast,idx, w.hasChildren);
      if (!sexps.length) return null;
      var parent = last(sexps);
      if (backward) {
        var left = leftSiblings(parent, idx);
        if (!left.length) return null;
        var changes = [
          ['insert', left[1] ? left[1].start : idx, parent.open],
          ['remove', parent.start, parent.open.length]];
      } else {
        var right = rightSiblings(parent, idx);
        if (!right.length) return;
        var changes = [
          ['remove', parent.end-parent.close.length, parent.close.length],
          ['insert', right[right.length-2] ? right[right.length-2].end : idx, parent.close]];
      }
      return {changes: changes, newIndex: idx};
    },

    slurpSexp: function(ast, src, idx, args) {
      var backward = args && args.backward;
      var count = args.count || 1;
      var sexps = w.containingSexpsAt(ast,idx, w.hasChildren);
      if (sexps.length < 2) return null;
      var parent = sexps.pop();
      var parentParent = sexps.pop();
      if (backward) {
        var left = leftSiblings(parentParent, idx);
        if (!left.length) return;
        var changes = [
          ['remove', parent.start, parent.open.length],
          ['insert', left.slice(-count)[0].start, parent.open]];
      } else {
        var right = rightSiblings(parentParent, idx);
        if (!right.length) return;
        var changes = [
          ['insert', last(right.slice(0,count)).end, parent.close],
          ['remove', parent.end-parent.close.length, parent.close.length]];
      }
      return {changes: changes, newIndex: idx};
    },

    indentRange: function(ast, src, start, end) {
      var startLineIdx = rowStartIndex(src, start),
          endLineIdx = src.slice(end).indexOf("\n");
      endLineIdx = endLineIdx > -1 ? endLineIdx+end : src.length;

      var linesToIndent = src.slice(startLineIdx, endLineIdx).split("\n");

      return linesToIndent.reduce(function(indent, line) {
        var idx = indent.idx,
            changes = indent.changes,
            ast = indent.ast,
            src = indent.src;

        var outerSexps = w.containingSexpsAt(ast, idx, w.hasChildren),
            parent = last(outerSexps);

        if (!parent) return {
          idx: idx+line.length+1,
          newIndex: idx,
          changes:changes, ast:ast, src: src
        };

        // whitespace at bol that needs to be "removed"
        var ws = line.match(/^\s*/)[0],
            // figure out much whitespace we need to add
            indentOffset = computeIndentOffset(src, parent, idx) - ws.length,
            lineLength = line.length + indentOffset;

        // record what needs to be changed and update source
        if (indentOffset > 0) {
          var insert = times(indentOffset, " ");
          changes.push(["insert", idx, insert]);
          src = src.slice(0,idx) + insert + src.slice(idx);
        } else if (indentOffset < 0) {
          changes.push(["remove", idx, -indentOffset]);
          src = src.slice(0,idx) + src.slice(idx-indentOffset);
        }

        // also update the ast: "move" the next node to the right accordingly,
        // "update" the entire ast
        var right = rightSiblings(parent, idx)[0];
        if (right) {
          var indentedRight = moveNode(indentOffset, right);
          ast = ed.rewrite(ast, right, [indentedRight]);
        } else {
          // if no siblings, udpdate the end of the list node
          ast = ed.rewrite(ast, parent,
            [util.merge(parent, {end: parent.end+indentOffset})]);
        }

        return {
          idx: idx + lineLength + 1, /*newline*/
          newIndex: idx + indentOffset, // for cursor placement
          changes: changes, ast: ast, src: src
        }
      }, {idx: startLineIdx, changes: [], ast: ast, src: src});
    }

  };


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // positioning helpers

  function rowStartIndex(src, idx) { return src.slice(0,idx).lastIndexOf("\n")+1; }

  function rowColumnOfIndex(src, idx) { return idx - rowStartIndex(src,idx); }

  function computeIndentOffset(src, parentSexp, idx) {
    if (parentSexp.type === 'toplevel') return 0;
    var left = leftSiblings(parentSexp, idx);
    if (isSpecialForm(parentSexp, src)) return rowColumnOfIndex(src, parentSexp.start + parentSexp.open.length+1);
    if (left.length <= 1 || parentSexp.open !== "(")
      return rowColumnOfIndex(src, parentSexp.start + parentSexp.open.length);
    return rowColumnOfIndex(src, left[1].start);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lang helper

  function last(a) { return a[a.length-1]; };

  function times(n, ch) { return new Array(n+1).join(ch); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ast helpers
  function moveNode(offset, n) {
    // changes start/end of node and its children
    return util.mapTree(n,
      function(n, children) {
        return util.merge(n, {
          start: n.start+offset,
          end: n.end+offset,
          children: children
        });
      }, function(n) { return n.children; });
  }

  function leftSiblings(parentNode, idx) {
    return parentNode.children.filter(function(n) {
      return n.end <= idx; });
  }

  function rightSiblings(parentNode, idx) {
    return parentNode.children.filter(function(n) {
      return idx <= n.start; });
  }

  function isSpecialForm(parentSexp, src) {
    if (!w.hasChildren(parentSexp) || !parentSexp.children.length) return false;
    var srcOfFirstNode = parentSexp.children[0].source;
    if (!srcOfFirstNode) return false;
    return exports.specialForms.some(function(f) {
      if (typeof f === "string") return f === srcOfFirstNode;
      else if (typeof f === "function") return f(srcOfFirstNode, parentSexp.children[0]);
      else if (f instanceof RegExp) return f.test(srcOfFirstNode);
      else return false;
    });
  }

});
