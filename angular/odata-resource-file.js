/*
 * odata-resource-file
 * Version: 0.1.0 - 2016-03-13
 */

angular.module('odata-resource-file',[
    'templates-odata-resource-file',
    'ngResource'
])
.provider('$fileResource',[function(){
    this.$get = ['$log','$resource','$http',function($log,$resource,$http){
        return function(path) {
            var BaseCls = $resource(path,{},{
                get: {
                    method: 'GET'
                },
                query: {
                    method: 'GET',
                    isArray: false
                },
                save: {
                    method: 'POST',
                    transformRequest: function(data,headers) {
                        $log.debug('$fileResource.transformRequest',data,headers);
                        var file = data.file,
                            fd = new FormData();
                        headers = { 'Content-Type': undefined };
                        fd.append('file',file);
                        return fd;
                    },
                    headers: {
                        'Content-Type': undefined
                    }
                }
            });
            return BaseCls;
        };
    }];
}])
.directive('fileModel',['$log','$parse','$injector',function($log,$parse,$injector){
    return {
        restrict: 'A',
        link: function($scope,$element,$attrs) {
            var model = $parse($attrs.fileModel),
                modelSetter = model.assign;
            function listenForChange(ImageResource) {
                $log.debug('fileModel.listenForChange.ImageResource',ImageResource);
                $element.unbind('change');
                $element.bind('change',function(){
                    $scope.$apply(function(){
                        var f = $element[0].files[0],
                            o = ImageResource ? new ImageResource({file: f}) : f;
                        $log.debug('file changed to',f,o);
                        modelSetter($scope,o);
                    });
                });
            }
            $attrs.$observe('fileResource',function(fileResource){
                var resource = $attrs.fileResource ? $parse($attrs.fileResource)($scope) : undefined;
                $log.debug('$attrs.fileResource',resource);
                if(typeof(resource) === 'string') {
                    $injector.invoke([resource,listenForChange]);
                } else {
                    listenForChange(resource);
                }
            });
        }
    };
}])
.directive('imgDisplay',[function(){
    return {
        restrict: 'E',
        template: '<img ng-src="{{image._links[format]}}" />',
        scope: {
            image: '=',
            format: '@imageFormat'
        }
    };
}])
.directive('imgUpload',['$log',function($log){
    return {
        restrict: 'E',
        template: '<input type="file" file-model="imageToUpload" file-resource="callerResource" />',
        scope: {
            callerResource: '=imageResource',
            onUpload: '&'
        },
        link: function($scope) {
            $scope.$watch('imageToUpload',function(){
                $log.debug('imageToUpload',$scope.imageToUpload);
                if($scope.imageToUpload) {
                    if(!$scope.imageToUpload.$save) {
                        $log.debug('received non resource file change (missing image-resource)',$scope.imageToUpload);
                    } else {
                        $scope.imageToUpload.$save(function(i) {
                            $log.debug('uploaded',i);
                            $scope.onUpload({image: i});
                        });
                    }
                }
            });
        }
    };
}])
.directive('imgControl',['$log','$parse',function($log,$parse){
    return {
        restrict: 'E',
        templateUrl: 'js/image-control.html',
        scope: {
            callerResource: '=imageResource',
            format: '@imageFormat'
        },
        link: function($scope,$element,$attrs) {
            var $model;
            $scope.theImage = undefined;
            $scope.onUpload = function(i) {
                $log.debug('imgControl.onUpload',i);
                $scope.theImage = i;
                if($model) {
                    $model.assign($scope.$parent,i);
                }
            };
            $scope.remove = function() {
                $scope.theImage.$remove({'id':$scope.theImage._id},function(){
                    $scope.theImage = undefined;
                    if($model) {
                        $model.assign($scope.$parent,undefined);
                    }
                });
            };
            $attrs.$observe('image',function(newValue) {
                $log.debug('$observe.image',newValue);
                $model = $parse(newValue);
                $scope.theImage = $model($scope.$parent);
            });
        }
    };
}]);

angular.module('templates-odata-resource-file', ['js/image-control.html']);

angular.module("js/image-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/image-control.html",
    "<div class=\"image-control\">\n" +
    "    <div class=\"image-display\" ng-if=\"theImage\">\n" +
    "        <a href class=\"image-remove\" ng-click=\"remove()\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "        <img-display image=\"theImage\" image-format=\"{{format}}\"></img-display>\n" +
    "    </div>\n" +
    "    <div class=\"image-upload\">\n" +
    "        <img-upload ng-if=\"!theImage\" image-resource=\"callerResource\" on-upload=\"onUpload(image)\"></img-upload>\n" +
    "    </div>\n" +
    "</div>");
}]);
