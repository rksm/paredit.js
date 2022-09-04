# Changelog

Trying to uphold semver. No guarantees though.

## 0.4.0
### Changes
- Move cursor left upon backspace on closing parens on listy expressions: (())| -> (()|)
- Fix 'Uncaught ReferenceError' for undeclared variables
- Fix type declarations
  - Breaking change: use null as falsey return type everywhere

## 0.3.6
### Changes
- Fix readNumber for decimals and negatives

## 0.3.5
### Changes
- Create error if string ends without closing quote

## 0.3.4
### Changes
- transpose works when cursor is inside of leaf sexps.
### Added
- Add typescript declaration file

## 0.3.3
### Added
- exports paredit.walk in index.js

## 0.3.2
### Changes
- fix: Node.js checks are wrong under Rollup

## 0.3.1
### Changed
- remove forgotten debugger

## 0.3.0
### Changed
- indentation of sexp structures with parse errors (see https://github.com/rksm/paredit.js/issues/12)
