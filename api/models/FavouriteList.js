'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const FavouriteList = db.define('fav_list',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: Sequelize.STRING,
        created_by: Sequelize.INTEGER,
        updated_by: Sequelize.INTEGER,
        default : Sequelize.BOOLEAN
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = FavouriteList;