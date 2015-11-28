var should = require('should'),
    util = require('./util/util'),
    fs = require('fs'),
    _ = require('lodash');

describe('Img',function(){
    var theImg;

    before(util.before);
    after(util.after);

    function basicImgValidate(img){
        img.should.have.property('_id');
        img.should.have.property('_links');
        img.should.have.property('formats').and.be.instanceof(Array).with.lengthOf(2);
        var id = img._id,
            links = img._links;
        links.should.have.property('self').and.equal('/api/img/'+id);
        links.should.have.property('original').and.startWith('/api/file/').and.endWith('/download/test.jpg');
        links.should.have.property('thumbnail').and.startWith('/api/file/').and.endWith('/download/test_thumbnail.jpg');
    }

    it('create',function(done){
        util.api.post('/api/img')
            .attach('file','test/util/test.jpg')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('create',JSON.stringify(res.body));
                basicImgValidate(res.body);
                theImg = res.body;
                done();
            });
    });

    it('list',function(done){
        util.api.get('/api/img')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('list',JSON.stringify(res.body));
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(1);
                basicImgValidate(res.body.list[0]);
                done();
            });
    });

    it('get',function(done){
        util.api.get(theImg._links.self)
            .expect(200)
            .end(function(err,res){
                util.debug('get',JSON.stringify(res.body));
                basicImgValidate(res.body);
                done();
            });
    });

    // TODO - this is missing a binary comparison of theImg._links.original to the image that was uploaded

    it('delete',function(done){
        util.api.delete(theImg._links.self)
            .expect(200)
            .end(done);
    });

    it('post delete get',function(done){
        util.api.get(theImg._links.self)
            .expect(404)
            .end(done);
    });

    it('post delete list',function(done){
        util.api.get('/api/img')
            .expect(200)
            .end(function(err,res){
                if(err) {
                    throw err;
                }
                util.debug('post delete list',JSON.stringify(res.body));
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(0);
                done();
            });
    });

    it('post delete file cleanup',function(done){
        util.api.get('/api/file')
            .expect(200)
            .end(function(err,res){
                util.debug('post delete file cleanup',JSON.stringify(res.body));
                res.body.should.have.property('list').and.be.instanceof(Array).with.lengthOf(0);
                done();
            });
    });
});