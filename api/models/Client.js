'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const Client = db.define(
    'client',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        company_name: {
            type: Sequelize.STRING,
            // allowNull: true,
        },
        client_name: {
            type: Sequelize.STRING,
            // allowNull: true,
        },
        client_website: {
            type: Sequelize.STRING,
            // allowNull: true,
        },
        asset: {
            type: Sequelize.STRING,
            // allowNull: true,
        },
        spending: {
            type: Sequelize.DOUBLE,
            // allowNull: true,
        },
        dataset: {
            type: Sequelize.STRING,
            // defaultValue: ""
        },
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);

module.exports = Client;