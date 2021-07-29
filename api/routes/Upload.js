'use strict';
module.exports = function (app) {
    var uploadController = require('../controllers/Upload');
    app.route('/import/companies')
        .post(uploadController.importCompanies);
    app.route('/upload/companies')
        .post(uploadController.uploadCompanies);
    app.route('/upload/quesResp')
        .post(uploadController.uploadQuestionResp);
    app.route('/downloadSampleCompany')
        .get(uploadController.downloadSampleCompany);
    app.route('/downloadSamplePersonnel')
        .get(uploadController.downloadSamplePersonnel);
    app.route('/upload/techno')
        .post(uploadController.uploadTechno);
    app.route('/upload/googleIndoCompanies')
        .post(uploadController.uploadGoogleIndonesiaCompanies);
    app.route('/upload/uploadExpertise')
        .post(uploadController.uploadExpertise);
    app.route('/upload/uploadClientTechno')
        .post(uploadController.uploadClientTechno);
    app.route('/upload/uploadCompanyExcel')
        .post(uploadController.uploadCompanyExcel);
    app.route('/upload/oldUploadCompanyExcel')
        .post(uploadController.oldUploadCompanyExcel);

    app.route('/upload/companyColumnCreate')
        .post(uploadController.companyColumnCreate);

    app.route('/upload/importUploadedCompanyExcel')
        .post(uploadController.importUploadedCompanyExcel);
    app.route('/upload/importTechnology')
        .post(uploadController.importTechnology);
    app.route('/upload/importExpertise')
        .post(uploadController.importExpertise);
    app.route('/upload/uploadExpertiseExcel')
        .post(uploadController.uploadExpertiseExcel);
    app.route('/upload/uploadTechnoExcel')
        .post(uploadController.uploadTechnoExcel);
    app.route('/upload/uploadClientTechnoExcel')
        .post(uploadController.uploadClientTechnoExcel);
    app.route('/upload/importClientTechno')
        .post(uploadController.importClientTechno);
    app.route('/upload/uploadDirectory')
        .post(uploadController.uploadDirectory);
    app.route('/upload/importDirectory')
        .post(uploadController.importDirectory);
    app.route('/upload/uploadPersonnel')
        .post(uploadController.uploadPersonnel);
    app.route('/upload/importPersonnel')
        .post(uploadController.importPersonnel);
    app.route('/upload/uploadClient')
        .post(uploadController.uploadClient);
    app.route('/upload/importClient')
        .post(uploadController.importClient);
    app.route('/upload/uploadNameChanges')
        .post(uploadController.uploadNameChanges);
    app.route('/upload/importNameChanges')
        .post(uploadController.importNameChanges);
    app.route('/upload/empSizeDataStandardize')
        .post(uploadController.empSizeDataStandardize);
    app.route('/upload/empSizeMinMaxSeparate')
        .post(uploadController.empSizeMinMaxSeparate);
    app.route('/upload/importPartner')
        .post(uploadController.importPartner);
    app.route('/upload/uploadPartnerExcel')
        .post(uploadController.uploadPartnerExcel);
    app.route('/upload/importProductService')
        .post(uploadController.importProductService);
    app.route('/upload/uploadProductService')
        .post(uploadController.uploadProductService);


}; 
