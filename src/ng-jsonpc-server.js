/* global JsonRpcServer */
angular.module('jsonrpc',[]);

angular.module('jsonrpc').provider('JsonRpcServer',function(){
  var response;
  var requestHandler;
  var requestQueue = [];

  this.setResponseMethod = function(res) {
    response = res;
  };

  this.getRequestHandler = function() {
    return function(req,res) {
      if (requestHandler) {
        requestHandler(req,res);
      } else {
        requestQueue.push([req,res]);
      }
    };
  };

  this.$get = ['$injector','$rootScope',function($injector,$rootScope){
    var service = { server: null };
    var services = {}; //service calls are matched with injection by us, not the server
    var defaultfn;

    service.setResponseMethod = function(res) {
      response = res;
    };

    service.setDefaultApiFn = function(fn){
      defaultfn = fn;
    };


    //create a service
    service.server = new JsonRpcServer(function(){
      if (response) {
        response.apply(this,Array.prototype.slice.call(arguments));
      }
    });

    //request handler
    service.request = angular.bind(service.server,service.server.request);
    requestHandler = service.request;

    //default method handles our services and defaultfn
    service.server.default(function(){
      var name    = arguments[arguments.length-1];
      var parts   = name.split('.');

      //notify calls doesn't have any callbacks
      var success = arguments[arguments.length-3] || angular.noop;
      var failure = arguments[arguments.length-2] || angular.noop;
      var args = Array.prototype.slice.call(arguments,0,-3);

      //check if it's a service
      if (services[parts[0]]) {
        var s = $injector.get(parts[0]);
        var parent = s;
        //handle possible dot selection.
        for (var i=1; s[parts[i]]; i++) {
          parent = s;
          s = s[parts[i]];
        }

        if (angular.isFunction(s)) {
          //we only support async via promises!
          var result = s.apply(parent,args);
          if (angular.isObject(result) && angular.isFunction(result.then)) {
            result.then(success,failure);
          } else {
            success(result);
          }
          //Kick off any promises or changes.
          //We don't wrap in apply since we do want errors to
          //be caught in json rpc server.
          if (!$rootScope.$$phase) {
            $rootScope.$apply();
          }
          return;
        }
      } else if (defaultfn) {
        //is another default registered? Then chuck it along.
        defaultfn.apply(Array.prototype.slice.call(arguments));
        return;
      }
      //Otherwise report as methof not found.
      failure(service.server.METHOD_NOT_FOUND);
    },true);



    /**
     * Register an API
     * You can either register a service or a list of services or follow the
     * "ordinary" JsonRpcServer API to register a function by a name or regexp.
     * ex.
     *  //An angular service
     *  JsonRpcServerProvider.api('FooService')
     *
     *  //Several services
     *  JsonRpcServerProvider.api(['FooService','BarService'])
     *
     *  //just a function
     *  JsonRpcServerProvider.api('hello',function(name){ return 'Hello '+name; })
     *
     *  //or a RegExp
     *  JsonRpcServerProvider.api(/hello/,function(name){ return 'Hello '+name; })
     * @param {Array|String|RegExp} an array of service names to register or a service name or a function name
     * @param {Function} fn (optional)
     * @param {bool} async (optional)
     */
    service.api = function(name,fn,async){
      if (angular.isArray(name)) {
        angular.forEach(name,function(){
          services[name] = true;
        });
      } else if (angular.isUndefined(fn)){
        services[name] = true;
      } else {
        service.server.api(name,fn,async);
      }
    };

    /**
     * Remove a service mapping or other API mapping
     **/
    service.remove = function(name){
      if (services[name]) {
        delete services[name];
      } else {
        service.server.remove(name);
      }
    };


    //Last but not least fire off queue reqs on next tick.
    setTimeout(function(){
      angular.forEach(requestQueue,function(args){
        service.request.apply(args);
      });
    },1);

    return service;
  }];
});