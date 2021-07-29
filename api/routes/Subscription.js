'use strict';
module.exports = function (app) {

    var controller = require('../controllers/Subscription');

    app.route('/subscription/create')
        .post(controller.Create);
    app.route('/subscription/getAll')
        .get(controller.GetAll);

};




