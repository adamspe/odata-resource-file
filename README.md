# odata-resource-file
npm module utility built on odata-resource for storing files in mongo.

Contains:
- A mongoose model for storing files.
- A utility function for creating an odata-resource resource for handling files via REST.
- A utility function for constructing "Image" models which wrap the File model.
- A utility function for creating odata-resource/s for handling "images" via REST.

The image model is a wrapper around the File model (since an image is just a file) but adds basic support for creating "formatted" images which are versions of the original run through a configured set of lwip conversions.

##Dependencies

Some dependencies are indirect since the assumption here is that the application in question is already importing versions of them.  The following dependencies must be resolved outside of this module.

- `odata-resource` - It's assumed this module is in use for other resources already.
- `express` - obviously.
- `mongoose` - obviously.

##Example Usage

```
var app = require('express')(),
    mongoose = require('mongoose'),
    odataFile = require('odata-resource-file');

app.use(require('body-parser').json());

app.get('/', function (req, res) {
  res.send('odata-resource-file test server');
});

// create a REST resource bound to /api/file for interacting with files.
var file = odataFile.fileResource({
        rel: '/api/file',
        tmp: 'tmp/'
    },app),
// create a mongoose model for storing images with multiple "formats"
    ImgImpl = odataFile.img(({
        collection: 'Images', // the mongo collection to store my images in (default Images).
        formats:[{
            format: 'thumbnail',
            transformations:[{
                fn: 'cover',
                args: [200,200]
            }]
        },{
            format: 'weird',
            transformations:[{
                fn: 'scale', args: [0.5]
            },{
                fn: 'rotate', args: [45, 'white']
            },{
                fn: 'crop', args: [200,200]
            },{
                fn: 'blur', args: [1]
            }]
        }]
    })),
// create a REST resource bound to /api/img for interacting with ImgImpl
    img = odataFile.imgResource({
        rel: '/api/img',
        model: ImgImpl
    },file,app);
```
