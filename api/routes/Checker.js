'use strict';
module.exports = function (app) {

    var controller = require('../controllers/Checker');

    app.route('/createChecker')
        .post(controller.Create)
    app.route('/getCheckerCounts')
        .post(controller.GetCheckerCounts)
    app.route('/getCheckerByLastAssign')
        .post(controller.GetCheckerByLastAssign)
    app.route('/checkerUpdate')
        .post(controller.Update)



};




