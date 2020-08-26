# Firestore Sequelizer
[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)
# Simple Firebase ORM
If you like to use Sequelize and use models in your backend projects try to use FirestoreSequelizer, some features that you have:
  - Create Models for your Collections;
  - Construct Select query's like Sequelize using where and orderBy;
  - Default Attributes values for Collection Models;
  - Attributes Validation;
  - Sync command to update Collection Structure;
  - Observators for model attribute change;
  - Model Rollback;
  - Subcollection Support; 

### Installation
To use lib just start your firebase-admin normally.
```javascript
const admin = require("firebase-admin");
admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "..."
    });
const defineModel = require("firestore-sequelizer");
```

### Model Definition
```javascript
const User = defineModel("users", {
    name: "",
    email: "",
    admin: {
    type: "boolean",
    required: true,
    },
});
```
### Model Definition
```javascript
const User = defineModel("users", {
    name: "",
    email: "",
    admin: {
    type: "boolean",
    required: true,
    },
});
```
### CRUD operations
Create record;
```javascript
let user = await User.create({name: "John" , email: "john@email.com", admin: false});
```
To find by id;
```javascript
let user = await User.findOne({where:{id: "XsYsmvl3scnadAs"}});
```
To find all not admin users ordened by name using where and order;
```javascript
let users = await User.findAll({where:{admin: false}, order: [["name", "asc"]]});
```
update user record using user instance;
```javascript
let user = await User.findOne({where:{id: "XsYsmvl3scnadAs"}});
user.name = "other name";
await user.save();
```
Update user record using user static class;
```javascript
await User.update( {name: "other name"}, {where: {id: "XsYsmvl3scnadAs"}});
```
Delete User record using user static class;
```javascript
let user = await User.findOne({where:{id: "XsYsmvl3scnadAs"}});
user.destroy();
```
### Observables
```javascript
const User = defineModel("users", {
    name: "",
    email: "",
    admin: {
    type: "boolean",
    required: true,
    },
});
User.prototype.onData(field, value, data){
    //field = "name", value = "other name", data = rest of attributes
}
let user = await User.findOne({where:{id: "XsYsmvl3scnadAs"}});
user.name  = "other name";
```
###Subcollections
```javascript
const CashRegister = defineModel("cashRegister", {
    value: 0
});
const User = defineModel("users", {
    name: "",
    email: "",
    admin: {
    type: "boolean",
    required: true,
    },
}, {subcollections: [CashRegister]});
let user = await User.findOne({where:{id: "XsYsmvl3scnadAs"}});
user.createCashRegister({value: 0})
user.updateCashRegister({value: 56})
user.createCashRegister({where: {id: "23sdanKSsnfeo32Js"}})
```




