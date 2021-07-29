'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const ScoreList = db.define('score_list',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        score_name: Sequelize.STRING,
        created_by: Sequelize.INTEGER,
        updated_by: Sequelize.INTEGER,
        default : Sequelize.BOOLEAN,
        file_name: Sequelize.STRING,
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = ScoreList;