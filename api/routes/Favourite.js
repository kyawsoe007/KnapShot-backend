'use strict';
module.exports = function (app) {

    var controller = require('../controllers/Favourite');

    app.route('/createList')
        .post(controller.createList);
    app.route('/setDefaultFavList')
        .post(controller.setDefaultFavList);
    app.route('/removeDefaultFavList')
        .post(controller.removeDefaultFavList);
    app.route('/addCompToFavList')
        .post(controller.addCompanyToFavouriteList);
    app.route('/getListCount/:user_id')
        .get(controller.getListCount);
    app.route('/getDefaultFavList/:user_id')
        .get(controller.getDefaultFavList);
    app.route('/getLatestFavListId')
        .get(controller.getLatestFavListId);
    app.route('/setDefaultFavListByLastId')
        .post(controller.setDefaultFavListByLastId);
    app.route('/deleteListById')
        .post(controller.deleteListById);
    


};




