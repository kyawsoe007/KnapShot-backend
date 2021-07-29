'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const Survey = require('./Survey');
const Company = require('./Company')


let SurveyResponse = db.define('survey_response', {
    id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    surveyId: Sequelize.INTEGER,
    response_identifier: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    value: Sequelize.STRING,
    label: Sequelize.STRING,
    question_identifier: Sequelize.STRING,
    unique_identifier: Sequelize.STRING
}, {
    timestamps: false,
    freezeTableName: true,
});

// SurveyResponse.belongsToMany(Responses, { as: 'SurveyResponse_Responses',foreignKey: 'question_identifier',through: 'i'});
// Responses.belongsTo(SurveyResponse, { as: 'SurveyResponse_Responses', foreignKey: 'question_identifier', targetKey: 'question_identifier' })

// SurveyResponse.belongsToMany(SurveyResponseType, { as: 'SurveyResponseType_SurveyResponse',foreignKey: 'question_identifier',through: 'j'});
// SurveyResponseType.belongsTo(SurveyResponse, { as: 'SurveyResponseType_SurveyResponse', foreignKey: 'question_identifier', targetKey: 'question_identifier' })

// SurveyResponseType.belongsToMany(Responses, { as: 'Responses_SurveyResponseType',foreignKey: 'question_identifier',through: 'k'});
// Responses.belongsTo(SurveyResponseType, { as: 'Responses_SurveyResponseType', foreignKey: 'question_identifier', targetKey: 'question_identifier' })

let Joint = Survey.hasMany(SurveyResponse, {as: "survey_responses",onDelete: 'CASCADE'});
SurveyResponse.belongsTo(Survey, {as: "survey",onDelete: 'CASCADE'});
let Join = SurveyResponse.belongsTo(Company,{as: 'CompanySurvey',onDelete: 'CASCADE'})
// Company.hasMany(Survey,{as: 'company-survey',onDelete: 'CASCADE'})


// Responses.hasMany(SurveyResponse, { as: 'SurveyResponse_Responses'})

// SurveyResponse.hasMany(SurveyResponseType, { as: 'SurveyResponseType_SurveyResponse'});
// SurveyResponseType.hasMany(SurveyResponse, { as: 'SurveyResponseType_SurveyResponse'})

// SurveyResponseType.hasMany(Responses, { as: 'Responses_SurveyResponseType'});
// Responses.hasMany(SurveyResponseType, { as: 'Responses_SurveyResponseType'})

module.exports = {SurveyResponse,Joint,Join};