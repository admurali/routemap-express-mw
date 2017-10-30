# routemap-express-mw

[![NPM](https://nodei.co/npm/routemap-express-mw.png?compact=true)](https://nodei.co/npm/routemap-express-mw/)

Express middleware for writing elegant apis.

## Motivation

We wanted to create a middleware that we can reuse across our projects to streamline and speed up development using NodeJS and express framework.
Routemap will also us to create modular functions that we can reuse across controllers.

## Description

Routemap at core is used to maintain a stack of promises that will eventually chain towards a meaningful response for the user. Routemap's callstack can be used to dynamically add promise chains during execution.

Routemap's logging mechanism will ensure all method names are logged into the console with result. Routemap's promises, when implemented correctly, end with a resolve or reject. On a rejection due to error, all query and body parameters along with the method name, line and error message are logged to the console and other transports you have specified using `logging-express-mw`.

Please configure and setup `logging-express-mw` using https://github.com/admurali/logging-express-mw

## Boilerplate

A boilerplate REST backend service can be found at: https://github.com/admurali/routemap-boiler-plate

## Basic Overview

### Installation

Needs `logging-express-mw`. For more information visit https://github.com/admurali/logging-express-mw

Install `routemap-express-mw`.

```
npm install routemap-express-mw --save
npm install logging-express-mw --save
```


### Express integration
In your server code, such as **app.js*** add the following code:

```
const app = require('express')();
const logger = require('logging-express-mw');
const routeMap = require('routemap-express-mw');

// mw to add logging to express
app.use(logger.middleware());
// mw to write elegant apis
app.use(routeMap());
```

### Controllers

In your controllers, such as ***user.js*** below, implement functions using routemap.

```
function getUser(req, res) {
  req.routeMap.push(serializeUsers);
  req.routeMap.push(fetchUsers);
  req.routeMap.makeResponse(res);
}

function putUser(req, res) {
  req.routeMap.successfulResponseSerializer();
  req.routeMap.push(updateUser);
  req.routeMap.makeResponse(res);
}

function postUser(req, res) {
  req.routeMap.createdSerializer();
  req.routeMap.push(addUser);
  req.routeMap.makeResponse(res);
}

function deleteUser(req, res) {
  req.routeMap.successfulResponseSerializer();
  req.routeMap.push(removeUser);
  req.routeMap.makeResponse(res);
}

module.exports = {
  getUser,
  putUser,
  postUser,
  deleteUser,
};
```

### Making a response

First thing is to create a response, using ***req.routeMap.makeResponse(res);***

We made the following REST functions:
* getUser - GET endpoint
* putUser - PUT endpoint
* postUser - POST endpoint
* deleteUser - DELETE endpoint

### Data Handling

Frequently, there will be a need when you will need to pass data from one routemap function to another.

We want to pass some data from ***fetchUsers*** to any other function down the promise chain. To do this, we can leverage a dictionary that routeMap comes with.

```
const USERS_KEY = 'USER';

function fetchUsers(req) {
  return new Promise((resolve, reject) => {
    let contacts = null;
    try {
      // Fetch contacts logic
      // If success add object to memory
      req.routeMap.addOrUpdateObject(USERS_KEY, users);
      resolve();
    } catch (err) {
      // If failure
      reject(err);
    }
  });
}
```

In the function above we used ***req.routeMap.addOrUpdateObject(key, object)*** to add objects to dictionary.

We can retrieve and utilize the object further using ***req.routeMap.getObject(key)***

## Pagination (Advanced)

If querying lots of data, we might want to paginate. We will go over how we implement such a solution with ease using routemap for relational databases.

### Installation

Needs `logging-express-mw`. For more information visit https://github.com/admurali/logging-express-mw

Needs `bookshelf-express-mw`. For more information visit https://github.com/admurali/bookshelf-express-mw


```
npm install logging-express-mw --save
npm install bookshelf-express-mw --save
npm install routemap-express-mw --save
```


### Express integration
In your server code, such as **app.js*** add the following code:

```
const app = require('express')();
const logger = require('logging-express-mw');
const bookshelf = require('bookshelf-express-mw');
const routeMap = require('routemap-express-mw');

// mw to add bookshelf to express
app.use(bookshelf.middleware());
// mw to add logging to express
app.use(logger.middleware());
// mw to write elegant apis
app.use(routeMap());
```
### Models

We have a *user* table in our relational database and we made a corresponding bookshelf model.

```
// user.js in models folder
const bookshelf = require('bookshelf-express-mw');

module.exports = () => {
  bookshelf.bookshelf().Model.extend({
    tableName: 'user',
    hasTimestamps: true,
  });
};
```

### Controllers

We are going to use the same ***user.js*** from the section above. We modified the ***fetchUsers*** implementation as shown below:

```
const User = require('../models/user');
const _ = require('lodash');

const USERS_KEY = 'USERS';

function fetchGlucoseActualsByPatientTag(req) {
  return new Promise((resolve, reject) => {
    User.query((qb) => {
      qb.where({
        is_deleted: 0,
      });
    }).fetchPage(
      _.extend({
        columns: [
          'id',
          'name',
        ],
      }, req.routeMap.pageObject),
    ).then((users) => {
      req.routeMap.setPageResponseObject(
        users.pagination,
      );
      req.routeMap.addOrUpdateObject(
        USERS_KEY,
        users.toJSON(),
      );
      resolve();
    }).catch((error) => {
      reject(error);
    });
  });
}
```

We used the following routemap properties:
* pageObject - for GET requests you can query by either
  * limit and offset
  * page and pageSize
* setPageResponseObject - set the bookshelf object using pagination


## Error Handling and Permissions (Advanced)

As per (https://developer.mozilla.org/) Promise can be either:

* pending: initial state, neither fulfilled nor rejected
* fulfilled: meaning that the operation completed successfully
* rejected: meaning that the operation failed

Usually we call ***reject(err)*** which throws an *Internal Server Error* message to the user with a status code *500* and logs the complete error message using the transports provided to *logging-express-mw*.

But we have other types error codes that we may want to show the user.

Routemap allows us to reuse common error codes and response messages throughout our code with minimal effort.

### Standard Errors

Out of the box routemap comes with the following error classes, which you can use throughout your project.

Standard:
* NotFoundError - Status code *404* Message *Not Found*
* ForbiddenError - Status code *403* Message *Forbidden*
* UnauthorizedError - Status code *401* Message *Unauthorized*
* BadRequestError - Status code *400* Message accepts argument as message

To throw one of these errors in your code, just add the following ***reject(req.routemap.NotFoundError());***

### Customize Errors

You can always make your own error functions and store them and pass it to the reject function.

In our example, we might add users using unqiue *email* and thus may throw frequently a *EmailAlreadyTakenError* error in various functions in our code.

We can make a custom error class such as below:

```
class EmailAlreadyTakenError extends Error {
  constructor(message) {
    super(message);
    this.status = 500;
    this.response = 'Email Already Taken';
  }
}
```

We can then make and pass this object our reject function ***reject(EmailAlreadyTakenError());***

This will send a status code of *500* and response *Email Already Taken*

### Standard Permissions

Out of the box routemap comes with the following permission class, which you can use throughout your project.

Standard:
* AuthenticatedPermission - checks if **req.user*** is not null.
  * If null it throws standard *UnauthorizedError*

To utilize this permission in your code, use the *** ***reject(req.routemap.NotFoundError());***

### Customize Permissions

You can make your own custom permissions and utilize them throughout your application using routemap. Your custom permission object needs to have a ***hasPermission*** function that returns a promise.

Continuing with our users example, lets say we have users with multiple roles in our system. We want to give only users with role of *admin* to access certain apis.

We made permission classes in application:
* BasePermission - We extend and reuse as we add additional permission classes
* RolesBasedPermission - Will check if user role matches the needed permission

```
class BasePermission {

  /*
   *  Checks if the request is authenticated session
   *  or an organic request
   */
  constructor(options) {
    this.options = options;
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

class RolesBasedPermission extends BasePermission {
  constructor(options) {
    super(options);
  }

  hasPermission(req) {
    const _this = this;
    const parentPromise = super.hasPermission(req, res);
    return new Promise(function(resolve, reject) {
      parentPromise.then(function() {
        if (_this.options.roles.length > 0 && _this.options.roles.indexOf(req.user.role) < 0) {
          throw new req.routeMap.ForbiddenError('User role of ' + req.user.role + ' not allowed.');
        } else {
          resolve();
        }
      }).catch(function(error) {
        reject(error);
      });
    });
  }
```

We modify our ***getUsers*** function to ensure only *admin* users can view all users in our databases.

```
function getUser(req, res) {
  req.routeMap.push(serializeUsers);
  req.routeMap.push(fetchUsers);

  req.routeMap.setPermission(
    new RolesBasedPermission({
        roles: ['admin']
    })
  );

  req.routeMap.makeResponse(res);
}
```

Before ***makeResponse(res)*** we call routemap's ***setPermission*** function with our custom permissions object.

Routemap before executing ***fetchUsers*** will call the ***hasPermission*** function in our *RolesBasedPermission* object.

If user role type does not have enough privileges, we throw routemap's ***req.routeMap.ForbiddenError***. We pass in a message, that gets logged using transports provided to ***logging-express-mw*** but routemap will return status code *403* and message as *Forbidden* to user.
