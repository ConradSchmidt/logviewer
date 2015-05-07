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
        for (pos++; pos < $scope.lines.length; pos++) {
            if ($scope.lines[pos].content.toLowerCase().indexOf($scope.searchTerm.toLowerCase()) != -1) {
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
        path = path.split('/')[path.split('/').length - 1];
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
                highlighting: function() {
                    return $scope.highlighting;
                }
            }
        });

        var updateSettings = function(highlighting) {
            processVersion++;
        }

        // when dilog close, reload file to apply styling
        modal.result.then(updateSettings, updateSettings);
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

                        // if autoScan, scan the whole log
                        if ($scope.autoScan) {
                            applyHighlighting($scope.lines);
                        }

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
                    });
                } else {
                    // clear the lines
                    $scope.clear();
                    // clear and start a new file-exists-interval
                    clearInterval(existsInt);
                    existsInt = setInterval(function() {
                        if ($scope.file) {
                            fs.exists($scope.file, function(exists) {
                                // file was created again, load it
                                if (exists) {
                                    $scope.reload();
                                }
                            });
                        }
                    }, 1000);
                }
            });
        }
    }

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
                // scrolled to the bottom
                $scope.tail = true;
            } else if ($scope.tail) {
                // scrolled up from the bottom and tailing was off
                $scope.tail = false;
                // to release the tailing, some scrolling help is needed
                $('body').scrollTop($('body').scrollTop() - lineHeight * 3);
            }
            $scope.$apply();
        }
    });

    // on resize recalculate the line count
    $(window).on('resize', function(event) {
        count = Math.floor($('body').height() / lineHeight);
    });

    // get the spacers
    var spacer = {
        upper: $('#upperSpacer'),
        lower: $('#lowerSpacer')
    };
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
            // apply the highlighting on the visible lines
            applyHighlighting($scope.visLines);
        }

        // if tail, scroll to the bottom
        if ($scope.tail) {
            $scope.$apply();
            document.body.scrollTop = document.body.scrollHeight;
        }

        // apply all changes
        // $scope.$apply();
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

    // indicates auto scan
    $scope.autoScan = false;

    // toggles auto scan log
    $scope.scanLogToggle = function() {
        $scope.autoScan = !$scope.autoScan;
        if ($scope.autoScan) {
            $scope.reload();
        }
    }

    // list of notification based on the watch attribute in highlighting
    $scope.notifications = [];

    // clear all notifications
    $scope.clearNotifications = function() {
        $scope.notifications = [];
        update();

        processVersion++;
    }

    // show the list of notifications
    $scope.showNotification = function() {
        // sort newest notification to top
        $scope.notifications.sort(function(a, b) {
            return b.line - a.line;
        });

        var modal = $modal.open({
            templateUrl: 'notifications.html',
            size: 'lg',
            scope: $scope
        });
    }

    // list of hidden line rules
    $scope.hiddenLineRules = [];

    // adds a hiding line rule and opens the hiding dialog
    $scope.showHidingDialog = function() {
        if (this.notification) {
            $scope.hiddenLineRules.push({
                content: this.notification.content
            });
        }

        var modal = $modal.open({
            templateUrl: 'hiding.html',
            size: 'lg',
            scope: $scope
        });
    }

    // removes a hiding line rule
    $scope.removeHiding = function() {
        var index = $scope.hiddenLineRules.indexOf(this.line);
        $scope.hiddenLineRules.splice(index, 1);
    }

    // pattern for the hiding sequence
    var hidingPattern = '';
    // content which is to hide
    var hidingContent = null;

    // shows a dialog with the hidden lines
    $scope.showHiddenLines = function(line) {
        if(line && line.hidden && line.hidden.length > 0) {
            // creates a child scope for the modal
            var scope = $scope.$new(true);
            scope.line = line;

            var modal = $modal.open({
                templateUrl: 'hiddenline.html',
                size: 'lg',
                scope: scope
            });
        }
    }

    // function to generate a empty line
    var emptyLine = function(index) {
        return {
            index: index,
            content: '',
            version: processVersion - 1
        };
    }

    // function to convert plain text lines
    var prcoessLine = function(line, index) {
        index++;

        // if file is blank the array.push function will ignore it
        if (line.trim() == '') {
            return emptyLine(index);
        }

        // search for lines to hide
        for (var i = $scope.hiddenLineRules.length - 1; i >= 0; i--) {
            var hide = $scope.hiddenLineRules[i];
            if (line.indexOf(hide.content) != -1) {
                // activate sequential hiding
                hidingPattern = hide.pattern;
                // create the hiding line
                hidingContent = emptyLine(index);
                hidingContent.content = '.................................................'
                hidingContent.hidden = [ line ];

                return hidingContent;
            }
        }

        // search for a hiding sequence
        if (hidingPattern && hidingPattern != '') {
            if (RegExp(hidingPattern).test(line)) {
                // append the line to the hidden line
                hidingContent.hidden.push(line);
                return null
            } else {
                hidingPattern = null;
            }
        }

        // return the normal line
        return {
            index: index,
            content: line,
            version: processVersion - 1
        };
    }

    // version of applied highlighting rules
    var processVersion = 0;

    // apply highlighting on already processed lines
    var applyHighlighting = function(lines) {
        lines.forEach(function(line) {
            if (line.version < processVersion) {
                // apply all highlighting rules
                for (var i = 0; i < $scope.highlighting.length; i++) {
                    if (RegExp($scope.highlighting[i].pattern).test(line.content)) {
                        // check if a watch is defined
                        var watch = $scope.highlighting[i].watch;
                        if (watch && watch != '') {
                            $scope.notifications.push({
                                type: watch,
                                line: line.index,
                                content: line.content
                            });
                        }
                        // update line with highlighting settings
                        $.extend(line, $scope.highlighting[i]);
                        line.version = processVersion;
                        break;
                    }
                };
            }
        });
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
        $scope.tail = config.tail || true;
        $scope.highlighting = config.highlighting || [];
        $scope.hiddenLineRules = config.hiddenLineRules || [];

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
