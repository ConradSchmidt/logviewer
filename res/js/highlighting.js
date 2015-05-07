logviewerApp.controller('highlightingCtl', function($scope, $modal, $modalInstance, highlighting) {

    $scope.highlighting = highlighting;

    // add empty highlighting rule
    $scope.addRule = function() {
        $scope.highlighting.push({});
    }

    // remove highlighting rule
    $scope.removeRule = function() {
        var index = $scope.highlighting.indexOf(this.setting);
        $scope.highlighting.splice(index, 1);
    }

    // show the icon selection dialog
    $scope.showIcons = function(index) {
        var modal = $modal.open({
            templateUrl: 'icons.html',
            scope: $scope,
            size: 'lg'
        });

        // on icon selection set the icon to the rule
        var thiz = this;
        modal.result.then(function(icon) {
            thiz.setting.icon = icon;
        });
    }

    // function to close icon dialog and return the clicked icon
    $scope.setIcon = function(icon) {
        if (this.$close) {
            this.$close(icon);
        }
    }

    $scope.move = function(direction) {
        var index = $scope.highlighting.indexOf(this.setting);
        var swapIndex = index - direction;
        if(swapIndex >= 0 && swapIndex < $scope.highlighting.length) {
            var swap = $scope.highlighting[swapIndex];
            $scope.highlighting[swapIndex] = $scope.highlighting[index];
            $scope.highlighting[index] = swap;
        }
    }

});