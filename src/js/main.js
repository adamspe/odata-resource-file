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
                console.log('$attrs.fileResource',resource);
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
.directive('imgControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/image-control.html',
        scope: {
            callerResource: '=imageResource',
            image: '=',
            format: '@imageFormat'
        },
        link: function($scope) {
            $scope.theImage = undefined;
            $scope.onUpload = function(i) {
                $log.debug('imgControl.onUpload',i);
                $scope.theImage = i;
            };
            $scope.$watch('image',$scope.onUpload);
            $scope.remove = function() {
                $scope.theImage.$remove({'id':$scope.theImage._id},function(){
                    $scope.theImage = undefined;
                });
            };
        }
    };
}]);
