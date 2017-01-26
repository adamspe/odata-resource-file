var mongoose = require('mongoose'),
    schema = new mongoose.Schema({
        md5: {type: String},
        uploadDate: {type: Date},
        chunkSize: {type: Number},
        length: {type: Number},
        filename: {type: String},
        metadata: {type: mongoose.Schema.Types.Mixed}
    }, {strict: false, collection: 'fs.files'}),
    mime = require('mime-types'),
    debug = require('debug')('odata-resource-file'),
    Grid = require('gridfs-stream'),
    fs = require('fs');

schema.methods.getReadStream = function() {
    return File.gfs.createReadStream({_id: this._id});
};

schema.pre('remove',function(next){
    File.unlink(this._id,next);
});

var File = mongoose.model('File',schema);

File.unlink = function(id,callback) {
    File.gfs.remove({_id: id},callback);
};

/**
 * @param {undefined||ObjectId} id if undefined will be new file
 * @param {Object} file  multer input with the exception of an optional 'cleanup' flag which if set will delete the file.
 * @param {function} callback invoked with the new File object.
 **/
File.storeFile = function(id,file,callback) {
    function write(err) {
        if(err) {
            callback(err);
        }
        var writeStream = File.gfs.createWriteStream({
                _id: (id||mongoose.Types.ObjectId()),
                filename: file.originalname,
                mode: 'w',
                content_type: file.mimetype,
                metadata: file.metadata
            }),
            readStream = fs.createReadStream(file.path).pipe(writeStream);
        writeStream.on('error',callback);
        writeStream.on('close',function(f){
            debug('gfs.writeStream.close',f);
            if(file.cleanup) {
                fs.unlink(file.path,function(err){
                    if(err) {
                        console.error(err);
                    }
                    callback(null,f);
                });
            } else {
                callback(null,f);
            }
        });
    }
    if(id) {
        // delete and re-write on update
        File.unlink(id,write);
    } else {
        write();
    }
};

File.storeData = function(id,file,callback) {
    function write(err) {
        if(err) {
            callback(err);
        }
        var writeStream = File.gfs.createWriteStream({
                _id: (id||mongoose.Types.ObjectId()),
                filename: file.filename,
                mode: 'w',
                content_type: file.mimetype,
                metadata: file.metadata
            });
        writeStream.on('error',callback);
        writeStream.on('close',function(f){
            debug('gfs.writeStream.close',f);
            callback(null,f);
        });
        writeStream.end(file.data);
    }
    if(id) {
        // delete and re-write on update
        File.unlink(id,write);
    } else {
        write();
    }
};

function initGridFs() {
    debug('creating grid fs');
    File.gfs = Grid(mongoose.connection.db,mongoose.mongo);
}
if(mongoose.connection.readyState) {
    initGridFs();
} else {
    mongoose.connection.once('open',initGridFs);
}

module.exports = File;
