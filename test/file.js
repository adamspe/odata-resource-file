var should = require('should'),
    util = require('./util/util'),
    fs = require('fs'),
    _ = require('lodash'),
    q = require('q');

describe('File',function(){

    before(util.before);

    after(function(done){
        // need to re-do to use File.unlink or some such
        util.File.find({},function(err,files) {
            if(err) {
                throw err;
            }
            q.all(files.map(function(f) { return f.remove(); }))
              .then(function(fs){
                  done();
              },done);
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
                if(typeof(theFile[key]) === 'object') {
                    to.should.have.property(key).and.eql(theFile[key]);
                } else {
                    to.should.have.property(key).and.equal(theFile[key]);
                }
            }
        });
    }

    it('create',function(done){
        var metadata = {
            'foo': 'bar',
            'test': true
        };
        util.api.post('/api/file')
            .field('metadata',JSON.stringify(metadata))
            .attach('file','test/img.js')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('create',res.body);
                res.body.should.have.property('_id');
                res.body.should.have.property('_links');
                res.body.should.have.property('filename').and.equal('img.js');
                res.body.should.have.property('contentType').and.equal('application/javascript');
                res.body.should.have.property('metadata').and.eql(metadata)
                var id = res.body._id,
                    filename = res.body.filename,
                    links = res.body._links;
                links.should.have.property('self').and.equal('/api/file/'+id);
                links.should.have.property('download').and.equal('/api/file/'+id+'/download/'+filename);
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

    it('update metadata',function(done) {
        var metadata = {
            foo: 'baz',
            test: false
        };
        util.api.put(theFile._links.self)
            .field('metadata',JSON.stringify(metadata))
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('update metadata',res.body);
                // make sure metadata updated but only change
                theFile.metadata = metadata;
                compareToTheFile(res.body);
                theFile = res.body;
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

    it('overwrite',function(done){
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
                res.body.should.have.property('filename').and.equal('file.js');
                res.body.should.have.property('contentType').and.equal('application/javascript');
                var id = res.body._id,
                    filename = res.body.filename,
                    links = res.body._links;
                links.should.have.property('self').and.equal('/api/file/'+id);
                links.should.have.property('download').and.equal('/api/file/'+id+'/download/'+filename);
                theFile = res.body;
                done();
            });
    });

    it('get overwritten',function(done){
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
