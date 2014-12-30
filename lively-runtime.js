lively.require("lively.lang.Runtime").toRun(function() {

  var r = lively.lang.Runtime;
  r.Registry.addProject(r.Registry.default(), {
    name: "paredit-js",
    rootDir: "/Users/robert/Lively/paredit-js",

    reloadAll: function(project, thenDo) {
      // var project = r.Registry.default().projects["paredit-js"];
      // project.reloadAll(project, function(err) { err ? show(err.stack || String(err)) : alertOK("reloaded!"); })
      var files = ["./index.js",
                   "./lib/reader.js",
                   "./lib/navigator.js",
                   "./tests/reader-test.js",
                   "./tests/navigator-test.js"
                   ];

      lively.lang.fun.composeAsync(
        function livelyDeps(n) {
          require("lively.MochaTests").toRun(function() {
            project.state = {lively: lively, window: {chai: window.chai, Immutable: null}};
            n();
          });
        },
        function immutable(n) {
          JSLoader.loadJs("https://cdnjs.cloudflare.com/ajax/libs/immutable/3.4.1/immutable.js");
          lively.lang.fun.waitFor(2000,
            function() { return !!window.Immutable; },
            function(err) {
              err && show("timeout loading Immutable!");
              project.state.window.Immutable = window.Immutable;
              n();
            });
        },
        function readFiles(n) {
          lively.lang.arr.mapAsyncSeries(files,
            function(fn,_,n) {
              lively.shell.cat(fn, {cwd: project.rootDir},
              function(err, c) { n(err, {name: fn, content: c}); });
            }, n);
        },
        function(fileContents, next) {
          lively.lang.arr.mapAsyncSeries(fileContents,
            function(ea,_,n) { r.Project.processChange(project, ea.name, ea.content, n); },
            next);
        },
        function(results, n) {
          window.paredit = project.state.paredit;
          n(null, results);
        }
      )(thenDo);
    },

    resources: {

      "code": {
        matches: /(lib\/.*|index)\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          var state = project.state;
          evalCode(change.newSource, state, change.resourceId);
    	  	whenHandled();
        }
      },

      "tests": {
        matches: /tests\/.*\.js$/,
        changeHandler: function(change, project, resource, whenHandled) {
          if (!project.state) {
            var msg = "cannot update runtime state for " + change.resourceId + "\n because the lib code wasn't loaded."
            show(msg); whenHandled(new Error(msg)); return;
          }
          lively.requires("lively.MochaTests").toRun(function() {
            evalCode(change.newSource, project.state, change.resourceId);
            // lively.MochaTests.runAll();
      	  	whenHandled();
          });
        }
      }
    }
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function evalCode(code, state, resourceName) {
    lively.lang.VM.runEval(code,
      {topLevelVarRecorder: state, context: state, sourceURL: resourceName},
      function(err, _result) {
    		err && show("error when updating the runtime for " + resourceName + "\n" + (err.stack || err));
    		!err && alertOK("updated");
    	});
  }
});
