# paredit.js

Editing [the language of gods](https://www.youtube.com/watch?v=5-OjTPj7K54)
civilized, even on the web.

## paredit?

Paredit allows structured navigation and editing of s-expressions.

Reference:

- [Emacs Wiki](http://emacswiki.org/emacs/ParEdit)
- [Ref card](http://pub.gajendra.net/src/paredit-refcard.pdf)

## This library

paredit.js allows general navigation and transformation of s-expressions,
independent of a specific editor implementation. Pluck it into your editor of
choice.

### What?

Yes, it's just an interface

- An s-expression reader that produces a Lisp AST
- A navigator that can be queried, e.g. for the start of the next expression
- An editor that transforms code / ASTs, e.g. for splitting an expression,
  deleting expressions, etc.
- The editor can also indent (ranges) of code

To see it in actual use, [try the demo](). It shows an integration of paredit
with the [ace editor](http://ace.c9.io/). [See the code of the example]() for
how to integrate it in an actual code editor.

## API

### reader

### navigator

### editor

# LICENSE

[MIT](https://github.com/rksm/paredit.js/blob/master/LICENSE)
