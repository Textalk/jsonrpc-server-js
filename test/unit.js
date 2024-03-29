/* jshint expr: true */
/* global JsonRpcServer, jsonRpcServer, chai, should */


var idsequence = 0;
var ccall = function(method,params) {
  return {
    id: idsequence++,
    method: method,
    params: params || [],
    jsonrpc: "2.0"
  };
};

var cnotify = function(method,params) {
  return {
    method: method,
    params: params || [],
    jsonrpc: "2.0"
  };
};


chai.should();

describe('jsonrpc-server',function(){

  it('should export its constructor globally, in two flavors',function(){
    window.JsonRpcServer.should.be.a('function');
    window.jsonRpcServer.should.be.a('function');
  });

  it('should respond with method not found when no methods are registered',function(done){
    var s = jsonRpcServer();
    s.request(ccall('foo'),function(res){

      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number');
      res.error.should.be.deep.equal(s.METHOD_NOT_FOUND);
      should.not.exist(res.result);
      done();
    });
  });

  it('should respond not respond at all to a notfy call',function(){
    var s = new JsonRpcServer();
    var foo = sinon.stub().returns('foobar');

    s.api(/foo/,foo);
    s.request(cnotify('foo'),sinon.stub().throws());
    foo.should.have.been.calledOnce;
  });


  it('should respond not respond at all to a notfy call, even on errors',function(){
    var s = new JsonRpcServer();
    s.request(cnotify('foo'),sinon.stub().throws());
  });


  it('should respond with not implemented when no matching methods are registered',function(done){
    var s = new JsonRpcServer();

    s.api(/bar/,sinon.stub().throws());
    s.request(ccall('foo'),function(res){

      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number');
      res.error.should.be.deep.equal(s.METHOD_NOT_FOUND);
      should.not.exist(res.result);
      done();
    });

  });

  it('should respond with result when a matching method is registered',function(done){
    var s = new JsonRpcServer();

    s.api(/foo/,function(){ return 'bar';});
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){

      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });
  });

  it('should use respond function handed to constructor',function(){
    var res = sinon.spy();
    var s = new JsonRpcServer(res);

    s.api(/foo/,function(){ return 'bar';});
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o);
    res.should.have.been.calledOnce;

    //If a response function is supplied that should override default
    var res2 = sinon.spy();
    s.request(o,res2);
    res2.should.have.been.calledOnce;
    res.should.have.been.calledOnce;
  });

  it('should handle having no response function',function(){
    var s = new JsonRpcServer();
    var foo = sinon.stub().returns('bar');
    s.api(/foo/,foo);
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o);
    foo.should.have.been.calledOnce;

  });

  it('should respond with result when a matching method by name is registered',function(done){
    var s = new JsonRpcServer();

    s.api('foo',function(){ return 'bar';});
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){

      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });

  });

  it('should respond with result of the first matching method ',function(done){
    var s = new JsonRpcServer();

    s.api(/no/,sinon.stub().throws());
    s.api(/foo/,function(){ return 'bar';});
    s.api(/bar/,sinon.stub().throws());
    s.api(/.*/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });

  });

  it('should handle a json string as request',function(done){
    var s = new JsonRpcServer();

    s.api('foo',function(){ return 'bar';});
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(JSON.stringify(o),function(res){

      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });
  });

  it('should respond with parse error if json sting is unparsable',function(done){
    var s = new JsonRpcServer();
    s.request("this is not JSON!!!!!",function(res){
      res.jsonrpc.should.equal('2.0');
      expect(res.id).to.not.be.defined;
      res.error.should.be.deep.equal(s.PARSE_ERROR);
      should.not.exist(res.result);
      done();
    });
  });

   it('should handle empty params',function(){
    var s = new JsonRpcServer();
    var foo = sinon.stub().returns('foobar');
    var res = sinon.spy();
    s.api(/foo/,foo);
    s.request({jsonrpc:"2.0",method: 'foo', id: idsequence++ },res);
    expect(foo).to.have.been.calledOnce;
    expect(res).to.have.been.calledOnce;
  });

  it('should respond with error to malformed json rpc request',function(done){
    var s = new JsonRpcServer();
    s.request({},function(res){

      res.jsonrpc.should.equal('2.0');
      res.error.should.be.deep.equal(s.INAVLID_REQUEST);
      should.not.exist(res.result);
      done();
    });
  });

  it('should respond with error to malformed json rpc request, version 2',function(done){
    var s = new JsonRpcServer();
    s.request({ jsonrpc: "2.0"},function(res){

      res.jsonrpc.should.equal('2.0');
      res.error.should.be.deep.equal(s.INAVLID_REQUEST);
      should.not.exist(res.result);
      done();
    });
  });

  it('should respond with error if api method throws an exception',function(done){
    var s = new JsonRpcServer();
    s.api(/foo/,function(){
      throw new Error('Dammit Janet!');
    });

    s.request(ccall('foo'),function(res){
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a.number;
      res.error.code.should.be.equal(s.INTERNAL_ERROR.code);
      should.not.exist(res.result);
      done();
    });
  });


  it('should respond with error if api method throws an exception, version 2',function(done){
    var s = new JsonRpcServer();
    s.api(/foo/,function(){
      throw {};
    });

    s.request(ccall('foo'),function(res){
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a.number;
      res.error.code.should.be.equal(s.INTERNAL_ERROR.code);
      should.not.exist(res.result);
      done();
    });
  });

  it('should respond with result when a matching async method is registered',function(done){
    var s = new JsonRpcServer();
    s.api(/foo/,function(success,failure){
      success.should.be.a('function');
      failure.should.be.a('function');
      return setTimeout(function(){
        success('bar');
      },10);
    },true);
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });
  });

  it('should respond async with result when a matching method returns a promise, even though async is not set',function(){
    var s = new JsonRpcServer();

    var first,second;
    var then = function(a,b) {
      first = a;
      second = b;
    };

    s.api(/foo/,function(){
      return { then: then };
    });
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    var res = sinon.spy();
    s.request(o,res);
    //res should not have been called yet since promise is not resolved!
    res.should.not.have.been.called;
    first.should.be.a('function');
    second.should.be.a('function');

    //resolve promise
    first('foobar');
    res.should.have.been.calledOnce;

  });

  it('should respond with result when a default method is registered',function(done){
    var s = new JsonRpcServer();
    var foo = sinon.stub().returns('bar');
    s.default(foo);
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){
      foo.should.have.been.called;
      foo.args[0][0].should.equal('foo');
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });
  });

  it('should do default method on notify as well',function(){
    var s = new JsonRpcServer();
    var foo = sinon.stub().returns('bar');
    s.default(foo);
    s.api(/bar/,sinon.stub().throws());

    var o = cnotify('foo');
    s.request(o,sinon.stub().throws());
    foo.should.have.been.called;
    foo.args[0][0].should.be.equal('foo');

  });


  it('should respond with result when a default method is registered, with async',function(done){
    var s = new JsonRpcServer();
    var foo = sinon.spy(function(success,failure,name){
      success.should.be.a('function');
      failure.should.be.a('function');
      name.should.be.equal('foo');
      setTimeout(function(){
        success('bar');
      },10);
    });
    s.default(foo,true);
    s.api(/bar/,sinon.stub().throws());

    var o = ccall('foo');
    s.request(o,function(res){
      foo.should.have.been.called;
      res.jsonrpc.should.equal('2.0');
      res.id.should.be.a('number').and.equal(o.id);
      should.not.exist(res.error);
      res.result.should.equal('bar');
      done();
    });
  });

  it('should remove methods by name',function(){
    var server = new JsonRpcServer();
    server.api('foo',sinon.spy());
    server.api(/bar/,sinon.spy());

    server.methods.length.should.be.equal(2);
    server.remove('foo');
    server.methods.length.should.be.equal(1);
    server.methods[0].re.toString().should.be.equal('/bar/');
  });

  it('should handle remove even on empty list',function(){
    var server = new JsonRpcServer();
    server.methods.length.should.be.equal(0);
    server.remove('foo');
    server.methods.length.should.be.equal(0);
  });

  it('should remove methods by RegExp',function(){
    var server = new JsonRpcServer();
    server.api('foo',sinon.spy());
    server.api(/bar/,sinon.spy());

    server.methods.length.should.be.equal(2);
    server.remove(/bar/);
    server.methods.length.should.be.equal(1);
    server.methods[0].name.should.be.equal('foo');
  });


  it('should remove methods by function',function(){
    var server = new JsonRpcServer();
    var fn = sinon.spy();
    server.api('foo',sinon.spy());
    server.api(/bar/,fn);

    server.methods.length.should.be.equal(2);
    server.remove(fn);
    server.methods.length.should.be.equal(1);
    server.methods[0].name.should.be.equal('foo');
  });


  it('should remove last in',function(){
    var server = new JsonRpcServer();
    server.api('foo',sinon.spy());
    server.api(/bar/,sinon.spy());
    server.api('foo',sinon.spy());

    server.methods.length.should.be.equal(3);
    server.remove('foo');
    server.methods.length.should.be.equal(2);
    server.methods[0].name.should.be.equal('foo');
  });

});


describe('jsonrpc-server angular service',function(){
  beforeEach(module('jsonrpc'));

  it('should expose a service called JsonRpcServer',function(){
    inject(function(JsonRpcServer){
      JsonRpcServer.should.be.an('object');
      JsonRpcServer.api.should.be.a('function');
      JsonRpcServer.remove.should.be.a('function');
      JsonRpcServer.request.should.be.a('function');
      JsonRpcServer.setResponseMethod.should.be.a('function');
      JsonRpcServer.setDefaultApiFn.should.be.a('function');
    });
  });

  it('should have a provider',function(){
    module(function(JsonRpcServerProvider){
      JsonRpcServerProvider.should.be.an('object');
      JsonRpcServerProvider.setResponseMethod.should.be.a('function');
      JsonRpcServerProvider.setResponseMethod(angular.noop);
    });
  });

  it.only('should respond with METHOD_NOT_FOUND if nothing is registered',function(){
    inject(function(JsonRpcServer){
      var response = sinon.spy();
      var obj = ccall('foo',[1,2]);
      JsonRpcServer.request(obj,response);
      response.should.have.been.calledWith({jsonrpc:"2.0",id: obj.id, error: JsonRpcServer.server.METHOD_NOT_FOUND });
    });
  });


});