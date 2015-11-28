var should = require('should'),
    util = require('./util/util'),
    fs = require('fs'),
    _ = require('lodash');

describe('File',function(){

    before(util.before);

    after(function(done){
        util.File.find({}).remove(function(err){
            if(err) {
                throw err;
            }
            util.debug('files cleaned up');
            util.after(done);
        });
    });

    var theFile;
    function compareToTheFile(to) {
        Object.keys(theFile).forEach(function(key) {
            if(key === '_links'){
                to.should.have.property('_links');
                Object.keys(theFile._links).forEach(function(l){
                    to._links.should.have.property(l).and.equal(theFile._links[l]);
                });
            } else {
                to.should.have.property(key).and.equal(theFile[key]);
            }
        });
    }

    it('create',function(done){
        util.api.post('/api/file')
            .attach('file','test/img.js')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('create',res.body);
                res.body.should.have.property('_id');
                res.body.should.have.property('_links');
                res.body.should.have.property('fileName').and.equal('img.js');
                res.body.should.have.property('contentType').and.equal('application/javascript');
                var id = res.body._id,
                    fileName = res.body.fileName,
                    links = res.body._links;
                links.should.have.property('self').and.equal('/api/file/'+id);
                links.should.have.property('download').and.equal('/api/file/'+id+'/download/'+fileName);
                theFile = res.body;
                done();
            });
    });

    it('list',function(done){
        util.api.get('/api/file')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('list',JSON.stringify(res.body));
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                compareToTheFile(res.body.list[0]);
                done();
            });
    });

    it('get',function(done){
        util.api.get(theFile._links.self)
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                compareToTheFile(res.body);
                done();
            });
    });

    function collectFile(res,next){
        res.setEncoding('binary')
        res.data = '';
        res.on('data',function(chunk){
            res.data += chunk;
        });
        res.on('end',function(){
            next(null,new Buffer(res.data, 'binary'));
        });
    }

    it('download',function(done){
        util.api.get(theFile._links.download)
            .expect(200)
            .expect('Content-Type','application/javascript')
            .parse(collectFile)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                res.body.should.be.instanceof(Buffer);
                res.body.toString().should.equal(fs.readFileSync('test/img.js').toString());
                done();
            });
    });

    it('update',function(done){
        util.api.put(theFile._links.self)
            .attach('file','test/file.js')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('update',res.body);
                res.body.should.have.property('_id').and.equal(theFile._id); // no id change
                res.body.should.have.property('_links');
                res.body.should.have.property('fileName').and.equal('file.js');
                res.body.should.have.property('contentType').and.equal('application/javascript');
                var id = res.body._id,
                    fileName = res.body.fileName,
                    links = res.body._links;
                links.should.have.property('self').and.equal('/api/file/'+id);
                links.should.have.property('download').and.equal('/api/file/'+id+'/download/'+fileName);
                theFile = res.body;
                done();
            });
    });

    it('get updated',function(done){
        util.api.get(theFile._links.self)
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                compareToTheFile(res.body);
                done();
            });
    });

    it('download updated',function(done){
        util.api.get(theFile._links.download)
            .expect(200)
            .expect('Content-Type','application/javascript')
            .parse(collectFile)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                res.body.should.be.instanceof(Buffer);
                res.body.toString().should.equal(fs.readFileSync('test/file.js').toString());
                done();
            });
    });
});