var mongoose = require('mongoose'),
    schema = mongoose.Schema({
        fileName: { type: String, trim: true, required: true},
        contentType: { type: String, trim: true},
        data: { type: Buffer, required: true }
    }),
    mime = require('mime-types'),
    debug = require('debug')('odata-resource-file');

schema.set('collection', 'File');

schema.pre('save',function(next){
    if(!this.contentType) {
        this.contentType = mime(this.fileName);
    }
    debug('saving file %s, %s',this.fileName, this.contentType);
    next();
});

module.exports = mongoose.model('File',schema);