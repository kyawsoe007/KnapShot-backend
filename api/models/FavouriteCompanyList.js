'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const FavouriteCompanyList = db.define('fav_company_list',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: Sequelize.INTEGER,
        company_name: Sequelize.STRING,
        list_id: Sequelize.INTEGER,
        list_name: Sequelize.STRING,
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = FavouriteCompanyList;