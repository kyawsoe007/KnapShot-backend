'use strict';
module.exports = function (app) {
    var analyzeController = require('../controllers/Analyze');

    // app.route('/missingFields')
    //     .get(analyzeController.missingFields);
    // app.route('/exportCompaniesExcel')
    //     .get(analyzeController.exportCompaniesExcel);
    // app.route('/updateScore')
    //     .get(analyzeController.updateScore);
    // app.route('/updateIndustry')
    //     .get(analyzeController.updateIndustry);
    // app.route('/totalFilename')
    //     .get(analyzeController.totalFileNames);
    app.route('/totalCountry')
        .post(analyzeController.totalCountry);
    app.route('/totalPersonnel')
        .post(analyzeController.totalPersonnel);
    app.route('/totalCompanyStaff')
        .post(analyzeController.totalCompanyStaff);
    app.route('/totalHQLocation')
        .post(analyzeController.totalHQLocation);
    app.route('/totalIndustry')
        .post(analyzeController.totalIndustry);
    app.route('/totalDigitalEngagement')
        .post(analyzeController.totalDigitalEngagement);
    app.route('/industryBreakDown')
        .post(analyzeController.industryBreakDown);
    // app.route('/setLatLng')
    //     .post(analyzeController.setLatLng);
    // app.route('/getCoordinates')
    //     .post(analyzeController.getCoordinates);
    // app.route('/readCoordinate')
    //     .get(analyzeController.readCoordinateFile);
    // app.route('/getDigitalEngagementOfCountry')
    //     .post(analyzeController.getDigitalEngagementOfCountry);
    // app.route('/getDigitalPresentByCountry')
    //     .post(analyzeController.getDigitalPresentByCountry);
    // app.route('/getDigitalPresentByIndustry')
    //     .post(analyzeController.getDigitalPresentByIndustry);
    app.route('/getEndUserTechnology')
        .post(analyzeController.getEndUserTechnology);
    app.route('/getProviderTechnology')
        .post(analyzeController.getProviderTechnology);
    app.route('/getTechnologyCountryView')
        .post(analyzeController.getTechnologyCountryView);
    app.route('/totalTechnology')
        .post(analyzeController.totalTechnology);
    app.route('/uploadPersonnels')
        .post(analyzeController.uploadPersonnels);
    app.route('/digitalPresenceFilter')
        .post(analyzeController.digitalPresenceFilter);
    app.route('/digitalEngagementSelect')
        .post(analyzeController.digitalEngagementSelect);
    app.route('/getDigitalFootprint')
        .post(analyzeController.getDigitalFootprint);
    app.route('/totalTechnologySelect')
        .post(analyzeController.totalTechnologySelect);
    app.route('/getRespondentSummary')
        .get(analyzeController.getRespondentSummary);
    app.route('/getQuestionRespondent')
        .get(analyzeController.getQuestionRespondent);
    app.route('/getExcelFileNames')
        .get(analyzeController.getExcelFileNames);
    app.route('/getOverlayData')
        .post(analyzeController.getOverlayData);
    app.route('/getCompanyByOverlay')
        .post(analyzeController.getCompanyByOverlay);
    app.route('/getCompanySurveyId')
        .post(analyzeController.getCompanySurveyId);
    app.route('/excelExport')
        .get(analyzeController.excelExport);
    app.route('/newExcelExport')
        .post(analyzeController.newExcelExport);
    app.route('/priorityScoreExport')
        .get(analyzeController.priorityScoreExport);
    app.route('/getKeywordsByCompany')
        .post(analyzeController.getKeywordsByCompany);
    // app.route('/getIndustryNameByCountry')
    //     .post(analyzeController.getIndustryNameByCountry);
    // app.route('/getIndustryAndDigitalType')
    //     .post(analyzeController.getIndustryAndDigitalType);
    app.route('/getCompanyExpertiseData')
        .post(analyzeController.getCompanyExpertiseData);
    app.route('/getCompanyClientAwardData')
        .post(analyzeController.getCompanyClientAwardData);
    app.route('/getCompanyPersonnelData')
        .post(analyzeController.getCompanyPersonnelData);
    app.route('/getUserTechnologyData')
        .post(analyzeController.getUserTechnologyData);
    app.route('/getCompanyNames')
        .post(analyzeController.getCompanyNames);
    app.route('/getTotalPartners')
        .post(analyzeController.getTotalPartners);
    app.route('/getTotalExpertise')
        .post(analyzeController.getTotalExpertise);
    app.route('/getTotalCategory')
        .post(analyzeController.getTotalCategory);
    app.route('/getTotalYearInOperation')
        .post(analyzeController.getTotalYearInOperation);
    app.route('/getTotalEmpSize')
        .post(analyzeController.getTotalEmpSize);
    app.route('/getTotalDigitalEngagement')
        .post(analyzeController.getTotalDigitalEngagement);
    app.route('/getTotalProductService')
        .post(analyzeController.getTotalProductService);
    app.route('/getMaxYearIO')
        .post(analyzeController.getMaxYearIO);
    app.route('/getYearIOByRange')
        .post(analyzeController.getYearIOByRange);
    app.route('/getMaxEmpSize')
        .post(analyzeController.getMaxEmpSize);
    app.route('/getEmpSizeByRange')
        .post(analyzeController.getEmpSizeByRange);
    app.route('/getCompanyNamesExpertise')
        .post(analyzeController.getCompanyNamesExpertise);

};
