/* ********************************************************************
 * Streamlines REST service communication using node.js
 * Requires logging middleware designed by Zeta Metrics
 ********************************************************************/
/*jshint node: true */
/*jshint esversion: 6 */
(function() {
  "use strict";

  var util = require('util');

  class ForbiddenError extends Error {
    constructor(message) {
      super(message);
      this.status = 403;
      this.response = 'Forbidden';
    }
  }

  class UnauthorizedError extends Error {
    constructor(message) {
      super(message);
      this.status = 401;
      this.response = 'Unauthorized';
    }
  }

  class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.status = 400;
      this.response = message;
    }
  }

  class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.status = 404;
      this.response = 'Not Found';
    }
  }

  class EmailAlreadyTakenError extends Error {
      constructor(message) {
          super(message);
          this.status = 500;
          this.response = 'Email Already Taken';
      }
  }

  class BasePermission {

    constructor(options) {
      this.options = options;
    }
  }

  class AuthenticatedPermission extends BasePermission {

    /*
     *  Checks if the request is authenticated session
     *  or an organic request
     */
    constructor(options) {
      super(options);
    }

    hasPermission(req, res, resolve, reject) {
      return new Promise(function(resolve, reject) {
        if (!req.user) {
          throw new UnauthorizedError('No user found');
        } else {
          resolve();
        }
      });
    }
  }

  class RouteMap {

    constructor(request) {
      this.request = request;
      this.status = 200; //int
      this.result = null; //JSON object
      this.events = []; //array
      this.objectHash = {};
      this.error = null;
      this.callstack = []; //used to keep order of callbacks
      this.serializerStatus = undefined;
      this.isEmptyResponse = false;
      // Pagination
      this.paginated = false;
      this.pageObject = {};
      this.pageResponseObject = {};
      // Determine the pagination
      if (request.method == 'GET') {
        if (!request.query.page) {
          if (!request.query.limit) {
            request.query.limit = 10;
          }
          if (!request.query.offset) {
            request.query.offset = 0;
          }
          this.pageObject = {
            offset: request.query.offset,
            limit: request.query.limit
          };
        } else {
          if (!request.query.pageSize) {
            request.query.pageSize = 10;
          }
          this.pageObject = {
            page: request.query.page,
            pageSize: request.query.pageSize
          };
        }
      }
      this.bookshelfTransaction = undefined;
      this.request.logger.info(
        util.format(
          "Processing request %s %s. Query: %j. Body: %j",
          request.method,
          request.path,
          request.query,
          request.body
        )
      );
    }

    addOrUpdateObject(key, object) {
      this.objectHash[key] = object;
    }

    getObject(key, required) {
      if (this.objectHash.hasOwnProperty(key)) {
        return this.objectHash[key];
      } else {
        if (required === true) {
          throw new Error("%s not found", key);
        }
        return null; //could not find object
      }
    }

    containsKey(key) {
      if (this.objectHash.hasOwnProperty(key)) {
        return true;
      } else
        return false;
    }

    ForbiddenError(message) {
      return new ForbiddenError(message);
    }

    UnauthorizedError(message) {
      return new UnauthorizedError(message);
    }

    NotFoundError(message) {
      return new NotFoundError(message);
    }

    EmailAlreadyTakenError(message) {
        return new EmailAlreadyTakenError(message);
    }

    BadRequestError(message) {
      return new BadRequestError(message);
    }

    AuthenticatedPermission(args) {
      return new AuthenticatedPermission(args);
    }

    _recurse(response, errorCB, callback) {
      var this_ = this;
      var method = this_.pop();
      this_.addEvent('CALL', {
        name: method.name || '<Anonymous method>'
      });
      this.request.logger.info(
        util.format(
          "Running method %s",
          method.name
        )
      );
      var returnedPromise = method(this_.request, response);
      returnedPromise.then(function(data) {
        this_.addEvent('RETURN', {
          name: method.name,
          return: data,
        });
        this_.result = data;
        this_.request.logger.info(
          util.format(
            "Method %s completed succesfully",
            method.name
          )
        );
        if (this_.callstack.length === 0) {
          callback();
        } else {
          this_._recurse(response, errorCB, callback);
        }
      }).catch(function(error) {
        this_.addEvent('ERROR', {
          name: method.name
        });
        errorCB(error);
      });
    }

    makeResponse(response) {
      //  Get the call to run
      var this_ = this;
      // Get a bookshelf transaction if exists
      if (this.request.bookshelf) {
        this.request.bookshelf.transaction(function(t) {
          this_.bookshelfTransaction = t;
          return new Promise(function(resolve, reject) {
            this_._recurse(response, function(error) {
              reject(error);
            }, function() {
              resolve();
            });
          });
        }).then(function() {
          sendResponse(response);
        }).catch(function(error) {
          var status = error.status || 500;
          this_.status = status;
          this_.error = error;
          this_.addEvent('ERROR', {});
          this_.request.logger.error(
            util.format(
              "FAILURE %j",
              this_.dump()
            )
          );
          this_.request.logger.info(
            util.format(
              "Returning standard response. Status: %d.",
              this_.status
            )
          );
          response.status(this_.status).json({
            Error: error.response || 'Internal Server Error'
          });
        });
      }
      else {
        sendResponse(response);
      }
    }

    sendResponse(response) {
      //  Get the call to run
      var this_ = this;
      this_.addEvent('DONE', {});
      if (this_.paginated) {
        this_.pageResponseObject.results = JSON.parse(JSON.stringify(this_.result));
        this_.result = this_.pageResponseObject;
      }
      this_.status = this_.serializerStatus || this_.status || 200;
      this_.request.logger.info(
        util.format(
          "Returning successful response. Status: %d. Body: %j",
          this_.status,
          this_.result
        )
      );
      if (this_.isEmptyResponse || this_.result === undefined) {
        response.sendStatus(this_.status);
      } else {
        response.status(this_.status).json(this_.result);
      }
    }

    addEvent(name, args) {
      this.events.push({
        [name]: args
      });
    }

    push(callback) {
      this.callstack.push(callback);
    }

    setStatus(status) {
      this.serializerStatus = status;
    }

    emptyResponseSerializer() {
      this.isEmptyResponse = true;
      this.serializerStatus = 204;
    }

    successfulResponseSerializer() {
      this.isEmptyResponse = true;
      this.serializerStatus = 200;
    }

    createdSerializer() {
      this.isEmptyResponse = true;
      this.serializerStatus = 201;
    }

    setPageResponseObject(modelObject) {
      this.pageResponseObject = modelObject;
      this.paginated = true;
    }

    pop() {
      return this.callstack.pop();
    }

    dump() {
      return {
        Method: this.request.method,
        Path: this.request.path,
        Query: this.request.query,
        Body: this.request.body,
        ObjectHash: this.objectHash,
        Event: this.events,
        Result: this.result,
        ErrorMessage: this.error.message || '',
        Error: this.error,
        Stack: this.error.stack,
        User: this.request.user || ''
      };
    }

    setPermission(permissionObj) {
      this.callstack.push(
        permissionObj.hasPermission.bind(permissionObj)
      );
    }

    orPermission(permissionObj1, permissionObj2) {
      var permissionObj = {};
      permissionObj.hasPermission = function(req, res, resolve, reject) {
        return new Promise(function(resolve, reject) {
          permissionObj1.hasPermission(
            req, res
          ).then(function() {
            resolve();
          }).catch(function(error) {
            permissionObj2.hasPermission(
              req, res
            ).then(function() {
              resolve();
            }).catch(function(error) {
              reject(error);
            });
          });
        });
      };
      return permissionObj;
    }

    andPermission(permissionObj1, permissionObj2) {
      var permissionObj = {};
      permissionObj.hasPermission = function(req, res, resolve, reject) {
        return new Promise(function(resolve, reject) {
          permissionObj1.hasPermission(
            req, res
          ).then(function() {
            permissionObj2.hasPermission(
              req, res
            ).then(function() {
              resolve();
            }).catch(function(error) {
              reject(error);
            });
          }).catch(function(error) {
            reject(error);
          });
        });
      };
      return permissionObj;
    }
  }

  module.exports = function() {
    return function(req, res, next) {
      req.routeMap = new RouteMap(req);
      next();
    };
  };

}());
