'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const Checker = db.define('checker_assign', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    company_id: Sequelize.INTEGER,
    company_data: Sequelize.STRING,
    company_data_update: Sequelize.STRING,
    start_date: Sequelize.DATE,
    end_date: Sequelize.DATE,
    assign_date: Sequelize.DATE,
    checker_id: Sequelize.INTEGER,
    verified: Sequelize.STRING,
    status: Sequelize.STRING,
    reason: Sequelize.STRING,
    missing: Sequelize.STRING,
    oldMissingCount: Sequelize.INTEGER,
    availible: Sequelize.STRING,
    oldAvailibleCount: Sequelize.INTEGER,
    missing_correct:Sequelize.STRING,
    missing_found:Sequelize.STRING
}, {
    timestamps: false,
    freezeTableName: true,
});

module.exports = Checker;