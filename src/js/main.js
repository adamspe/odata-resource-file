angular.module('odata-resource-file',[
    'templates-odata-resource-file',
    'ngResource'
])
.provider('$fileResource',[function(){
    this.$get = ['$log','$resource','$http',function($log,$resource,$http){
        return function(path) {
            function uploadTxfRequest(data,headers) {
                $log.debug('$fileResource.transformRequest',data,headers);
                var metadata = data.metadata,
                    file = data.file,
                    fd = new FormData();
                if(metadata) {
                    fd.append('metadata',JSON.stringify(metadata));
                }
                if(file) {
                    fd.append('file',file);
                }
                return fd;
            }
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
                    transformRequest: uploadTxfRequest,
                    headers: {
                        'Content-Type': undefined
                    }
                },
                update: {
                    method: 'PUT',
                    transformRequest: uploadTxfRequest,
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
