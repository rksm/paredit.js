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
          insertion = close+open,
          newIndex = idx+close.length,
          changes = [['insert', idx, insertion]];

      return {changes: changes, newIndex: newIndex};
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
