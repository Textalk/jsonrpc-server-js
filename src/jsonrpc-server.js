/* jshint loopfunc: true  */
(function(global){


  var Server = function(response) {
    this.response = response;
    this.methods = [];
    this.defaultfn = null;
    this.PARSE_ERROR = { code: -32700 ,message: "Parse error",data: "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text." };
    this.INAVLID_REQUEST = { code: -32600, message: "Invalid Request",data:"The JSON sent is not a valid Request object."};
    this.METHOD_NOT_FOUND =  { code: -32601,message: "Method not found",data: "The method does not exist / is not available."};
    this.INVALID_PARAMS =  { code: -32602,  message: "Invalid params",data:"Invalid method parameter(s)."};
    this.INTERNAL_ERROR = { code: -32603,  message: "Internal error",data:"Internal JSON-RPC error."};
    this.SERVER_ERROR =  { code: -32000, message: "Server error", data: "Something broke."};
  };


  Server.prototype._error = function(response,error,id) {
    if (typeof id === 'undefined') {
      return undefined; //notify calls
    }
    response({
      jsonrpc: "2.0",
      error: error,
      id: id
    });
  };

  /**
   * Parse a request and execute
   * suitable function.
   * @param {Object|string} request
   * @param {Function} response (optional) A callback for when a response is ready.
   */
  Server.prototype.request = function(request,response) {
    response = response || this.response || function(){};

    if (typeof request === 'string') {
      try {
        request = JSON.parse(request);
      } catch (e) {
        this._error(response,this.PARSE_ERROR,null);
        return;
      }
    }

    if (request.jsonrpc !== '2.0' || !request.method) {
      response({
        jsonrpc: "2.0",
        error: this.INAVLID_REQUEST
      });
      return;
    }

    //method parsing
    var methods = this.methods;
    var len = this.defaultfn ? methods.length+1: methods.length;
    for (var i=0; i<len; i++) {
      var m = methods[i] || this.defaultfn;

      if (m.name === request.method || (m.re && m.re.test(request.method))) {

        //TODO: The standard has error messages for nr of params
        //      and even named params. Not really needed in a js
        //      context IMHO.

        //A notify needs no response. Fire and Forget.
        if (typeof request.id !== 'undefined' && m !== this.defaultfn) {
          m.fn.apply(null,request.params);
          return;
        } else if (typeof request.id === 'undefined' && m === this.defaultfn){
          console.log('notify',request)
          var params = request.params.slice();
          params.push(request.method);
          m.fn.apply(null,params);
          return;
        }

        var success = function(result){
          response({
            jsonrpc: "2.0",
            id: request.id,
            result: result
          });
        };

        var that = this;
        var failure = function(error){
          response({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code:    error.code    || that.INTERNAL_ERROR.code,
              message: error.message || that.INTERNAL_ERROR.error,
              data:    error.data    || error
            }
          });
        };

        //Be nice and make a copy of the params array.
        var args = (request.params || []).slice();

        if (m.async) {
          //Add callback that wraps and sends response.
          args.push(success);

          //Add callback for errors as well.
          //Callback function can either supply an error or a data payload.
          args.push(failure);
        }

        //default fn should get a last argument that is always the name of method,
        //i.e. our request.
        if (m === this.defaultfn) {
          args.push(request.method);
        }

        var res;
        try {
          res = m.fn.apply(null,args);
        } catch (e) {
          failure(e);
        }

        //Check if we got a promise back, if so hook it regardless off async flag!
        if (res && typeof res.then === 'function') {
          res.then(success,failure);
        } else if (!m.async) {
          //If we're not awaiting async callbacks we can respond right away.
          success(res);
        }
        return; //jump out of the loop
      }
    }

    //If we got here we didn't find a method
    this._error(response,this.METHOD_NOT_FOUND,request.id);
  };

  /**
   * Add method to api exposed via JSON-RPC
   * @param {string|RegExp} name Either the name of the method or a regexp to match with.
   * @param {Function} fn the actual function to call
   * @param {bool} async (optional) optional async flag, default false.
   *                      If set the function is handed a success and failure callbacks as last
   *                      arguments, and the server won't respond until one of them is called.
   *
   * Special case is when fn returns a promise. That will always be treated as async and async flag
   * is not needed.
   */
  Server.prototype.api = function(name,fn,async){
    var method = { fn: fn };
    if (typeof name === 'string') {
      method.name = name;
    } else {
      method.re = name;
    }
    if (async) {
      method.async = true;
    }
    this.methods.push(method);
  };

  /**
   * Remove an api method
   * either by name, regexp or function. RegExp need not be the exact same object,
   * but have the same toString.
   * If several methods by same function or name has been registered
   * the one registered last will be removed
   * @param {String|RegExp|Function} identifier
   */
  Server.prototype.remove = function(identifier){
    if (this.methods.length > 0) {
      var test = function(o){
        return o.name === identifier;
      };
      if (typeof identifier === 'function') {
        test = function(o){
          return o.fn === identifier;
        };
      } else if (identifier instanceof RegExp) {
        identifier = identifier.toString();
        test = function(o){
          return o.re.toString() === identifier;
        };
      }

      var methods = this.methods;
      for (var i=methods.length-1; i>=0; i--) {
        if (test(methods[i])) {
          this.methods.splice(i,1);
          return;
        }
      }
    }
  };


  /**
   * Register a default method to handle any calls not matched
   * It will receive as an extra last param the method name, after potential async callbacks.
   * @param {Function} fn
   * @param {bool} async (optional) async flag.
   */
  Server.prototype.default = function(fn,async) {
    this.defaultfn = { fn: fn , re: /.*/ };
    if (async) {
      this.defaultfn.async = true;
    }
  };


  //Cater to all tastes.
  global.JsonRpcServer = Server;
  global.jsonRpcServer = function(res) { return new Server(res); };


})(window);