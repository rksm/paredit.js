/*global window, process, global*/

// If not on nodejs: concat or load lib files after loading this files.

(function() {
  var isNodejs = typeof module !== "undefined" && module.require;
  var exports = isNodejs ? module.exports : (window.paredit = {});
  if (isNodejs) {
    exports.reader = module.require("./lib/reader").reader;
    exports.navigator = module.require("./lib/navigator").navigator;
  }

  exports.parse = function(src, options) {
    options = options || {};
    var addSrc = !!options.addSourceForLeafs;
    var nodes = exports.reader.readSeq(src, function xform(type, read, start, end) {
      var result = {type: type, start: start.idx, end: end.idx};
      if (addSrc && type !== 'sexp')
        result.source = src.slice(result.start, result.end)
      if (type === "sexp") result.children = read;
      return result;
    });
    return {
      type: "toplevel", start: 0,
      end: (nodes && nodes.length && nodes[nodes.length-1].end) || 0,
      children: nodes
    };
  }

})();
