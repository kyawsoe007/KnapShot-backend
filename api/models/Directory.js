'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const Directory = db.define(
    'directory',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        directory: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        link: {
            type: Sequelize.STRING,
            defaultValue: ""
        },
        company_name: Sequelize.STRING
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);

module.exports = Directory;