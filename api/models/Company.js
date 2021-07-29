'use strict';
const Sequelize = require('sequelize');
const SequelizePaginate = require('sequelize-paginate');

//model
const db = require('./db');
const PersonnelItem = require('./Personnel');
const Directory = require('./Directory');
const Expertise = require('./Expertise')
const Client = require('./Client')
const User = require('./User');


const Company = db.define('company',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        company_name: Sequelize.STRING,
        searchable: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        overall_knapshot_score: {
            type: Sequelize.FLOAT,
            allowNull: false,
            defaultValue: -1,
        },
        searchability_score: {
            type: Sequelize.FLOAT,
            allowNull: false,
            defaultValue: -1,
        },
        activity_score: {
            type: Sequelize.FLOAT,
            allowNull: false,
            defaultValue: -1,
        },
        consistency_score: {
            type: Sequelize.FLOAT,
            allowNull: false,
            defaultValue: -1,
        },
        dataset: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        description: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        company_status: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        has_funding: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        business_type: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        address: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        industry: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        industry_second_level: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        industry_third_level: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        company_email_address: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        main_line_number: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        organization_type: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        year_of_operation: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        year_in_operation: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        total_offices_region: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
        },
        total_offices_cop: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
        },
        main_hq_location: Sequelize.STRING,
        total_personnel: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: -1,
        },
        management: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
        },
        staff: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
        },
        website: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        no_of_directory_presence: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        digital_presence_analysis: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        spending: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        fax: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        agency_status: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        facebook: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        twitter: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        linkedIn: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        instagram: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        youtube: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        product_service: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        data_quality: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        partners: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        client_industries: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        asset: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        source: {
            type: Sequelize.STRING,
            allowNull: true
        },
        file_name: {
            type: Sequelize.STRING,
            allowNull: true
        },
        qc: {
            type: Sequelize.STRING,
            allowNull: true
        },
        choose_db: {
            type: Sequelize.STRING,
            allowNull: true
        },
        category: {
            type: Sequelize.STRING,
            allowNull: true
        },
        latitude: {
            type: Sequelize.STRING,
            allowNull: true
        },
        longitude: {
            type: Sequelize.STRING,
            allowNull: true
        },
        qc_date: {
            type: Sequelize.DATE,
            allowNull: true
        },
        digital_presence_score: {
            type: Sequelize.FLOAT,
            allowNull: true
        },
        technology_asset_score: {
            type: Sequelize.FLOAT,
            allowNull: true
        }
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);

Company.hasMany(PersonnelItem, { foreignKey: 'company_name', sourceKey: 'company_name' });
Company.hasMany(Directory, { foreignKey: 'company_name', sourceKey: 'company_name' });
Company.hasMany(Expertise, { foreignKey: 'company_name', sourceKey: 'company_name' });
Company.hasMany(Expertise, { foreignKey: 'dataset', sourceKey: 'dataset' });
// Company.hasMany(Expertise, {as: 'companyKey', foreignKey: 'company_name', sourceKey: 'company_name' });
// Company.hasMany(Expertise, {as: 'datasetKey', foreignKey: 'dataset', sourceKey: 'dataset' });
Company.hasMany(Client, { foreignKey: 'company_name', sourceKey: 'company_name' });
Company.belongsToMany(User, { as: 'Company', foreignKey: 'company_name', through: 'joined' });
User.belongsTo(Company, { as: 'Company', foreignKey: 'company_name', targetKey: 'company_name' })
// Company.hasMany(User, { foreignKey: 'company_name' })
// User.belongsTo(Company, { foreignKey: 'company_name' })

SequelizePaginate.paginate(Company);

module.exports = Company;