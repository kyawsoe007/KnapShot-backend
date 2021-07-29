'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const FavouriteCompanyList = db.define('score_config',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: Sequelize.INTEGER,
        list_id: Sequelize.INTEGER,
        list_name: Sequelize.STRING,
        lower_range: Sequelize.INTEGER,
        upper_range: Sequelize.INTEGER,
        percent: Sequelize.STRING,
        score: Sequelize.STRING,
        score_percent: Sequelize.STRING,
        selected_value: Sequelize.STRING,
        fileName: Sequelize.STRING
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = FavouriteCompanyList;