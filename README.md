# routemap-express-mw

[![NPM](https://nodei.co/npm/routemap-express-mw.png?compact=true)](https://nodei.co/npm/routemap-express-mw/)

Express middleware for writing elegant apis.

## Motivation

Routemap provides ready made utilities for designing your REST APIs. Routemap is a reusable middleware to streamline and accelerate development using Node.js and express framework.

Here you can create modular functions that can be reused across controllers.

## Description

Routemap is used to maintain a stack of promises that will eventually chain towards a standard http status response. Routemap's callstack can be used to dynamically add promise chains during execution.

Routemap's logging mechanism will record all method names providing built-in traceability. Routemap's promises result in a resolve or reject. On a rejection due to error, all query and body parameters, error messages, and method names are logged using transports you have specified in `logging-express-mw`.

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
In your server code, such as **app.js** add the following code:

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

In your controllers, such as **user.js** below, implement functions using routemap.

```
// example user.js controller
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

For routemap to function, we first need to create a response, using ***req.routeMap.makeResponse(res);***

In the example above, we had the following REST endpoints:
* getUser - GET
* putUser - PUT
* postUser - POST
* deleteUser - DELETE

### Data Handling

Frequently, you will need to pass data from one routemap function to another.
For example, we want to pass data from ***fetchUsers*** to any other function down the promise chain. To do this, we can leverage a built-in dictionary from routemap.

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

In the function above, we used ***req.routeMap.addOrUpdateObject(key, object)*** to add objects to the dictionary.

We can retrieve and utilize the object downstream using ***req.routeMap.getObject(key)***.

## Pagination (Advanced)

When querying large amounts of data, we might want to implement pagination in our response. We will showcase pagination with an example solution using routemap for relational databases.

### Installation

Needs `logging-express-mw`. For more information visit https://github.com/admurali/logging-express-mw

Needs `bookshelf-express-mw`. For more information visit https://github.com/admurali/bookshelf-express-mw


```
npm install logging-express-mw --save
npm install bookshelf-express-mw --save
npm install routemap-express-mw --save
```


### Express integration
In your server code, such as **app.js** add the following code:

```
const app = require('express')();
const logger = require('logging-express-mw');
const bookshelf = require('bookshelf-express-mw');
const routeMap = require('routemap-express-mw');

const config = {
  client: 'mysql',
  connection: {
    host : '127.0.0.1',
    user : 'your_database_user',
    password : 'your_database_password',
    database : 'myapp_test'
  },
  pool: { min: 0, max: 7 }
}

// mw to add bookshelf to express
app.use(bookshelf.middleware(config));

// mw to add logging to express
app.use(logger.middleware());
// mw to write elegant apis
app.use(routeMap());
```
### Models

We have a *user* table in our relational database and made a corresponding bookshelf model.

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

We are going to use the same **user.js** controller from the **Basic Overview** section above. We modified the ***fetchUsers*** implementation as shown below:

```
const User = require('../models/user');
const _ = require('lodash');

const USERS_KEY = 'USERS';

function fetchUsers(req) {
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
          'is_deleted',
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
* pageObject - for GET requests query by either
  * limit and offset

     --OR--

  * page and pageSize
* setPageResponseObject - sets the bookshelf object using pagination

We can then make a ***serializeUsers*** function as shown below:

```
function serializeUsers(req) {
  return new Promise((resolve, reject) => {
    try {
      const users = req.routeMap.getObject(
        USERS_KEY,
      );
      resolve(users.map(
        (user) => {
          const result = _.pick(user, [
            'id',
            'name',
          ]);
          return result;
        }));
    } catch (error) {
      reject(error);
    }
  });
}
```

## Error Handling and Permissions (Advanced)

Promise can result in three states:
* pending: initial state, neither fulfilled nor rejected
* fulfilled: the operation completed successfully
* rejected: the operation failed

Usually, we call ***reject(err)*** which throws an *Internal Server Error* message to the user with a status code *500* and logs the complete error message using the transports provided to *logging-express-mw*.

We could have other types of error codes that we may want to show the user.
Routemap allows us to reuse common error codes and response messages throughout our code with minimal effort.

### Standard Errors

Out of the box, routemap comes with the following error classes which you can use throughout your project.

Standard:
* NotFoundError - Status code *404* Message *Not Found*
* ForbiddenError - Status code *403* Message *Forbidden*
* UnauthorizedError - Status code *401* Message *Unauthorized*
* BadRequestError - Status code *400* Message accepts argument as message

To throw one of these errors in your code, just add the following ***reject(req.routemap.NotFoundError());***

### Customize Errors

You can always make your own error functions to store and pass to the reject function.

In our example, we might add users using unique *email* address and thus, may throw an *EmailAlreadyTakenError* error in various functions in our code.

We can make a custom error class as described below:

```
class EmailAlreadyTakenError extends Error {
  constructor(message) {
    super(message);
    this.status = 500;
    this.response = 'Email Already Taken';
  }
}
```

We can then make and pass this object to our reject function ***reject(EmailAlreadyTakenError());***

This will send a status code of *500* and a response *Email Already Taken*

### Standard Permissions

Built-in, routemap comes with the following permission class which you can use throughout your project.

Standard:
* AuthenticatedPermission - checks if **req.user*** is not null.
  * If null, it throws standard *UnauthorizedError*

For example, we can use the ***AuthenticatedPermission*** to ensure only authenticated users can access our ***getUser*** function.

```
function getUser(req, res) {
  req.routeMap.push(serializeUsers);
  req.routeMap.push(fetchUsers);
    req.routeMap.setPermission(
        req.routeMap.AuthenticatedPermission()
    );
    req.routeMap.makeResponse(res);
}
```

### Customize Permissions

You can make your own custom permissions and utilize them throughout your application using routemap. Your custom permission object needs to have a ***hasPermission*** function that returns a promise.

Continuing with our users example, let's say we have users with multiple roles in our system. We want to give only users with role of *admin* to access certain APIs.

Below, we made permission classes in the application:
* BasePermission - We extend and reuse as we add additional permission classes
* RolesBasedPermission - Will check if user role matches the needed permissions

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

Before executing ***fetchUsers***, routemap will call the ***hasPermission*** function in our *RolesBasedPermission* object.

If user role type does not have enough privileges, we throw routemap's ***req.routeMap.ForbiddenError*** error. We pass in a message that gets logged using transports provided to ***logging-express-mw***, but routemap will return the status code *403* resulting in a *Forbidden* error message to the end user.
