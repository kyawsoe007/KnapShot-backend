'use strict';
module.exports = function (app) {

    var controller = require('../controllers/Company');

    app.route('/companies')
        .post(controller.getAll);

    // app.route('/companiesByFilter')
    //     .post(controller.getCompanyByFilter);

    app.route('/companies/name/:id')
        .get(controller.getCompanyByName);

    app.route('/companies/search')
        .get(controller.search);

    app.route('/companies/search/engine')
        .get(controller.searchEngine);

    app.route('/companies/search/engineStatus')
        .get(controller.searchEngineStatus);

    app.route('/companies/search/engineResult')
        .get(controller.searchEngineResult);

    app.route('/companies/datasets')
        .get(controller.getAllDatasets);

    app.route('/companies/delete')
        .get(controller.deleteByName);

    app.route('/companies/deleteAll')
        .get(controller.deleteAllCompanies);

    app.route('/companies/getAllLocations')
        .post(controller.getAllLocations);

    app.route('/companies/getGeoData')
        .get(controller.getGeoData);

    app.route('/companies/getFilenames')
        .get(controller.getFileNames);

    app.route('/env')
        .get(controller.checkEnv);

    app.route('/updateScore')
        .get(controller.updateScore);

    app.route('/setLatLng')
        .get(controller.setLatLng);

    app.route('/personnels')
        .post(controller.uploadPersonnelInfo);

    app.route('/getCompanyByMultiIDs')
        .post(controller.getCompanyByMultiIDs)
    app.route('/getFileNamesFromDB')
        .get(controller.getFileNamesFromDB)
    app.route('/updateFileNamesFromDB')
        .post(controller.updateFileNamesFromDB)
};