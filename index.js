var Resource = require('odata-resource'),
    multer = require('multer'),
    debug = require('debug')('odata-resource-file'),
    File = require('./models/File');

function defaultConfig(config,resource){
    config = config||{};
    config.rel = config.rel||'/api/'+resource,
    config.tmp = config.tmp||'tmp/';
    return config;
}

function fileFromRequest(req) {
    return req.files && req.files.file && req.files.file.length ? req.files.file[0] : undefined;
}

module.exports = {
    /**
     * The File mongoose model.
     * @type {object}
     */
    File: File,
    /**
     * Factory function used to construct Img models.
     * @type {function}
     */
    img: function(){
        // this way Img and its dependencies are not needed unless this is called.
        return require('./models/Img').apply(this,arguments);
    },
    /**
     * Constructs and binds a "file" resource to an express app.
     * The input keys for config are:
     * rel - The path for the resource in question (e.g. /api/file).  This gets passed into resource construction.
     * tmp - The path to where the app will store temporary files during upload.
     *
     * @param  {object} config The config input.
     * @param  {object} app    The express app.
     * @return {object}        The file resource.
     */
    fileResource: function(config,app) {
        config = defaultConfig(config,'file');
        var file = new Resource({
                rel: config.rel,
                model: File
            });
        file.$multer_up = multer({dest: config.tmp}).fields([
              { name: 'metadata', maxCount: 1 },
              { name: 'file', maxCount: 1 }
            ]);
        //.single('file');
        // POST/PUT are not normal JSON but instead multipart/form-data (file).
        app.post(file.getRel(),file.$multer_up);
        app.put(file.getRel()+'/:id',file.$multer_up);

        // over-ride pretty much everything to work over GridFs rather than a mongoose model
        file.create = function(req,res) {
            var self = this,
                metadata = req.body.metadata,
                file = fileFromRequest(req)
            if(metadata && typeof(metadata) === 'string') {
                metadata = JSON.parse(metadata);
            }
            file.cleanup=true;
            file.metadata = metadata;
            File.storeFile(req._resourceId,file,function(err,f){
                if(err) {
                    return Resource.sendError(res,500,'create failure',err);
                }
                req._resourceId = f._id;
                self.findById(req,res);
            });
        };
        file.update = (function(superFunc){
            return function(req,res) {
                var self = this,
                    metadata = req.body.metadata,
                    file = fileFromRequest(req);
                if(file) { // over-write
                    return self.create.apply(this,arguments);
                }
                // o/w only metadata update
                if(metadata && typeof(metadata) === 'string') {
                    metadata =  JSON.parse(metadata);
                }
                if(!metadata) {
                    return Resource.sendError(res,400,'bad request',err);
                }
                // don't accept any other types of changes, ignore anything else in there.
                req.body = {
                    metadata: metadata
                }
                superFunc.apply(this,arguments);
            };
        })(file.update);

        // :filename is really just to make it nicer for browsers so they have an extension
        file.instanceLink('download/:filename',function(req,res){
            debug('download %s, filename %s',req._resourceId,req._resourceFilename);
            this.getModel().findById(req._resourceId).exec(function(err,obj){
                if(err || !obj) {
                    Resource.sendError(res,404,'not found',err);
                } else {
                    debug('download from object',obj);
                    res.contentType(obj.get('contentType'));
                    obj.getReadStream()
                       .on('error',function(err) {
                            console.error(err);
                            Resource.sendError(res,500,'Streaming error.',err);
                        }).pipe(res);
                }
            });
        });
        // make download links instance specific
        file.getMapper = (function(self,superFunc){
            return function(postMapper) {
                var mapper = superFunc.apply(self,arguments);
                return function(o,i,arr) {
                    var o = mapper(o,i,arr);
                    delete o._links['download/:filename'];
                    o._links['download'] = self.getRel()+'/'+o._id+'/download/'+o.filename;
                    return o;
                }
            };
        })(file,file.getMapper);
        // manually init the file router so we can handle the special filename parameter for downloads.
        var fileRouter = file.initRouter(app);
        fileRouter.param('filename',function(req,res,next,filename){
            req._resourceFilename = filename;
            next();
        });
        return file;
    },
    /**
     * Constructs and binds a "img" resource to an express app.  An "img" resource requires a
     * "file" resource (see fileResource).
     *
     * The input keys for config are:
     * rel - The path for the resource in question (e.g. /api/file).  This gets passed into resource construction.
     * model - The mongoose model for the Img implementation.
     *
     * @param  {object} config The config input.
     * @param  {object} file   The file resource (from the fileResource function).
     * @param  {object} app    The express app.
     * @return {object}        The img resource.
     */
    imgResource: function(config,file,app) {
        config = defaultConfig(config,'img');
        var img = new Resource({
            rel: config.rel,
            model: config.model,
            update: false
        });
        // formats is a list of file resources
        img.getMapper = (function(self,superFunc){
            var model = self.getModel();
            return function(postMapper) {
                var mapper = superFunc.apply(self,arguments);
                return function(o,i,arr) {
                    var i = mapper(o,i,arr),fileMapper;
                    if(i.formats && i.formats.length) {
                        fileMapper = file.getMapper();
                        i.formats = i.formats.map(function(f,j,farr){
                            var formatFileName = f.format === 'original' ?
                                i.fileName :
                                model.fileNameFormat(i.fileName,f.format);
                            f.file = fileMapper({
                                            _id: f.file,
                                            filename: formatFileName,
                                            contentType: i.contentType
                                        });
                            // add convenience links
                            o._links[f.format] = f.file._links.download;
                            return f;
                        });
                    }
                    return o;
                };
            };
        })(img,img.getMapper);

        // custom create
        img.create = (function(self){
            return function(req,res){
                var file = fileFromRequest(req);
                file.cleanup=true;
                self.getModel().newImage(file,function(err,img){
                    if(err) {
                        return Resource.sendError(res,500,'create failure',err);
                    }
                    req._resourceId = img._id;
                    self.findById(req,res);
                });
            };
        })(img);
        // create/post takes multi-part form data.
        app.post(img.getRel(),file.$multer_up);
        img.initRouter(app);
        return img;
    }
};
