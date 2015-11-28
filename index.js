var Resource = require('odata-resource'),
    multer = require('multer'),
    fs = require('fs'),
    debug = require('debug')('odata-resource-file'),
    File = require('models/File'),
    Img = require('models/Img');

function defaultConfig(config,resource){
    config = config||{};
    config.rel = config.rel||'/api/'+resource,
    config.tmp = config.tmp||'tmp/';
    return config;
}

function fileUpload(self,superFunc) {
    return function(req,res) {
        debug('files',req.file);
        req.body = {
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            data: fs.readFileSync(req.file.path)
        };
        res.on('finish',function(){
            debug('resonse sent deleting',req.file.path);
            fs.unlink(req.file.path);
        });
        superFunc.apply(self,arguments);
    };
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
    img: Img,
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
                model: File,
                $select: '-data'
            });
        file.$multer_up = multer({dest: config.tmp}).single('file');
        // POST/PUT are not normal JSON but instead multipart/form-data (file).
        app.post(file.getRel(),file.$multer_up);
        app.put(file.getRel()+'/:id',file.$multer_up);

        file.create = fileUpload(file,file.create);
        file.update = fileUpload(file,file.update);

        // :filename is really just to make it nicer for browsers so they have an extension
        file.instanceLink('download/:filename',function(req,res){
            debug('download %s, filename %s',req._resourceId,req._resourceFilename);
            this.getModel().findById(req._resourceId).exec(function(err,obj){
                if(err || !obj) {
                    Resource.sendError(res,404,'not found',err);
                } else {
                    res.contentType(obj.contentType);
                    res.send(obj.data);
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
                    o._links['download'] = self.getRel()+'/'+o._id+'/download/'+o.fileName;
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
            update: false,
            populate: {path: 'formats.file', select: 'fileName contentType'}
        });
        // formats is a list of file resources
        img.getMapper = (function(self,superFunc){
            return function(postMapper) {
                var mapper = superFunc.apply(self,arguments);
                return function(o,i,arr) {
                    var i = mapper(o,i,arr),fileMapper;
                    if(i.formats && i.formats.length) {
                        fileMapper = file.getMapper();
                        i.formats = i.formats.map(function(f,j,farr){
                            f.file = fileMapper(f.file);
                            // add convenience links
                            o._links[f.format] = f.file._links.download;
                            return f;
                        });
                    }
                    return o;
                };
            };
        })(img,img.getMapper);
        // over-ride create to use the convenience wrapper
        img.create = (function(self){
            return function(req,res){
                self.getModel().newImage(req.body,function(err,img){
                    if(err) {
                        return Resource.sendError(res,500,'create failure',err);
                    }
                    req._resourceId = img._id;
                    self.findById(req,res);
                });
            };
        })(img);
        // then over-ride wrap that with fileUpload
        app.post(img.getRel(),file.$multer_up);
        img.create = fileUpload(img,img.create);
        img.initRouter(app);
        return img;
    }
};