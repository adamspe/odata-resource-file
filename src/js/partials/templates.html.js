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
