var pkg = JSON.parse(require("fs").readFileSync("package.json"));
var target = "paredit-bundle.js";
require('concat')(pkg.bundle.files, target, function(e) {
require("fs").writeFile(
  target.replace(/\.js$/,".min.js"),
  require("uglify-js").minify(target).code)});
