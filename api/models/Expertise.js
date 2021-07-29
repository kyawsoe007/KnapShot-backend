'use strict';
const Sequelize = require('sequelize');
const db = require('./db');
const CompanyItem = require('./CompanyItem');

const Expertise = db.define('expertise',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        type: {
            type: Sequelize.STRING,
            // allowNull: true,
        },
        list: {
            type: Sequelize.STRING,
            // defaultValue: ""
        },
        dataset: {
            type: Sequelize.STRING,
            // defaultValue: ""
        },
        company_name: Sequelize.STRING
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = Expertise;