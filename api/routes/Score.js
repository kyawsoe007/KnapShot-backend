'use strict';
module.exports = function (app) {

    var controller = require('../controllers/Score');

    app.route('/createScoreList')
        .post(controller.createScoreList);
    app.route('/setDefaultScoreList')
        .post(controller.setDefaultScoreList);
    app.route('/removeDefaultScoreList')
        .post(controller.removeDefaultScoreList);
    // app.route('/addCompToScoreList')
    //     .post(controller.addCompanyToScoreList);

    app.route('/getScoreListCount/:user_id')
        .get(controller.getScoreListCount);
    app.route('/getConfigDataById/:configId')
        .get(controller.getConfigDataById);
    app.route('/getDefaultScoreList')
        .post(controller.getDefaultScoreList);
    app.route('/getLatestScoreListId')
        .get(controller.getLatestScoreListId);
    app.route('/setDefaultScoreListByLastId')
        .post(controller.setDefaultScoreListByLastId);
    app.route('/deleteScoreListById')
        .post(controller.deleteScoreListById);
    app.route('/addConfigToScoreList')
        .post(controller.addConfigToScoreList)
    app.route('/getConfigToScoreListId/:id')
        .get(controller.getConfigToScoreListId)

    app.route('/calculateScore')
        .post(controller.calculateScore)




};




