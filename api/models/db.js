'use strict';

const Sequelize = require('sequelize');
const config = require('../../config');

const db = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.pass, {
    host: config.database.host,
    dialect:
        'mysql',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    operatorsAliases: false,
    logging : false
    // logging: function (e) {
    //     console.log(e);
    // }
});

module.exports = db;