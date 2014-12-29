/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  var tree = lively.lang.tree;
  run(tree, exports);

})(function(tree, exports) {

  var last = function(a) { return a[a.length-1]; };

  var nav = exports.navigator = {

    forwardSexp: function(ast, idx) {
      var next = w.nextSexp(ast, idx);
      return next ? next.end : idx;
    }
  };

  var w = exports.walk = {

    sexpsAt: function(ast, idx) {
      return tree.filter(ast,
        function(n) { return n.start <= idx && idx <= n.end; },
        children);
    },

    sexpsWithTypeAt: function(ast, idx, type) {
      return w.sexpsAt(ast,idx)
        .filter(function(n) { return n.type === type; });
    },

    nextSexp: function(ast, idx) {
      var sexps = w.sexpsWithTypeAt(ast, idx, "sexp");
      if (!sexps.length) return idx;

      var direct = sexps.filter(function(n) {
        return n.start === idx; })[0];
      if (direct) return direct;

      var children = last(sexps).children.filter(function(n) {
        return idx <= n.start; })
      if (children.length) return children[0];

      return idx;
    }
  }

  function children(node) { return node.children || []; }
});
