"use strict";
const Sequelize = require("sequelize");
const db = require("./db");
const PersonnelItem = require("./PersonnelItem");
const Directory = require("./Directory");
const Expertise = require("./Expertise");
const Client = require("./Client");
const FavouriteCompanyList = require("./FavouriteCompanyList");
const ScoreConfigCalculate = require("./ScoreConfigCalculate");

var path = require("path");
const fs = require("fs");

let rawdata = fs.readFileSync(path.join(__dirname, "/companyItem.json"));
let companyJson = JSON.parse(rawdata);

// let newColumn = {
//     "twitter_descrption": "Sequelize.STRING"
// };

// let newColumnArr = ["twitter_descrption"]

// for (let col of newColumnArr) {
//     companyJson[col] = "Sequelize.STRING"
// }

// let data = JSON.stringify(companyJson);
// fs.writeFileSync(path.join(__dirname, '/companyItem.json'), data);

const CompanyItem = db.define("company", companyJson, {
  timestamps: false,
  freezeTableName: true,
});

CompanyItem.hasMany(PersonnelItem, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});
CompanyItem.hasMany(Directory, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});
CompanyItem.hasMany(Expertise, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});
CompanyItem.hasMany(Client, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});
CompanyItem.hasMany(FavouriteCompanyList, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});
CompanyItem.hasMany(ScoreConfigCalculate, {
  foreignKey: "company_name",
  sourceKey: "company_name",
});

module.exports = CompanyItem;

// {
//     id: {
//         type: Sequelize.INTEGER,
//         primaryKey: true,
//         autoIncrement: true
//     },
//     company_name: Sequelize.STRING,
//     searchable: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     overall_knapshot_score: {
//         type: Sequelize.FLOAT,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     searchability_score: {
//         type: Sequelize.FLOAT,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     activity_score: {
//         type: Sequelize.FLOAT,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     consistency_score: {
//         type: Sequelize.FLOAT,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     dataset: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     description: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     company_status: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     has_funding: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     business_type: {
//         type: Sequelize.STRING,
//         allowNull: true,
//         defaultValue: '[]'
//     },
//     address: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     industry: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     industry_second_level: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     industry_third_level: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     company_email_address: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     main_line_number: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     organization_type: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     year_of_operation: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     year_in_operation: {
//         type: Sequelize.INTEGER,
//         allowNull: true,
//     },
//     total_offices_region: {
//         type: Sequelize.INTEGER,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     total_offices_cop: {
//         type: Sequelize.INTEGER,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     main_hq_location: Sequelize.STRING,
//     total_personnel: {
//         type: Sequelize.STRING,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     min_emp: {
//         type: Sequelize.INTEGER,
//         allowNull: true,
//         defaultValue: 0,
//     },
//     max_emp: {
//         type: Sequelize.INTEGER,
//         allowNull: true,
//         defaultValue: 0,
//     },
//     management: {
//         type: Sequelize.INTEGER,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     staff: {
//         type: Sequelize.INTEGER,
//         allowNull: false,
//         defaultValue: -1,
//     },
//     website: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     no_of_directory_presence: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     digital_presence_analysis: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     digital_presence_score: {
//         type: Sequelize.FLOAT,
//         allowNull: true
//     },
//     technology_asset_score: {
//         type: Sequelize.FLOAT,
//         allowNull: true
//     },
//     spending: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     fax: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     agency_status: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     facebook: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     twitter: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     linkedIn: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     youtube: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     instagram: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     product_service: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     data_quality: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     partners: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     client_industries: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     asset: {
//         type: Sequelize.STRING,
//         allowNull: true,
//     },
//     source: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     file_name: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     latitude: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     category: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     // revenue:{
//     //     type: Sequelize.DOUBLE,
//     //     allowNull: true
//     // },
//     longitude: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     countries_of_presence: {
//         type: Sequelize.STRING,
//         allowNull: true
//     },
//     qc_date: {
//         type: Sequelize.DATE,
//         allowNull: true
//     },

//     facebook_like: Sequelize.STRING,
//     facebook_follower: Sequelize.STRING,
//     instagram_post: Sequelize.STRING,
//     instagram_follower: Sequelize.STRING,
//     twitter_follower: Sequelize.STRING,
//     youtube_subscriber: Sequelize.STRING,
//     city_presence: {
//         type: Sequelize.STRING,
//         defaultValue: '[]'
//     },
//     country_presence: {
//         type: Sequelize.STRING,
//         defaultValue: '[]'
//     },
//     facebook_desc: Sequelize.STRING,
//     instragram_desc: Sequelize.STRING,
//     linkedin_desc: Sequelize.STRING,
//     youtube_desc: Sequelize.STRING,
//     twitter_desc: Sequelize.STRING,

// },
