![](http://robert.kra.hn/images/paredit-logo.jpg)

Editing [the language of gods](https://www.youtube.com/watch?v=5-OjTPj7K54)
civilized, even on the web.

For more details see the project page [here](http://robert.kra.hn/projects/paredit-js).

## Usage

`npm install` then see examples.


## Dev

### build

Update `paredit-bundle.min.js` and `paredit-bundle.js`:

```shell
node build.js
```

### Testing

Manually: You can open [examples/paredit.html](examples/paredit.html) in a browser (directly the file, no need to use a http server). Build before you do that.

Unit tests: `npm run test`

### With Lively

Load via lively.modules:

```js
await load();

async function load() {
  var lm = lively.modules,
      files = ["./index.js",
               './lib/util.js',
               "./lib/reader.js",
               "./lib/navigator.js",
               "./lib/editor.js",
               // "./tests/reader-test.js",
               // "./tests/navigator-test.js",
               // "./tests/editor-test.js"
              ],
      p = lm.getPackage("paredit.js");
  for (let f of files) await lm.module(lively.lang.string.joinPath(p.url, f)).reload();
}
```
