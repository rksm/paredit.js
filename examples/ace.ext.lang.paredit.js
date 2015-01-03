(function(ace, paredit) {

ace.ext = ace.ext || {};
ace.ext.lang = ace.ext.lang || {};
var pareditAce = ace.ext.lang.paredit || (ace.ext.lang.paredit = {});

var oop = ace.require('ace/lib/oop');

function load() {
  // wrap the mode changer of ace so that we can automatically hook into any
  // editor.
  var edProto = ace.require('ace/editor').Editor.prototype;
  var onChangeMode = edProto.onChangeMode.originalFunction || edProto.onChangeMode;
  edProto.onChangeMode.originalFunction = onChangeMode;

  edProto.onChangeMode = function(e) {
    var mode = this.session.getMode();
    if (isActiveFor(mode) && !mode["$ext.lang.paredit.modeMixin"]) {
      oop.implement(mode, pareditAce.ModeMixin);
    }
    var res = onChangeMode.call(this, e);
    if (mode.attachToEditor) mode.attachToEditor(this);
    return res;
  };

  ace.config.defineOptions(ace.require('ace/editor').Editor.prototype, 'editor', {
    "ext.lang.paredit.showErrors": {initialValue: true},
  });

  // "exports"
  pareditAce.CodeNavigator  = CodeNavigator;
  pareditAce.KeyHandler     = KeyHandler;
  pareditAce.keybindings    = keybindings;
  pareditAce.commands       = commands;
  pareditAce.ModeMixin      = ModeMixin;
  pareditAce.supportedModes = supportedModes;
};

var supportedModes = ['ace/mode/lisp', 'ace/mode/clojure'];
function isActiveFor(mode) {
  return mode && pareditAce.supportedModes.indexOf(mode.$id) > -1;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// lisp specific code navigator

var CodeNavigator = {

  // -=-=-=-=-=-=-=-=-
  // movement
  // -=-=-=-=-=-=-=-=-

  prepareForSourceTransform: function(ed, args) {
    // helper to gather the typically needed data
    var selRange = ed.getSelectionRange(),
        posIdx = ed.session.doc.positionToIndex(ed.getCursorPosition()),
        ast = ed.session.$ast;
    ast && ed.pushEmacsMark && ed.pushEmacsMark(ed.getCursorPosition());
    return {
      pos: posIdx,
      selStart: ed.session.doc.positionToIndex(selRange.start),
      selEnd: ed.session.doc.positionToIndex(selRange.end),
      isSelecting: !!ed.session.$emacsMark || (args && !!args.shifted),
      ast: ast,
      source: ed.getValue(),
      parentSexps: ast && paredit.walk.containingSexpsAt(ast, posIdx, paredit.walk.hasChildren)
    }
  },

  clojureSexpMovement: function(ed, method, args) {
      var data = this.prepareForSourceTransform(ed,args);
      if (!data.ast || !data.ast.type === 'toplevel') return;
      var moveToIdx = paredit.navigator[method](data.ast, data.pos);
      if (moveToIdx !== "undefined") {
          var moveToPos = ed.session.doc.indexToPosition(moveToIdx),
              method = (data.isSelecting ? 'select' : 'moveCursor') + 'ToPosition';
          ed.selection[method](moveToPos);
      }
  },

  forwardSexp: function(ed, args) {
    return this.clojureSexpMovement(ed, "forwardSexp", args);
  },

  backwardSexp: function(ed, args) {
    return this.clojureSexpMovement(ed, "backwardSexp", args);
  },

  backwardUpSexp: function(ed, args) {
    return this.clojureSexpMovement(ed, "backwardUpSexp", args);
  },

  forwardDownSexp: function(ed, args) {
    return this.clojureSexpMovement(ed, "forwardDownSexp", args);
  },

  markDefun: function(ed, args) {
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast || !data.ast.type === 'toplevel') return;
    var range = paredit.navigator.rangeForDefun(data.ast, data.pos);
    if (range) ed.execCommand('expandRegion', {start: range[0], end: range[1]});
  },

  // -=-=-=-=-=-=-=-=-
  // range expansion
  // -=-=-=-=-=-=-=-=-

  expandRegion: function(ed, src, ast, expandState) {
      // use token if no selection
      ast = ast || paredit.parse(src);
      if (expandState.range[0] === expandState.range[1]) {
          var idx = expandState.range[0];
          var range = paredit.navigator.sexpRange(ast, idx);
          return range ? {range: range, prev: expandState} : expandState
      }

      // if selection or no token at point use AST
      var range = paredit.navigator.sexpRangeExpansion(
        ast, expandState.range[0], expandState.range[1]);
      if (!range) return expandState;

      return range ? {range: range, prev: expandState} : expandState;
  },
  
  contractRegion: function(ed, src, ast, expandState) {
    return expandState.prev || expandState;
  },

  // -=-=-=-=-=-=-=-=-
  // indentation
  // -=-=-=-=-=-=-=-=-

  indent: function(ed, args) {
    // paredit.ace.indent(ed);
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var from = args.from, to = args.to;
    if (typeof from !== 'number')
      from = ed.session.doc.positionToIndex(ed.getSelectionRange().start);
    if (typeof to !== 'number')
      to = ed.session.doc.positionToIndex(ed.getSelectionRange().end);
    var indent = paredit.editor.indentRange(data.ast, ed.getValue(), from, to);
    applyPareditChanges(ed, indent.changes,
      indent.changes.newIndex, false);

  },
  
  newlineAndIndent: function(ed) {
    var data = this.prepareForSourceTransform(ed);
    if (!data.ast) return;
    var src = data.source.slice(0,data.pos) + "\n" + data.source.slice(data.pos),
        newPos = {row: ed.getCursorPosition().row+1,column:0},
        ast = paredit.parse(src, {addSourceForLeafs: true}),
        indent = paredit.editor.indentRange(ast, src, data.pos+1, data.pos+1);
    applyPareditChanges(ed,
      [['insert', data.pos, "\n"]].concat(indent.changes), indent.newIndex)
  },

  // -=-=-=-=-=-=-=-=-
  // code transformation
  // -=-=-=-=-=-=-=-=-

  splitSexp: function(ed, args) {
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.splitSexp(data.ast, data.source, data.pos);
    result && applyPareditChanges(ed, result.changes, result.newIndex,
      {start: data.pos, end: paredit.util.last(data.parentSexps).end});
  },

  spliceSexp: function(ed, args) {
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.spliceSexp(data.ast, data.source, data.pos);
    result && applyPareditChanges(ed, result.changes, result.newIndex,
      {start: data.pos, end: paredit.util.last(data.parentSexps).end});
  },

  wrapAround: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var open = args.open || "(", close = args.close || ")",
        result = paredit.editor.wrapAround(
          data.ast, data.source, data.pos, open, close, args);
    result && applyPareditChanges(ed, result.changes, result.newIndex, true);
  },

  closeAndNewline: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.closeAndNewline(data.ast, data.source, data.pos, args.close);
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  barfSexp: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.barfSexp(data.ast, data.source, data.pos, args);
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  slurpSexp: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.slurpSexp(data.ast, data.source, data.pos, args);
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  killSexp: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.killSexp(data.ast, data.source, data.pos, args);
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  delete: function(ed, args) {
    args = args || {};
    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) return;
    var result = paredit.editor.delete(data.ast, data.source, data.pos, args);
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  spliceSexpKill: function(ed, args) {
    args = args || {};
    var backward = args.backward;
    var data = this.prepareForSourceTransform(ed,args);
    var toRemove = paredit.util.last(data.parentSexps).children.filter(function(n) {
      return backward ? n.end <= data.pos : data.pos <= n.start; });
    var result = this.spliceSexp(ed);
    result && applyPareditChanges(ed, result.changes, result.newIndex, true);
    ed.session.$ast = paredit.parse(ed.getValue(), {addSourceForLeafs: true});
    var result = this.killSexp(ed, {backward: backward, count: toRemove.length});
    result && applyPareditChanges(ed, result.changes, result.newIndex, false);
  },

  // -=-=-=-=-=-=-=-
  // other intput
  // -=-=-=-=-=-=-=-
  
  openList: function(ed, args) {
    // FIXME: this is too complex for the ace integration, move to
    // paredit.editor!

    args = args || {};
    var open = args.open || '(', close = args.close || ')';

    var data = this.prepareForSourceTransform(ed,args);
    if (!data.ast) { ed.insert(open); return; }

    var range = ed.getSelectionRange();
    if (range.isEmpty()) {
      applyPareditChanges(ed,
        [["insert", data.pos, open+close]],
        data.pos+open.length, true)
      return;
    }

    ed.selection.clearSelection();

    var parentStart = paredit.util.last(paredit.walk.containingSexpsAt(
      data.ast, data.selStart, paredit.walk.hasChildren));
    var parentEnd = paredit.util.last(paredit.walk.containingSexpsAt(
      data.ast, data.selEnd, paredit.walk.hasChildren));

    // does selection span multiple expressions? collapse selection
    // var left = parentEnd.children.filter(function(ea) { return ea.end <= pos; });
    // var right = parentEnd.children.filter(function(ea) { return pos <= ea.start; });

    if (parentStart !== parentEnd) {
      applyPareditChanges(ed,
        [["insert", data.pos, open+close]],
        data.pos+open.length, true);
      return;
    }

    var inStart = parentEnd.children.filter(function(ea) {
          return ea.start < data.selStart && data.selStart < ea.end ; }),
        inEnd = parentEnd.children.filter(function(ea) {
          return ea.start < data.selEnd && data.selEnd < ea.end ; }),
        moveStart = inStart[0] && inStart[0] !== inEnd[0]
                 && (inEnd[0] || inStart[0].type !== 'symbol'),
        moveEnd = inEnd[0] && inStart[0] !== inEnd[0]
               && (inStart[0] || inEnd[0].type !== 'symbol'),
        insertOpenAt = moveStart ? inStart[0].end : data.selStart,
        insertCloseAt = moveEnd ? inEnd[0].start : data.selEnd;

    applyPareditChanges(ed,
      [["insert", insertCloseAt, close],
       ["insert", insertOpenAt, open]],
      insertOpenAt+open.length,
        {start: insertOpenAt, end: insertCloseAt});
  },
};


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// keyboard setup
// -=-=-=-=-=-=-=-=-=-=-

var oop = ace.require('ace/lib/oop');
var keyUtil = ace.require("ace/lib/keys");
var useragent = ace.require("ace/lib/useragent");
var HashHandler = ace.require("ace/keyboard/hash_handler").HashHandler;
var KEY_MODS = keyUtil.KEY_MODS;


function KeyHandler() {
  HashHandler.call(this);
  this.update();
}

oop.inherits(KeyHandler, HashHandler);

(function() {

  this.handleKeyboard = function (data, hashId, keyString, keyCode) {
      // ed = that.aceEditor
      // ed.keyBinding.$callKeyboardHandlers
      // ed.getKeyboardHandler().commandKeyBinding
      var cmd = HashHandler.prototype.handleKeyboard.call(this, data, hashId, keyString, keyCode);

      if (!cmd || !cmd.command || cmd.command === 'null') return cmd;

      if (typeof cmd.command === 'object') {
        cmd = {command: cmd.command.name,
               args: paredit.util.clone(cmd.command.args)}
      }

      var KEY_MODS = ace.require('ace/lib/keys').KEY_MODS;
      var args = cmd.args || (cmd.args = {});
      // show(KEY_MODS[hashId]+keyString)

      if (KEY_MODS[hashId].indexOf("shift-") > -1) args.shifted = true;
      if (data.count) {
        args.count = data.count;
        data.count = null;
      }

      return cmd;
  };

  this.update = function() {
    this.commandKeyBinding = {};
    this.bindKeys(pareditAce.keybindings);
    
    // FIXME! some characters like ` can't be used in key combos b/c ace
    // escapes them strangely
    var cmdKeyBinding = this.commandKeyBinding
    var inputEscapes = Object.keys(this.commandKeyBinding).filter(function(k) {
      return k.match(/input/); });
    inputEscapes.forEach(function(k) {
      cmdKeyBinding[k.replace(/input/g, '')] = cmdKeyBinding[k];
    });
  };

}).call(KeyHandler.prototype);

var keybindings = {
  "Ctrl-Alt-f|Command-Right|Command-Shift-Right": "forwardSexp",
  "Ctrl-Alt-b|Command-Left|Command-Shift-Left":   "backwardSexp",
  "Ctrl-Alt-u|Command-Up|Command-Shift-Up":       "backwardUpSexp",
  "Ctrl-Alt-d|Command-Down|Command-Shift-Down":   "forwardDownSexp",

  'Ctrl-Alt-h':                                   'markDefun',
  'Shift-Command-Space|Ctrl-Shift-Space':         'expandRegion',
  'Ctrl-Command-space|Ctrl-Alt-Space':            'contractRegion',
  'Ctrl-`':                                       'gotoNextError',

  "Alt-Shift-s":                                  "paredit-splitSexp",
  "Alt-s":                                        "paredit-spliceSexp",
  "Ctrl-Alt-k":                                   {name: "paredit-killSexp", args: {backward: false}},
  "Ctrl-Alt-Backspace":                           {name: "paredit-killSexp", args: {backward: true}},
  "Ctrl-Shift-]":                                 {name: "paredit-barfSexp", args: {backward: false}},
  "Ctrl-Shift-[":                                 {name: "paredit-barfSexp", args: {backward: true}},
  "Ctrl-Shift-9":                                 {name: "paredit-slurpSexp", args: {backward: false}},
  "Ctrl-Shift-0":                                 {name: "paredit-slurpSexp", args: {backward: true}},
  "Alt-Shift-9":                                  {name: "paredit-wrapAround", args: {open: '(', close: ')'}},
  "Alt-[":                                        {name: "paredit-wrapAround", args: {open: '[', close: ']'}},
  "Alt-Shift-0":                                  {name: "paredit-closeAndNewline", args: {close: ')'}},
  "Alt-]":                                        {name: "paredit-closeAndNewline", args: {close: ']'}},
  "Alt-Up":                                       {name: "paredit-spliceSexpKill", args: {backward: true}},
  "Alt-Down":                                     {name: "paredit-spliceSexpKill", args: {backward: false}},
  "Ctrl-x `":                                     "gotoNextError",
  "Tab":                                          "paredit-indent",
  "Enter":                                        "paredit-newlineAndIndent",
  "(": {name: "paredit-openList", args: {open: "(", close: ")"}},
  "[": {name: "paredit-openList", args: {open: "[", close: "]"}},
  "{": {name: "paredit-openList", args: {open: "{", close: "}"}},
  "\"": {name: "paredit-openList", args: {open: "\"", close: "\""}},
  "Backspace": {name: "paredit-delete", args: {backward: true}},
  "Ctrl-d|delete": {name: "paredit-delete", args: {backward: false}}
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// paredit commands
// -=-=-=-=-=-=-=-=-

var commands = [
 "splitSexp","spliceSexp","wrapAround","closeAndNewline","barfSexp","slurpSexp",
 "killSexp","indent","spliceSexpKill","newlineAndIndent","openList", "delete"
].map(function(name) {
  return {
     name: 'paredit-' + name,
     exec: function(ed, args) {
       ed.session.getMode().getCodeNavigator()[name](ed, args);
     }
  }
});


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// paredit aware mode
// -=-=-=-=-=-=-=-=-=-

var ModeMixin = {

  "$ext.lang.paredit.modeMixin": true,

  keyhandler: null,

  getKeyhandler: function() {
    if (!this.keyhandler)
      this.keyhandler = new pareditAce.KeyHandler();
    return this.keyhandler;
  },

  attachToEditor: function(ed) {
    // keyboard / command setup
    ed.keyBinding.addKeyboardHandler(this.getKeyhandler());
    var cmds = pareditAce.commands.reduce(function(cmds, ea) {
      cmds[ea.name] = ea; return cmds; }, {})
    ed.commands.addCommands(cmds);
    ed.session.setUndoSelect(false);
    
    // unsinstall on mode change
    ed.once("changeMode", this.detach.bind(this, ed));

    // react to changes
    if (!ed.session["ext.lang.pareedit.onDocChange"]) {
      ed.session["ext.lang.pareedit.onDocChange"] = function(evt) {
        onDocumentChangeUpdatePareditState({editor: ed, data: evt.data});
      }
      ed.session.on('change', ed.session["ext.lang.pareedit.onDocChange"]);
    }

    // update state now
    onDocumentChangeUpdatePareditState({editor: ed, data: null});
  },

  detach: function(ed) {
    if (ed.session.getMode().$id === this.$id) return;
    ed.session.on('change', ed.session["ext.lang.pareedit.onDocChange"]);
    ed.keyBinding.removeKeyboardHandler(this.getKeyhandler());
  },

  getCodeNavigator: function() {
    return pareditAce.CodeNavigator;
  }

};


// event handler for doc changes that ensures paredit parse state is in synch
// with the session's document

function onDocumentChangeUpdatePareditState(evt) {

  if (!isActiveFor(evt && evt.editor && evt.editor.session.getMode())) return;

  var ed = evt.editor,
      src = ed.getValue(),
      ast;

  try {
      ast = ed.session.$ast = parse(src);
  } catch(e) { ast = ed.session.$ast = e; }

  var marker = ace.ext.lang.codemarker.ensureIn(ed.session);
  // marker.modeId = this.targetMode;
  ast && highlightErrors(ed, ast, marker);
  marker.redraw(ed.session);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function highlightErrors(ed, ast, codeMarker) {
    var oldErrors = codeMarker.markerRanges.filter(function(ea) {
      return ea.cssClassName === "ace-syntax-error"; });
    codeMarker.markerRanges.length = 0;
  
    if (ast.errors && ast.errors.length && ed.getOption("ext.lang.paredit.showErrors")) {
        var errMarkers = ast.errors.map(function(err) {
          return {
            cssClassName: "ace-syntax-error",
            loc: ed.session.doc.indexToPosition(err.end),
            pos: err.end,
            raisedAt: err.start
          }
        })
        codeMarker.markerRanges.push(errMarkers[0]);
        // codeEditor.setStatusMessage("Parse error: " + ast.errors[0].error)
    } else if (oldErrors.length) {
        // codeEditor.setStatusMessage("Errors fixed!");
    }
  }

  function parse(src) {
    var options = {};
    return paredit.parse(src, {addSourceForLeafs: true});
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// editor helpers
// -=-=-=-=-=-=-=-

function undoStackSize(ed) {
  return ed.session.getUndoManager().$undoStack.length;
}

function mergeLast2Undos(ed) {
  var uMgr = ed.session.getUndoManager()
  if (uMgr.$undoStack.length >= 2) {
    uMgr.dirtyCounter--;
    var u1 = uMgr.$undoStack.pop();
    var u2 = uMgr.$undoStack[uMgr.$undoStack.length-1];
    var deltas = u1.reduce(function(delta, undo) {
      return delta.concat(undo.deltas); }, []);
    paredit.util.last(u2).deltas = paredit.util.last(u2).deltas.concat(deltas);
  }
}

function applyPareditChanges(ed, changes, newIndex, indent) {
  // ed: ace editor instance
  // changes:  alist of insert/remove instructions generated by
  //           paredit.editor
  // newIndex: where to put the cursor after applying the changes
  if (!changes || !changes.length) return;

  var nUndos = undoStackSize(ed);
  changes.forEach(function(ea) {
    var type = ea[0];
    if (type === 'insert') {
      ed.session.insert(
        ed.session.doc.indexToPosition(ea[1]), ea[2]);
    } else if (type === 'remove') {
      ed.session.remove({
        start: ed.session.doc.indexToPosition(ea[1]),
        end: ed.session.doc.indexToPosition(ea[1]+ea[2])
      });
    }
  });

  if (newIndex)
    ed.moveCursorToPosition(
      ed.session.doc.indexToPosition(newIndex));

  if (!indent) ed.session.markUndoGroup();
  else {
    ed.session.$ast = paredit.parse(ed.getValue(), {addSourceForLeafs: true});
    var indentStart = typeof indent === "object" ?
          indent.start : changes[0][1],
        indentEnd = typeof indent === "object" ?
          indent.end : changes[changes.length-1][1];
    ace.ext.lang.paredit.CodeNavigator.indent(ed,
      {from: indentStart, to: indentEnd})
    if (undoStackSize(ed) - nUndos >= 2)
      mergeLast2Undos(ed);
  }

}

load();

})(window.ace, window.paredit);
