// dependencies
var fs = require('fs');
var gui = require('nw.gui');
Tail = require('tail').Tail;

// window actions
var win = gui.Window.get();

var params = gui.App.argv;
if (params.indexOf('--maximize') != -1) {
    win.maximize();
}

// on load, load settings
win.on('loaded', function() {
    // load settings
    fs.readFile('config.json', {
        encoding: 'UTF8'
    }, function(err, data) {
        if (err) throw err;
        var config = JSON.parse(data);

        // find the app controller
        var scope = angular.element($(document.body)).scope().$$childTail;
        scope.loadConfig(config);
    });
});
// on close, save settings
win.on('close', function() {
    // find the app controller
    var scope = angular.element($(document.body)).scope().$$childTail;
    if (scope) {
        var config = JSON.stringify({
            openFiles: scope.openFiles,
            highlighting: scope.highlighting,
            tail: scope.tail,
            hiddenLineRules: scope.hiddenLineRules
        });
        fs.writeFile('config.json', config);
    }
    this.close(true);
});

// custom array to avoid null values in the array
function LogArray() {}
LogArray.prototype = new Array();
LogArray.prototype.push = function(_super) {
    return function(obj) {
        // only if the object is set
        if (obj) {
            return _super.apply(this, arguments);
        }
        return this.length;
    }
}(LogArray.prototype.push);
