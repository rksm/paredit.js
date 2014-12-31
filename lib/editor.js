/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  var lang = isNodejs ? module.require('lively.lang') : lively.lang;
  run(exports);

})(function(exports) {

  function last(a) { return a[a.length-1]; };
  function flatmap(a, func) {
    return a.reduce(function(res, ea) { return res.concat(func(ea)); }, []);
  }

  var nav = exports.navigator;
  var w = exports.walk;

  var ed = exports.editor = {
    
    splitSexp: function(ast, idx) {
      var sexps = w.containingSexpsAt(ast,idx);
      if (!sexps.length) return ast;
      var sexp = sexps.pop();
      if (!sexp.children) return ast; // later

      // we are dealing with a list split
      var open = sexp.open,
          close = sexp.close,
          changes = [['insert', idx, close+open]],
          insertionLength = close.length + open.length;

      // take the node to be splitted and make it two :)
      // The children to the "right" need to be shifted
      var childrenGrouped = lively.lang.arr.groupBy(sexp.children,
            function(ea) { return ea.end <= idx ? 'left' : 'right'; }),
          left = lively.lang.obj.merge(sexp, {
            children: childrenGrouped.left || [],
            end: idx+open.length
          }),
          right = lively.lang.obj.merge(sexp, {
            children: (childrenGrouped.right || []).map(moveNode.bind(null,insertionLength)),
            start: idx+open.length,
            end: sexp.end+insertionLength
          });

      // Starting from the parent of the splitted element: construct new
      // parents out of the changed child, bottom up
      // With that we don't need to modify the exising AST. Note that during
      // this recursive construction we need to shift the children to the "right"
      // of the modification
      var newAST = sexps.reduceRight(function(replacement, parent) {
        var idxInParent = parent.children.indexOf(replacement.original);
        var childList;

        if (idxInParent > -1) {
          childList = parent.children.slice(0,idxInParent)
            .concat(replacement.nodes)
            .concat(parent.children.slice(idxInParent+1)
              .map(moveNode.bind(null,insertionLength)));
        } else childList = parent.children;
        
        var newParent = lively.lang.obj.merge(parent, {
          end: parent.end+insertionLength,
          children: childList
        });

        return {original: parent, nodes: [newParent]};
      }, {original: sexp, nodes: [left, right]});

      return {ast: newAST.nodes[0], changes: changes};
    }
  };

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

});
