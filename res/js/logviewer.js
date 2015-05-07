var logviewerApp = angular.module('logviewerApp', ['ui.bootstrap']);

// own directive for using the file dialog
// binds the file path to a model
logviewerApp.directive("filepath", [function() {
    return {
        scope: {
            filepath: "="
        },
        link: function(scope, element, attributes) {
            element.bind("change", function(changeEvent) {
                if (changeEvent.target.files[0]) {
                    scope.$apply(function() {
                        scope.filepath = changeEvent.target.files[0].path;
                    });
                }
            });
        }
    }
}]);

logviewerApp.controller('logviewerAppCtl', function($scope, $modal) {

    // all open file paths
    $scope.openFiles = new LogArray();

    // loaded lines
    $scope.lines = new LogArray();

    // visible lines
    $scope.visLines = new LogArray();

    // highlighting rules
    $scope.highlighting = [];

    // should the app scroll to the end
    $scope.tail = true;

    // current open file
    $scope.file = null;

    // current search term
    $scope.searchTerm = "";

    // indicates if the serachTerm was found
    $scope.searchRes = false;

    // serach position in $scope.lines
    var searchPosition;

    // searches in $scope.lines for the searchTerm
    $scope.search = function() {
        var pos = searchPosition !== -1 ? position : -1;
        for(pos++; pos < $scope.lines.length; pos++) {
            if($scope.lines[pos].content.indexOf($scope.searchTerm) != -1) {
                $scope.jumgToLine(pos + 1);
                $scope.searchRes = true;
                searchPosition = position;
                return;
            }
        }
        $scope.searchRes = false;
        
        // used for wrap search
        if (searchPosition != -1) {
            searchPosition = -1;
            $scope.search();
        }
    }

    // if the open file change reload content
    $scope.$watch('file', function(newValue, oldValue) {
        if ($scope.openFiles.indexOf(newValue) == -1) {
            $scope.openFiles.push(newValue);
        }
        $scope.reload();
    });

    // load new file
    $scope.openFile = function() {
        $scope.file = this.filename;
    }

    // function to format the path name
    // C:\\test\\test.lpg -> test.log
    $scope.formatPath = function(path) {
        path = path.split('\\')[path.split('\\').length - 1];
        path = path.split('//')[path.split('//').length - 1];
        return path;
    }

    // close the file and remove it from the list
    // load the next open file
    $scope.closeFile = function() {
        var index = $scope.openFiles.indexOf(this.filename);
        // find file
        $scope.openFiles.splice(index, index + 1);
        if (this.filename === $scope.file) {
            if ($scope.openFiles.length > 0) {
                $scope.file = $scope.openFiles[index > 0 ? index - 1 : 0];
            } else {
                $scope.file = null;
            }
        }
    }

    // open file dialog
    $scope.showFile = function() {
        $('#openFile input').click();
    }

    // show highlighting dialog
    $scope.showHighlighting = function() {
        var modal = $modal.open({
            templateUrl: 'highlighting.html',
            controller: 'highlightingCtl',
            size: 'lg',
            resolve: {
                highlighting: function () {
                  return $scope.highlighting;
                }
              }
        });

        // when dilog close, reload file to apply styling
        modal.result.then(function(highlighting) {
            update();
        }, function(highlighting) {
            update();
        });
    }

    // toggle the tail setting
    $scope.toggleTail = function() {
        $scope.tail = !$scope.tail;
        update();
    }

    // clear all lines
    $scope.clear = function() {
        $scope.lines = new LogArray();
        $scope.notifications = [];
        update();
    }

    // object which controls the file tailing
    var tailFile;

    // file exists interval, in case the file was removed
    var existsInt;

    // load file function
    $scope.reload = function() {
        $scope.clear();

        // if there is a tail, close it
        if (tailFile) {
            tailFile.unwatch();
        }
        // if there is a file-exists-interval, clear it
        if (existsInt) {
            clearInterval(existsInt);
        }

        // if a file is set
        if ($scope.file) {
            // check if the file exists
            fs.exists($scope.file, function(exists) {
                if (exists) {
                    // load the file
                    fs.readFile($scope.file, {
                        encoding: 'UTF8'
                    }, function(err, data) {
                        if (err) throw err;
                        // split the content on 'new line' and convert each line
                        $scope.lines = prcoessLines(data.split('\n'));
                        update();
                    });

                    // tail the file
                    tailFile = new Tail($scope.file);
                    tailFile.on('line', function(data) {
                        // convert each new line and push it to the loaded lines
                        $scope.lines.push(prcoessLine(data, $scope.lines.length));
                        update();
                    });

                    // if the file is removed, reload it to start the file-exists-interval
                    tailFile.on('error', function(error) {
                        if (error.code && error.code === 'ENOENT') {
                            $scope.reload();
                            return;
                        }
                        console.log('ERROR: ', error);
                    });
                } else {
                    // clear the lines
                    $scope.clear();
                    // start the file-exists-interval
                    existsInt = setInterval(function() {
                        fs.exists($scope.file, function(exists) {
                            // file was created again, load it
                            if (exists) {
                                $scope.reload();
                            }
                        });
                    }, 1000);
                }
            });
        }
    }

    // get the spacers
    var spacer = {
        upper : $('#upperSpacer'),
        lower : $('#lowerSpacer')
    };
    // line-height of 20px + 2px padding
    var lineHeight = 22;
    // get the inital count
    var count = Math.floor($('body').height() / lineHeight);
    
    // position in the log
    var position = 0;

    // on scroll remove the tail property
    $(window).on('scroll', function(event) {
        if ($scope.lines) {
            update();

            var lines = $scope.lines.length;
            if (position >= lines - count) {
                $scope.tail = true;
            } else {
                $scope.tail = false;
            }
            $scope.$apply();
        }        
    });

    // on resize recalculate the line count
    $(window).on('resize', function(event) {
        count = Math.floor($('body').height() / lineHeight);
    });

    // update the scope
    var update = function() {
        // if lines are loaded
        if ($scope.lines) {
            // get total lines
            var lines = $scope.lines.length;

            // calculate the postion in log
            position = Math.floor($('body').scrollTop() / lineHeight);
            // prevent overflow
            position = position > lines ? lines : position < 0 ? 0 : position;

            // set the spacers
            spacer.upper.height(position * lineHeight);
            spacer.lower.height((lines - count - position) * lineHeight);

            // get the visible lines
            $scope.visLines = $scope.lines.slice(position < 0 ? 0 : position, position + count);
        }

        // if tail is set, scroll to the bottom
        if ($scope.tail) {
            document.body.scrollTop = document.body.scrollHeight;
        }

        // apply all changes
        $scope.$apply();
    }

    // jumps to a given line
    $scope.jumgToLine = function(line) {
        if ($scope.lines) {
            // get total lines
            $scope.tail = false;
            var scrollTop = (line - 1) * lineHeight;
            $('body').scrollTop(scrollTop);
        }
    }

    $scope.notifications = [];

    $scope.showNotification = function() {
        var modal = $modal.open({
            templateUrl: 'notifications.html',
            size: 'lg',
            scope: $scope
        });
    }

    // function to convert plain text lines
    var prcoessLine = function(line, index) {
        index++;
        // if file is blank the array.push function will ignore it
        if (line.trim() == '') {
            return {index: index, content: ''};
        }

        // apply all highlighting rules
        for (var i = 0; i < $scope.highlighting.length; i++) {
            if (RegExp($scope.highlighting[i].pattern).test(line)) {
                if ($scope.highlighting[i].watch && $scope.highlighting[i].watch != '') {
                    $scope.notifications.push({type: $scope.highlighting[i].watch, line: index, content: line});
                }
                return $.extend({
                    index: index,
                    content: line
                }, $scope.highlighting[i]);
            }
        };

        return {
            index: index,
            content: line
        };
    }

    // wrapper function to process multiple lines
    var prcoessLines = function(lines) {
        var newLines = new LogArray();
        lines.forEach(function(line, i) {
            newLines.push(prcoessLine(line, i));
        });
        return newLines;
    }

    // function to load the config
    $scope.loadConfig = function(config) {
        $scope.tail = config.tail;
        $scope.highlighting = config.highlighting;

        for (prop in config.openFiles) {
            // ignore the length property
            if (prop !== 'length') {
                $scope.openFiles.push(config.openFiles[prop]);
                $scope.file = config.openFiles[0];
            }
        }
        $scope.reload();
    }
});