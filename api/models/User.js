'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');

const Company = require('./Company');

const User = db.define('user',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        linkedin_id: Sequelize.STRING,
        firstname: Sequelize.STRING,
        lastname: Sequelize.STRING,
        contactnumber: Sequelize.STRING,
        password: Sequelize.STRING,
        email: Sequelize.STRING,
        accesslevel: Sequelize.STRING,
        username: Sequelize.STRING,
        forgotpassword: Sequelize.STRING,
        lastname: Sequelize.STRING,
        middlename: Sequelize.STRING,
        hqlocation: Sequelize.STRING,
        company_name: Sequelize.STRING,
        title: Sequelize.STRING,
        acc_created_data: Sequelize.DATE,
        last_log_in: Sequelize.DATE,
        plan_type: Sequelize.STRING,
        role: Sequelize.STRING,
        expire_date:Sequelize.DATE,
        coverage: Sequelize.STRING,
        confirmed: Sequelize.BOOLEAN,
        status: Sequelize.STRING
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);


module.exports = User;