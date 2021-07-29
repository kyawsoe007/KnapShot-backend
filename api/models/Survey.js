'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const SurveyResponse = db.define('survey', {
    id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    excel_file_name: Sequelize.STRING,
    question_identifier: Sequelize.STRING,
    question_type: Sequelize.STRING,
    question: Sequelize.STRING,
    responses: Sequelize.STRING,
    selection_type: Sequelize.STRING,
    created_at: Sequelize.DATE,
}, {
    timestamps: false,
    freezeTableName: true,
});

module.exports = SurveyResponse;