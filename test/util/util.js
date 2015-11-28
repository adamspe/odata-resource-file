var app = require('express')(),
    mongoose = require('mongoose'),
    odataFile = require('../../index');

app.use(require('body-parser').json());

app.get('/', function (req, res) {
  res.send('odata-resource-file test server');
});

var file = odataFile.fileResource({
        rel: '/api/file',
        tmp: 'tmp/'
    },app),
    ImgImpl = odataFile.img(({
        formats:[{
            format: 'thumbnail',
            transformations:[{
                fn: 'cover',
                args: [200,200]
            }]
        }/*,{
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
        }*/]
    })),
    img = odataFile.imgResource({
        rel: '/api/img',
        model: ImgImpl
    },file,app);

var util = {
    File: odataFile.File,
    Img: ImgImpl,
    debug: require('debug')('odata-resource-file'),
    api: require('supertest').agent(app),
    before: function(done) {
        mongoose.connect('mongodb://localhost:27017/odata-resource-file-test',function(err){
            if(err) {
                throw err;
            }
            done();
        });
    },
    after: function(done) {
        mongoose.disconnect();
        done();
    }
}

module.exports = util;