(function(ace) {

var Editor = ace.require("ace/editor").Editor;
var oop = ace.require("ace/lib/oop");

oop.mixin(Editor.prototype, {

  posToIdx: function(pos) { return this.session.doc.positionToIndex(pos); },
  idxToPos: function(idx) { return this.session.doc.indexToPosition(idx); },

  getCursorIndex: function() { return this.posToIdx(this.getCursorPosition()); },
  moveCursorToIndex: function(idx) { return this.moveCursorToPosition(this.idxToPos(idx)) },

  saveExcursion: function(doFunc) {
    // will remember the current selection. doFunc can change the
    // selection, cursor position etc and then invoke the passed in callback
    // `reset` to undo those changes
    var currentRange = this.getSelectionRange(), self = this;
    function reset() { self.selection.setRange(currentRange); }
    return doFunc.call(this, reset);
  }

});

ace.improved = true;

})(window.ace);
