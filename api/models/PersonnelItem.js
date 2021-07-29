'use strict';
const Sequelize = require('sequelize');
const db = require('./db');

const PersonnelItem = db.define('personnel', {
    id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    personnel_name: Sequelize.STRING,
    title: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    dataset: Sequelize.STRING,
    phone: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    linkedinUrl: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    role: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    seniority: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    company_name: Sequelize.STRING,
    
    // overall_knapshot_score: {
    //     type: Sequelize.FLOAT,
    //     allowNull: false,
    //     defaultValue: -1,
    // },
    // industry: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
    // industry_second_level: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
    // industry_third_level: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
    // organization_type: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
    // year_in_operation: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
    // total_offices_region: {
    //     type: Sequelize.INTEGER,
    //     allowNull: false,
    //     defaultValue: -1,
    // },
    // main_hq_location_region: {
    //     type: Sequelize.STRING,
    //     allowNull: true,
    // },
}, {
    timestamps: false,
    freezeTableName: true,
});

module.exports = PersonnelItem;