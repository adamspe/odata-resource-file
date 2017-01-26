var mongoose = require('mongoose'),
    schema = mongoose.Schema({
        fileName: { type: String, trim: true, required: true},
        contentType: { type: String, trim: true},
        formats: [{
                    format: {type: String, required: true, default: 'original'},
                    file: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'File' }
                }]
    }),
    File = require('./File'),
    q = require('q'),
    lwip = require('lwip'),
    debug = require('debug')('odata-resource-file');

module.exports = function(config) {
    config = config||{};
    config.collection = config.collection||'Image';

    schema.set('collection', config.collection);

    function removeFile(fid) {
        var def = q.defer();
        debug('removeFile',fid);
        File.findById(fid).exec(function(err,obj){
            if(err || !obj) {
                return def.reject(err);
            }
            debug('removing file %s/%s',obj._id,obj.filename);
            obj.remove(function(err,obj){
                if(err) {
                    return def.reject(err);
                }
                debug('removed file %s/%s',obj._id,obj.filename);
                def.resolve(obj);
            });
        });
        return def.promise;
    }

    function cleanupImg(img){
        debug('cleanupImg',img);
        q.all(img.formats.map(function(f){
            return removeFile(f.file);
        })).done(function(values) {
            debug('remove results',values.map(function(f){ return f._id; }));
        });
    }

    function formatImg(original,format) {
        var def = q.defer(),
            partsRegex = /^([^\.]+)\.(.*)$/,
            fileName = original.get('filename'),
            prefix = fileName.replace(partsRegex,'$1'),
            extension = fileName.replace(partsRegex,'$2'),
            type = extension.toLowerCase(),
            imgBuffers = [];
        original.getReadStream()
            .on('data',function(buffer){
                imgBuffers.push(buffer);
            })
            .on('end',function(){
                lwip.open(Buffer.concat(imgBuffers),type,function(err,image){
                    if(err) {
                        return def.reject(err);
                    }
                    var batch = image.batch();
                    format.transformations.forEach(function(txf){
                        debug('applying trasnformation',txf);
                        batch = batch[txf.fn].apply(batch,txf.args);
                    });
                    debug('writing %s to buffer with type %s',format.format,type);
                    batch.toBuffer(type,function(err,buffer){
                        if(err) {
                            return def.reject(err);
                        }
                        def.resolve({
                            format: format.format,
                            file: {
                                filename: prefix+'_'+format.format+'.'+extension,
                                mimetype: original.contentType,
                                data: buffer
                            }
                        });
                    });
                });
            });

        return def.promise;
    }

    schema.pre('save',function(next){
        var thisImg = this;
        function handleErr(msg,err) {
            cleanupImg(thisImg);
            debug('error: %s',msg,err);
            return next(err);
        }
        var originals = this.formats.filter(function(f){
            return f.format === 'original';
        }),
        original = originals.length ? originals[0] : undefined;
        if(!original){
            return handleErr('no original',new Error('original not defined'));
        }
        if(!config.formats) {
            debug('saving image %s (original only)', this._id);
            return next();
        }
        // https://www.npmjs.com/package/lwip
        File.findById(original.file).exec(function(err,obj){
            if(err) {
                return handleErr('error finding original',err);
            }
            q.all(config.formats.map(function(format){
                return formatImg(obj,format);
            })).then(function(translated){
                debug('translated',translated);
                q.all(translated.map(function(tx){
                    var def = q.defer();
                    File.storeData(null,tx.file,function(err,f){
                        if(err) {
                            console.error(err);
                            return def.reject(err);
                        }
                        def.resolve(f);
                    });
                    return def.promise;
                })).then(function(files){
                    translated.forEach(function(format,i){
                        thisImg.formats.push({
                            format: format.format,
                            file: files[i]
                        });
                    });
                    next();
                },next);
            },next);
        });
    });

    schema.post('remove',cleanupImg);

    var ImageModel = mongoose.model('Image',schema);

    /**
     * static utility function for creating a unique file name
     * for a given format.
     *
     * @param {string} original The original file name.
     * @param {string} format The name of the format.
     * @returns {string} A new filename with the format inserted.
     */
    ImageModel.fileNameFormat = function(original,format){
        var partsRegex = /^([^\.]+)\.(.*)$/;
        return original.replace(partsRegex,'$1')+
                '_'+format+'.'+
                original.replace(partsRegex,'$2');
    };

    /**
     * static utility function for creating a new Image.
     *
     * @param  {object}   file multer input.
     * @param  {Function} callback     function(err,image)
     */
    ImageModel.newImage = function(file,callback) {
        File.storeFile(undefined,file,function(err,f){
            if(err) {
                return Resource.sendError(res,500,'create failure',err);
            }
            (new ImageModel({
                fileName: f.filename,
                contentType: f.contentType,
                formats: [{file: f._id}]
            })).save(function(err,img){
                if(err) {
                    f.remove(/* best effort at cleanup */);
                    return callback(err);
                }
                callback(null,img);
            });
        });
    };

    return ImageModel;
};
