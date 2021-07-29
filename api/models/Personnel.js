'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const Personnel = db.define('personnel', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    personnel_name: Sequelize.STRING,
    title: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    linkedinUrl: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    role: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    seniority: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    company_name: Sequelize.STRING
}, {
    timestamps: false,
    freezeTableName: true,
});

module.exports = Personnel;