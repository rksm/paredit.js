/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  var lang = isNodejs ? module.require('lively.lang') : lively.lang;
  run(exports);

})(function(exports) {

  var nav = exports.navigator;
  var w = exports.walk;

  exports.specialForms = [
    'ns', 'try', 'var', 'do', 'fn', 'let', 'loop', 'monitor-enter',
    'monitor-exit', 'recur', 'case', /^def/,/^if/,/^when/,/->/,
    /^with/, "testing"];

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

        var newParent = lively.lang.obj.merge(parent, {
          end: parent.end+indexOffset,
          children: childList
        });

        return {original: parent, nodes: [newParent]};
      }, {original: nodeToReplace, nodes: newNodes});

      return replaced.nodes[0];
    },

    splitSexp: function(ast, idx) {
      var sexps = w.containingSexpsAt(ast,idx);
      if (!sexps.length) return ast;
      var sexp = sexps.pop();
      if (!w.hasChildren(sexp)) return ast; // later

      // we are dealing with a list split
      var open = sexp.open,
          close = sexp.close,
          insertion = close+open,
          newIndex = idx+close.length,
          changes = [['insert', idx, insertion]];

      return {changes: changes, newIndex: newIndex};
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

  function flatmap(a, func) {
    return a.reduce(function(res, ea) { return res.concat(func(ea)); }, []);
  }

  function times(n, ch) { return new Array(n+1).join(ch); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ast helpers
  function moveNode(offset, n) {
    // changes start/end of node and its children
    return lively.lang.tree.mapTree(n,
      function(n, children) {
        return lively.lang.obj.merge(n, {
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
      else return false
    });
  }

});
