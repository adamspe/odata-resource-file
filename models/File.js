var mongoose = require('mongoose'),
    schema = new mongoose.Schema({}, {strict: false, collection: 'fs.files'}),
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

File.storeData = function(id,file,callback) {
    function write(err) {
        if(err) {
            callback(err);
        }
        var writeStream = File.gfs.createWriteStream({
                _id: (id||mongoose.Types.ObjectId()),
                filename: file.originalname,
                mode: 'w',
                content_type: file.mimetype
            }),
            readStream = fs.createReadStream(file.path).pipe(writeStream);
        writeStream.on('error',callback);
        writeStream.on('close',function(f){
            debug('gfs.writeStream.close',f);
            callback(null,f);
        });
    }
    if(id) {
        // delete and re-write on update
        File.unlink(id,write);
    } else {
        write();
    }
};

mongoose.connection.once('open',function() {
    debug('creating grid fs');
    File.gfs = Grid(mongoose.connection.db,mongoose.mongo);
});

module.exports = File;
