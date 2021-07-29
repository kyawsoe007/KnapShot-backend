'use strict';
module.exports = function (app) {

    var controller = require('../controllers/User');

    app.route('/user/sign-in')
        .post(controller.SignIn);
    app.route('/user/create')
        .post(controller.Create);
    app.route('/user/getAllUserWithCompany')
        .get(controller.GetAllUserWithCompany);
    app.route('/user/getUserById/:id')
        .get(controller.GetUserByID);
    app.route('/user/delete')
        .post(controller.UserDelete);
    app.route('/user/confirm')
        .post(controller.UserConfirm);
    app.route('/user/getEmail')
        .get(controller.GetUserEmail);
    app.route('/user/reset')
        .post(controller.reset);
    app.route('/user/resetPassword')
        .post(controller.resetPassword);

};




