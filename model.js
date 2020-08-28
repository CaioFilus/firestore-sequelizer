const admin = require("firebase-admin");

function defineModel(name, attributes, opts = {}) {
    opts.subcollections = opts.subcollections || [];
    opts.freeModel = opts.freeModel || false;
    opts.validateType = opts.validateType || false;

    let isDoc = (name.split('/').length % 2) === 1;

    function querySnapToModel(snap, one = false) {
        if (snap.docs) {
            if (one) {
                return snap.docs[0] ? new Model(snap.docs[0]) : undefined;
            } else {
                let result = [];
                for (let doc of snap.docs) {
                    result.push(new Model(doc));
                }
                return result;
            }
        } else if (snap.exists) {
            return new Model(snap);
        }
        return undefined;
    }

    for (let key in attributes) {
        if (typeof attributes[key] !== 'object') {
            let value = attributes[key];
            attributes[key] = {default: value, type: typeof value, require: false};
        } else {
            attributes[key].default = attributes[key].default || null;
            attributes[key].type = attributes[key].type || "string";
            attributes[key].require = attributes[key].require || false;
        }
    }

    let properties = {};
    for (let key in attributes) {
        properties[key.toString()] = {
            "get": function () {
                return this.data[key];
            },
            "set": function (val) {
                this.data[key] = val;
                if (this.onData && !this.__observerTrigged) {
                    this.__observerTrigged = true;
                    this.onData(key, this.data[key], this.data);
                    this.__observerTrigged = false;
                }
            }
        }
    }
    let subcollections = {};
    let prototypeSubcollections = {};
    for (let item of opts.subcollections) {
        item.path = `${name}/:${name}Id/${item.path}`;
        let subName = item.name.charAt(0).toUpperCase() + item.name.slice(1);
        prototypeSubcollections["create" + subName] = function (model, opts = {}) {
            let where = opts.where || {};
            where[`${name}Id`] = this.id;
            return item.create(model, {where});
        };
        prototypeSubcollections["update" + subName] = function (model, opts = {}) {
            let where = opts.where || {};
            where[`${name}Id`] = this.id;
            return item.update(model, {where});
        };
        prototypeSubcollections["delete" + subName] = function (opts = {}) {
            let where = opts.where || {};
            where[`${name}Id`] = this.id;
            return item.delete({where});
        };


        subcollections[subName] = item;
    }

    class Model {

        data = {};
        ref = undefined;
        __attributes = attributes;
        __old = {};

        constructor(model, ref) {
            if (model.constructor.name === "DocumentSnapshot" ||
                model.constructor.name === 'QueryDocumentSnapshot') {
                this.data = model.data();
                this.__old = model.data();
                this.ref = model.ref;
                this.id = model.id;
            } else {
                this.data = model;
                this.ref = ref;
                this.id = ref.id;
            }

            //set default values to non setted attributes
            for (let key in this.__attributes) {
                if (this.data[key] === undefined) {
                    this.data[key] = this.__attributes[key].default;
                }
            }

            //Add Getters/Setters to non mapped attributes
            if (opts.freeModel) {
                let newProperties = {};
                for (let key in this.data) {
                    if (this.__attributes[key] === undefined) {
                        newProperties[key] = {
                            "get": function () {
                                return this.data[key];
                            },
                            "set": function (value) {
                                this.data[key] = value;
                            }
                        }
                    }
                }
                Object.defineProperties(this, newProperties);
            }
        }

        destroy() {
            return this.ref.delete();
        }

        save() {
            return this.ref.update(this.data);
        };

        rollback() {
            return this.ref.set(this.__old);
        };

        static name = name;
        static path = "";
        static attributes = attributes;

        static getPath(o = {}) {
            let path = Model.path + Model.name;
            return path.replace(/:([^{}]*)\//g,
                function (a, b) {
                    let r = o[b];
                    return typeof r === 'string' || typeof r === 'number' ? r + '/' : a;
                }
            );
        }

        static create(model, opts = {where: {}}) {
            let where = opts.where || {};
            let formatedModel = Model.__formatModel(model, true);
            console.log('path', where);
            return admin.firestore().collection(Model.getPath(where))
                .add(formatedModel).then((snap) => {
                    return new Model(formatedModel, snap)
                });
        };

        static update = (model, opts = {where: {id: 0}}) => {
            let where = opts.where || {id: 0};
            let formatedModel = Model.__formatModel(model);
            for (let att in Model.attributes) {
                if (model[att] !== undefined) {
                    formatedModel[att] = model[att];
                }
            }

            if (!isDoc) {
                return admin.firestore().doc(Model.getPath(where)).update(formatedModel);
            }
            return admin.firestore().collection(Model.getPath(where)).doc(where.id).update(formatedModel);
        };
        static delete = ({where,} = {where: {}}) => {
            if (!isDoc) {
                return admin.firestore().doc(Model.getPath(where)).delete();
            }
            if (!where) {
                throw new Error("You will delete all Records in Collection")
            } else if (where.id) {
                return admin.firestore().collection(Model.getPath(where)).doc(where.id).delete();
            }
            let builder = admin.firestore().collection(Model.getPath(where));
            for (let item in where) {
                builder = builder.where(item, "==", where[item]);
            }
            return builder.limit(1).get().then((snap) => {
                let doc = snap.docs[0];
                if (doc) {
                    doc.ref.delete();
                }
            });
        };

        static findOne = ({where, order} = {}) => {
            where = where || {};
            order = order || [];
            if (!isDoc) {
                return admin.firestore().doc(Model.getPath(where)).get().then((snap) => querySnapToModel(snap));
            }
            let builder = admin.firestore();
            // if (!where) {
            //     return admin.firestore().collection(name).limit(1)
            //         .get().then((snap) => querySnapToModel(snap, true));
            if (where.id) {
                return admin.firestore().collection(Model.getPath(where)).doc(where.id).get()
                    .then((snap) => querySnapToModel(snap));
            }
            builder = builder.collection(name);
            for (let item in where) {
                if (!item.endsWith("Id")) {
                    builder = builder.where(item, "==", where[item]);
                }
            }
            for (let item of order) {
                builder = builder.orderBy(item[0], item[1] || "asc");
            }
            return builder.limit(1).get().then((snap) => querySnapToModel(snap, true));
        };
        static findAll = ({where, order} = {}) => {
            where = where || {};
            order = order || [];
            if (!isDoc) {
                return admin.firestore().doc(Model.getPath(where)).get()
                    .then((snap) => querySnapToModel(snap));
            }
            let builder = admin.firestore().collection(Model.getPath(where));
            for (let item in where) {
                if (!item.endsWith("Id")) {
                    builder.where(item, "==", where[item]);
                }
            }
            for (let item of order) {
                builder = builder.orderBy(item[0], item[1] || "asc");
            }
            return builder.get().then((doc) => {
                console.log(doc.docs);
                return querySnapToModel(doc);
            });
        };

        static sync() {
            return Model.findAll().then(result => {
                result.forEach(value => {
                    let data = value.data;
                    for (let att in Model.attributes) {
                        if (data[att] === undefined) {
                            data[att] = Model.attributes[att].default;
                        }
                    }
                    Model.update(data, {where: {id: value.id}}).then(() => {
                    });
                });
                return result;
            });

        };

        static __formatModel(model, require) {
            let formatedModel = opts.freeModel ? model : {};
            for (let att in Model.attributes) {
                if ((Model.attributes[att].required && model[att] === undefined) ||
                    (typeof model[att] !== Model.attributes[att].type && opts.validateType)) {
                    throw new Error("Field " + att + " required");
                } else if (model[att] === undefined) {
                    formatedModel[att] = Model.attributes[att].default;
                } else {
                    formatedModel[att] = model[att];
                }
                // } else if (require && opts.freeModel) {
                //     if (model[att] === undefined) {
                //         formatedModel[att] = Model.attributes[att].default;
                //     } else {
                //         formatedModel[att] = model[att];
                //     }
                // } else {
                //     if (model[att] !== undefined) {
                //         formatedModel[att] = model[att];
                //     }
                // }
            }
            return formatedModel;
        }
    }

    Object.defineProperties(Model.prototype, properties);
    Object.assign(Model.prototype, prototypeSubcollections);
    Object.assign(Model, subcollections);
    return Model;
}

module.exports = defineModel;