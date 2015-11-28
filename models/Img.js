var mongoose = require('mongoose'),
    schema = mongoose.Schema({
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
            debug('removing file %s/%s',obj._id,obj.fileName);
            obj.remove(function(err,obj){
                if(err) {
                    return def.reject(err);
                }
                debug('removed file %s/%s',obj._id,obj.fileName);
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
            prefix = original.fileName.replace(partsRegex,'$1'),
            extension = original.fileName.replace(partsRegex,'$2'),
            type = extension.toLowerCase();
        lwip.open(original.data,type,function(err,image){
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
                        fileName: prefix+'_'+format.format+'.'+extension,
                        contentType: original.contentType,
                        data: buffer
                    }
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
            })).done(function(translated){
                debug('translated',translated);
                // TODO error checking?
                // store the translated formats
                File.create(translated.map(function(tx){
                    return tx.file;
                }),function(err,created){
                    if(err) {
                        return handleErr('error storing formatted files',err);
                    }
                    // add the formats to thisImg before its saved.
                    translated.forEach(function(format,i){
                        thisImg.formats.push({
                            format: format.format,
                            file: created[i]
                        });
                    });
                    next();
                });
            });
        });
    });

    schema.post('remove',cleanupImg);

    var ImageModel = mongoose.model('Image',schema);

    /**
     * static utility function for creating a new Image.
     *
     * @param  {object}   fileContents {fileName: 'foo.png', contentType: 'image/png', data: Buffer}
     * @param  {Function} callback     function(err,image)
     */
    ImageModel.newImage = function(fileContents,callback) {
        (new File(fileContents)).save(function(err,f){
            if(err) {
                return callback(err);
            }
            (new ImageModel({formats: [{file: f._id}]})).save(function(err,img){
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

