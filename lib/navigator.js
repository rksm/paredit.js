/*global window, process, global*/

;(function(run) {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : window.paredit;
  var lang = isNodejs ? module.require('lively.lang') : lively.lang;
  var tree = lang.tree;
  run(tree, exports);

})(function(tree, exports) {

  var last = function(a) { return a[a.length-1]; };

  var nav = exports.navigator = {

    forwardSexp: function(ast, idx) {
      var next = w.nextSexp(ast, idx);
      return next ? next.end : idx;
    },

    backwardSexp: function(ast, idx) {
      var prev = w.prevSexp(ast, idx);
      return prev ? prev.start : idx;
    },

    forwardDownSexp: function(ast, idx) {
      var next = w.nextSexp(ast, idx,
        function(n) { return n.type === 'list'});
      if (!next) return idx;
      if (next.children && next.children[0])
        return next.children[0].start;
      return next.start + 1;
    }

  };

  var w = exports.walk = {

    sexpsAt: function(ast, idx) {
      return tree.filter(ast, function(n) {
        return n.start <= idx && idx <= n.end; }, getChildren);
    },

    nextSexp: function(ast, idx, matchFunc) {
      // Find the next sexp following idx. If idx directly points to a list start,
      // the list it is. Otherwise get the containing list and find the closest
      // following children sexp.

      var listsAt = tree.filter(ast, function(n) {
        return n.start <= idx && idx < n.end && n.type === 'list';
      }, getChildren);

      if (!listsAt.length) return null;

      var direct = listsAt.filter(function(n) {
        return n.start === idx; })[0];
      if (direct) return direct;

      var list = last(listsAt).children.filter(function(n) {
        return idx <= n.start && (!matchFunc || !!matchFunc(n)); })
      if (list.length) return list[0];

      return null;
    },

    prevSexp: function(ast,idx,matchFunc) {
      var listsAt = tree.filter(ast, function(n) {
        return n.start < idx && idx <= n.end && n.type === 'list';
      }, getChildren);
      if (!listsAt.length) return null;
console.log(listsAt);
      var direct = listsAt.filter(function(n) {
        return n.end === idx; })[0];
      if (direct) return direct;

      var list = last(listsAt).children.filter(function(n) {
        return n.end <= idx && (!matchFunc || !!matchFunc(n)); })
      if (list.length) return last(list);

      return null;
    },

    stringify: function(node) {
      return tree.mapTree(node,
        function(n, children) {
          if (n.type === 'list' || n.type === 'toplevel')
            return '(' + children.join(" ") + ')';
          return n.source ? n.source :
            lively.lang.arr.withN(node.end-node.start, 'x').join(""); },
        function(n) { return (n && n.children) || []; });
    }

  }

  function getChildren(node) { return node.children || []; }
});
