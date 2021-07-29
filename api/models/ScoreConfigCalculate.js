'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const ScoreConfigCalculate = db.define('score_config_calculate',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        score_config_id: Sequelize.INTEGER,
        score_config_name: Sequelize.STRING,
        company_name: Sequelize.STRING,
        score: Sequelize.FLOAT,
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = ScoreConfigCalculate;