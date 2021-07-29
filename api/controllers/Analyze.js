'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const axios = require('axios');
const XLSX = require('xlsx');
const formidable = require('formidable');

//models
const db = require('../models/db');
const Company = require('../models/Company');
const CompanyItem = require('../models/CompanyItem');
const Expertise = require('../models/Expertise')
const Personnel = require('../models/Personnel');
const Directory = require("../models/Directory");
const PersonnelItem = require("../models/PersonnelItem");
const FavouriteCompanyList = require("../models/FavouriteCompanyList");
const ScoreConfig = require("../models/ScoreConfig");
const ScoreConfigCalculate = require("../models/ScoreConfigCalculate");
const Client = require('../models/Client');
const { SurveyResponse, Joint, Join } = require('../models/SurveyResponse')
const Survey = require('../models/Survey')
const ScoreList = require('../models/ScoreList');

//util
const paginate = require('../utils/pagination');
const ThreeLevelIterator = require('../utils/ThreeLevelIterator');

//constants
const typeCategoryPair = require('../constants/keyValues');
const keyValues = require('../constants/keyValuesMap');
const keyValuesPair = require('../constants/keyValuesPair');
const keyValuesPair2 = require('../constants/keyValuesPair2');
const productServicePair = require('../constants/productServicePair');

//config
const config = require('../../config');

const TechnologyArr = ['Advertising', 'Analytics and Tracking', 'Ecommerce', 'Widget', 'Hosting', 'Productivity']
const path = require('path')

// const excelExports = require('node-excel-export');
// const xlsx = require("node-xlsx");
// var FileSaver = require('file-saver');
// var Blob = require('node-blob');
// var atob = require('atob');
const XlsxPopulate = require('xlsx-populate');
const { set, filter } = require('lodash');
XlsxPopulate.Promise = Promise;



function getQueryCondition({ min, max, selectValue }) {
    if (selectValue === '-') return { [Op.and]: [{ [Op.gte]: min }, { [Op.lte]: max }] }
    else if (selectValue === '<') return { [Op.lt]: max }
    else return { [Op.gt]: min }
}

function arr_diff(a1, a2) {

    var a = [], diff = [];

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true;
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]];
        } else {
            a[a2[i]] = true;
        }
    }

    for (var k in a) {
        diff.push(k);
    }

    return diff;
}

function processBrand(obj, brand) {
    if (!obj[brand]) {
        obj[brand] = 1
    }
    obj[brand]++

    return obj
}

function filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter) {
    return COMP.map(x => {
        let { asset, directories } = x.dataValues
        directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))
        let dirObj = { default: 0 }
        for (let directory in directories) {
            if (!directories.hasOwnProperty(directory)) continue;
            let dirName = directories[directory].directory
            dirObj[dirName] = dirObj[dirName] ? dirObj[dirName] + 1 : 1
        }
        let totalMaxDir = Math.max(...Object.values(dirObj))
        let assets = JSON.parse(asset)
        let total = {}
        if (assets) for (var category in assets) {
            if (!assets.hasOwnProperty(category)) continue;
            if (!keyValues[category]) continue;

            var types = assets[category];
            for (var type in types) {
                if (!types.hasOwnProperty(type)) continue;
                if (!keyValues[category].includes(type)) continue;


                var brands = [...new Set(types[type])];
                for (var j = 0; j < brands.length; j++) {
                    var brand = brands[j];

                    total[category] = total[category] ? total[category] : {};

                    var total_type = total[category];
                    total_type[type] = total_type[type] ? total_type[type] : [];

                    total[category][type].push(brand)
                }
            }
        }
        let clone = assetDataProcess(total)

        // data change
        x.dataValues.asset = JSON.stringify(clone);
        x.dataValues.totalMaxDir = totalMaxDir;
        return x;

    }).filter(value => {
        let { asset } = value.dataValues
        let assets = JSON.parse(asset);

        if (assets && restrictTechnologyFilter && Object.keys(restrictTechnologyFilter).length) {

            let restrictTechnologyFilterIterator = ThreeLevelIterator(restrictTechnologyFilter)
            let pass = true;


            for (let row of restrictTechnologyFilterIterator) {
                let { f_key, s_key, t_key } = row;
                if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {
                    pass = false;
                    break;
                }
            }
            return pass;
        }
        return true;
    }).filter(value => {
        let { asset } = value.dataValues
        let assets = JSON.parse(asset);


        if (assets && technologyFilter && Object.keys(technologyFilter).length) {

            let technologyFilterIterator = ThreeLevelIterator(technologyFilter)
            let pass = false;


            for (let row of technologyFilterIterator) {
                let { f_key, s_key, t_key } = row;
                if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {
                    pass = true;
                    break;
                }
            }
            return pass;
        }
        return true;
    }).filter(row => {
        let { totalMaxDir } = row.dataValues
        // checkingTotal.push(totalMaxDir)
        if (digitalPresenceFilter && digitalPresenceFilter.directory) {
            let arr = digitalPresenceFilter.directory
            let numberArr = []
            for (let index in arr) {
                if (!arr.hasOwnProperty(index)) continue;


                if (arr[index] === '0 Presence') numberArr.push(0)
                else if (arr[index] === '1 - 2') numberArr.push(1, 2)
                else if (arr[index] === '3 - 5') numberArr.push(3, 4, 5)
                else if (arr[index] === '>6') for (var i = 6; i < 50; i++) numberArr.push(i)
                // else false
            }
            if (numberArr.includes(totalMaxDir)) return true
            else return false
        }
        return true
    });
}

function newFilterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter) {
    return COMP.map(x => {
        let { asset, directories } = x.dataValues
        directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))
        let dirObj = { default: 0 }
        for (let directory in directories) {
            if (!directories.hasOwnProperty(directory)) continue;
            let dirName = directories[directory].directory
            dirObj[dirName] = dirObj[dirName] ? dirObj[dirName] + 1 : 1
        }
        let totalMaxDir = Math.max(...Object.values(dirObj))
        let assets = JSON.parse(asset)
        let total = {}
        if (assets) for (var category in assets) {
            if (!assets.hasOwnProperty(category)) continue;
            if (!keyValuesPair2[category]) continue;

            var types = assets[category];
            for (var type in types) {
                if (!types.hasOwnProperty(type)) continue;
                if (!keyValuesPair2[category].includes(type)) continue;


                var brands = [...new Set(types[type])];
                for (var j = 0; j < brands.length; j++) {
                    var brand = brands[j];

                    total[category] = total[category] ? total[category] : {};

                    var total_type = total[category];
                    total_type[type] = total_type[type] ? total_type[type] : [];

                    total[category][type].push(brand)
                }
            }
        }
        let clone = assetDataProcess(total)

        // data change
        x.dataValues.asset = JSON.stringify(clone);
        x.dataValues.totalMaxDir = totalMaxDir;
        return x;

    }).filter(value => {
        let { asset } = value.dataValues
        let assets = JSON.parse(asset);

        if (assets && restrictTechnologyFilter && Object.keys(restrictTechnologyFilter).length) {

            let restrictTechnologyFilterIterator = ThreeLevelIterator(restrictTechnologyFilter)
            let pass = true;


            for (let row of restrictTechnologyFilterIterator) {
                let { f_key, s_key, t_key } = row;
                if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {
                    pass = false;
                    break;
                }
            }
            return pass;
        }
        return true;
    }).filter(value => {
        let { asset } = value.dataValues
        let assets = JSON.parse(asset);


        if (assets && technologyFilter && Object.keys(technologyFilter).length) {

            let technologyFilterIterator = ThreeLevelIterator(technologyFilter)
            let pass = false;


            for (let row of technologyFilterIterator) {
                let { f_key, s_key, t_key } = row;
                if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {
                    pass = true;
                    break;
                }
            }
            return pass;
        }
        return true;
    }).filter(row => {
        let { totalMaxDir } = row.dataValues
        // checkingTotal.push(totalMaxDir)
        if (digitalPresenceFilter && digitalPresenceFilter.directory) {
            let arr = digitalPresenceFilter.directory
            let numberArr = []
            for (let index in arr) {
                if (!arr.hasOwnProperty(index)) continue;


                if (arr[index] === '0 Presence') numberArr.push(0)
                else if (arr[index] === '1 - 2') numberArr.push(1, 2)
                else if (arr[index] === '3 - 5') numberArr.push(3, 4, 5)
                else if (arr[index] === '>6') for (var i = 6; i < 50; i++) numberArr.push(i)
                // else false
            }
            if (numberArr.includes(totalMaxDir)) return true
            else return false
        }
        return true
    });
}

function noneCompanyFilterFunction(COMP, digitalPresenceFilter) {
    return COMP.map(x => {
        let { directories } = x.dataValues
        directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))
        let dirObj = { default: 0 }
        for (let directory in directories) {
            if (!directories.hasOwnProperty(directory)) continue;
            let dirName = directories[directory].directory
            dirObj[dirName] = dirObj[dirName] ? dirObj[dirName] + 1 : 1
        }
        let totalMaxDir = Math.max(...Object.values(dirObj))

        // data change
        x.dataValues.totalMaxDir = totalMaxDir;
        return x;

    }).filter(row => {
        let { totalMaxDir } = row.dataValues
        if (digitalPresenceFilter && digitalPresenceFilter.directory) {
            let arr = digitalPresenceFilter.directory
            let numberArr = []
            for (let index in arr) {
                if (!arr.hasOwnProperty(index)) continue;

                if (arr[index] === '0 Presence') numberArr.push(0)
                else if (arr[index] === '1 - 2') numberArr.push(1, 2)
                else if (arr[index] === '3 - 5') numberArr.push(3, 4, 5)
                else if (arr[index] === '>6') for (var i = 6; i < 50; i++) numberArr.push(i)
            }
            if (numberArr.includes(totalMaxDir)) return true
            else return false
        }
        return true
    });
}

function AssetDP(obj) {
    let clone = { ...obj }
    if (Object.keys(clone).length) {

        if (clone.Ecommerce && clone.Payment && Object.keys(clone.Ecommerce).length && Object.keys(clone.Payment).length) {
            clone.Ecommerce = {
                ...clone.Ecommerce,
                ...obj.Payment
            }
            delete clone.Payment
        }

        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["Ad Analytics"] && Object.keys(clone["Analytics and Tracking"]["Ad Analytics"]).length) {
                clone.Advertising = {
                    ...clone.Advertising,
                    "Ad Analytics": { ...clone["Analytics and Tracking"]["Ad Analytics"] },
                }
            }
        }


        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["CRM"] && Object.keys(clone["Analytics and Tracking"]["CRM"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "CRM": { ...clone["Analytics and Tracking"]["CRM"] },
                }
                delete clone["Analytics and Tracking"]["CRM"]
            }

            if (clone["Analytics and Tracking"]["Lead Generation"] && Object.keys(clone["Analytics and Tracking"]["Lead Generation"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Lead Generation": { ...clone["Analytics and Tracking"]["Lead Generation"] },
                }
                delete clone["Analytics and Tracking"]["Lead Generation"]
            }

            if (clone["Analytics and Tracking"]["Product Recommendations"] && Object.keys(clone["Analytics and Tracking"]["Product Recommendations"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Product Recommendations": { ...clone["Analytics and Tracking"]["Product Recommendations"] },
                }
                delete clone["Analytics and Tracking"]["Product Recommendations"]
            }

            if (clone["Analytics and Tracking"]["Feedback Forms and Surveys"] && Object.keys(clone["Analytics and Tracking"]["Feedback Forms and Surveys"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Feedback Forms and Surveys": { ...clone["Analytics and Tracking"]["Feedback Forms and Surveys"] },
                }
                delete clone["Analytics and Tracking"]["Feedback Forms and Surveys"]
            }
        }

        if (clone["Email Hosting Providers"]) {
            if (clone["Email Hosting Providers"]["Campaign Management"] && Object.keys(clone["Email Hosting Providers"]["Campaign Management"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Campaign Management": { ...clone["Email Hosting Providers"]["Campaign Management"] },
                }
                delete clone["Email Hosting Providers"]["Campaign Management"]
            }
            if (clone["Email Hosting Providers"]["Business Email Hosting"] && Object.keys(clone["Email Hosting Providers"]["Business Email Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Business Email Hosting": { ...clone["Email Hosting Providers"]["Business Email Hosting"] },
                }
                delete clone["Email Hosting Providers"]["Business Email Hosting"]
            }
            if (clone["Email Hosting Providers"]["Web Hosting Provider Email"] && Object.keys(clone["Email Hosting Providers"]["Web Hosting Provider Email"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Web Hosting Provider Email": { ...clone["Email Hosting Providers"]["Web Hosting Provider Email"] },
                }
                delete clone["Email Hosting Providers"]["Web Hosting Provider Email"]
            }
            if (clone["Email Hosting Providers"]["Marketing Platform"] && Object.keys(clone["Email Hosting Providers"]["Marketing Platform"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Marketing Platform": { ...clone["Email Hosting Providers"]["Marketing Platform"] },
                }
                delete clone["Email Hosting Providers"]["Marketing Platform"]
            }
        }

        if (clone["Web Hosting Providers"]) {
            if (clone["Web Hosting Providers"]["Cloud PaaS"] && Object.keys(clone["Web Hosting Providers"]["Cloud PaaS"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud PaaS": { ...clone["Web Hosting Providers"]["Cloud PaaS"] },
                }
                delete clone["Web Hosting Providers"]["Cloud PaaS"]
            }
            if (clone["Web Hosting Providers"]["Cloud Hosting"] && Object.keys(clone["Web Hosting Providers"]["Cloud Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud Hosting": { ...clone["Web Hosting Providers"]["Cloud Hosting"] },
                }
                delete clone["Web Hosting Providers"]["Cloud Hosting"]
            }
            if (clone["Web Hosting Providers"]["Dedicated Hosting"] && Object.keys(clone["Web Hosting Providers"]["Dedicated Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Dedicated Hosting": { ...clone["Web Hosting Providers"]["Dedicated Hosting"] },
                }
                delete clone["Web Hosting Providers"]["Dedicated Hosting"]
            }
        }


        if (clone["Widgets"] && clone["Widgets"]["Marketing Automation"] && Object.keys(clone["Widgets"]["Marketing Automation"]).length) {
            clone.Productivity = {
                ...clone.Productivity,
                "Marketing Automation": { ...clone["Widgets"]["Marketing Automation"] },
            }
            delete clone["Widgets"]["Marketing Automation"]
        }
    }
    return clone
}

function AssetDPForUserTechnology(obj) {
    let clone = { ...obj }
    if (Object.keys(clone).length) {

        if (clone.Ecommerce && clone.Payment && Object.keys(clone.Ecommerce).length && Object.keys(clone.Payment).length) {
            clone.Ecommerce = {
                ...clone.Ecommerce,
                ...obj.Payment
            }
            delete clone.Payment
        }

        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["Ad Analytics"] && Object.keys(clone["Analytics and Tracking"]["Ad Analytics"]).length) {
                clone.Advertising = {
                    ...clone.Advertising,
                    "Ad Analytics": [...clone["Analytics and Tracking"]["Ad Analytics"]],
                }
            }
        }


        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["CRM"] && Object.keys(clone["Analytics and Tracking"]["CRM"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "CRM": [...clone["Analytics and Tracking"]["CRM"]],
                }
                delete clone["Analytics and Tracking"]["CRM"]
            }

            if (clone["Analytics and Tracking"]["Lead Generation"] && Object.keys(clone["Analytics and Tracking"]["Lead Generation"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Lead Generation": [...clone["Analytics and Tracking"]["Lead Generation"]],
                }
                delete clone["Analytics and Tracking"]["Lead Generation"]
            }

            if (clone["Analytics and Tracking"]["Product Recommendations"] && Object.keys(clone["Analytics and Tracking"]["Product Recommendations"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Product Recommendations": [...clone["Analytics and Tracking"]["Product Recommendations"]],
                }
                delete clone["Analytics and Tracking"]["Product Recommendations"]
            }

            if (clone["Analytics and Tracking"]["Feedback Forms and Surveys"] && Object.keys(clone["Analytics and Tracking"]["Feedback Forms and Surveys"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Feedback Forms and Surveys": [...clone["Analytics and Tracking"]["Feedback Forms and Surveys"]],
                }
                delete clone["Analytics and Tracking"]["Feedback Forms and Surveys"]
            }
        }

        if (clone["Email Hosting Providers"]) {
            if (clone["Email Hosting Providers"]["Campaign Management"] && Object.keys(clone["Email Hosting Providers"]["Campaign Management"]).length) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Campaign Management": [...clone["Email Hosting Providers"]["Campaign Management"]],
                }
                delete clone["Email Hosting Providers"]["Campaign Management"]
            }
            if (clone["Email Hosting Providers"]["Business Email Hosting"] && Object.keys(clone["Email Hosting Providers"]["Business Email Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Business Email Hosting": [...clone["Email Hosting Providers"]["Business Email Hosting"]],
                }
                delete clone["Email Hosting Providers"]["Business Email Hosting"]
            }
            if (clone["Email Hosting Providers"]["Web Hosting Provider Email"] && Object.keys(clone["Email Hosting Providers"]["Web Hosting Provider Email"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Web Hosting Provider Email": [...clone["Email Hosting Providers"]["Web Hosting Provider Email"]],
                }
                delete clone["Email Hosting Providers"]["Web Hosting Provider Email"]
            }
            if (clone["Email Hosting Providers"]["Marketing Platform"] && Object.keys(clone["Email Hosting Providers"]["Marketing Platform"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Marketing Platform": [...clone["Email Hosting Providers"]["Marketing Platform"]],
                }
                delete clone["Email Hosting Providers"]["Marketing Platform"]
            }
        }

        if (clone["Web Hosting Providers"]) {
            if (clone["Web Hosting Providers"]["Cloud PaaS"] && Object.keys(clone["Web Hosting Providers"]["Cloud PaaS"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud PaaS": [...clone["Web Hosting Providers"]["Cloud PaaS"]],
                }
                delete clone["Web Hosting Providers"]["Cloud PaaS"]
            }
            if (clone["Web Hosting Providers"]["Cloud Hosting"] && Object.keys(clone["Web Hosting Providers"]["Cloud Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud Hosting": [...clone["Web Hosting Providers"]["Cloud Hosting"]],
                }
                delete clone["Web Hosting Providers"]["Cloud Hosting"]
            }
            if (clone["Web Hosting Providers"]["Dedicated Hosting"] && Object.keys(clone["Web Hosting Providers"]["Dedicated Hosting"]).length) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Dedicated Hosting": [...clone["Web Hosting Providers"]["Dedicated Hosting"]],
                }
                delete clone["Web Hosting Providers"]["Dedicated Hosting"]
            }
        }


        if (clone["Widgets"] && clone["Widgets"]["Marketing Automation"] && Object.keys(clone["Widgets"]["Marketing Automation"]).length) {
            clone.Productivity = {
                ...clone.Productivity,
                "Marketing Automation": [...clone["Widgets"]["Marketing Automation"]],
            }
            delete clone["Widgets"]["Marketing Automation"]
        }
    }
    delete clone["Web Hosting Providers"]
    delete clone["Email Hosting Providers"]
    return clone
}

function assetDataProcess(obj) {
    let clone = { ...obj }
    if (Object.keys(clone).length) {

        if (clone.Ecommerce && clone.Payment) {
            clone.Ecommerce = {
                ...clone.Ecommerce,
                ...obj.Payment
            }
        }

        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["Ad Analytics"]) {
                clone.Advertising = {
                    ...clone.Advertising,
                    "Ad Analytics": clone["Analytics and Tracking"]["Ad Analytics"],
                }
            }
        }

        if (clone["Analytics and Tracking"]) {
            if (clone["Analytics and Tracking"]["CRM"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "CRM": clone["Analytics and Tracking"]["CRM"],
                }
            }

            if (clone["Analytics and Tracking"]["Lead Generation"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Lead Generation": clone["Analytics and Tracking"]["Lead Generation"],
                }
            }

            if (clone["Analytics and Tracking"]["Product Recommendations"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Product Recommendations": clone["Analytics and Tracking"]["Product Recommendations"],
                }
            }

            if (clone["Analytics and Tracking"]["Feedback Forms and Surveys"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Feedback Forms and Surveys": clone["Analytics and Tracking"]["Feedback Forms and Surveys"],
                }
            }
        }

        if (clone["Email Hosting Providers"]) {
            if (clone["Email Hosting Providers"]["Campaign Management"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Campaign Management": clone["Email Hosting Providers"]["Campaign Management"],
                }
            }
            if (clone["Email Hosting Providers"]["Business Email Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Business Email Hosting": clone["Email Hosting Providers"]["Business Email Hosting"],
                }
            }
            if (clone["Email Hosting Providers"]["Web Hosting Provider Email"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Web Hosting Provider Email": clone["Email Hosting Providers"]["Web Hosting Provider Email"],
                }
            }
            if (clone["Email Hosting Providers"]["Marketing Platform"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Marketing Platform": clone["Email Hosting Providers"]["Marketing Platform"],
                }
            }
        }

        if (clone["Web Hosting Providers"]) {
            if (clone["Web Hosting Providers"]["Cloud PaaS"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud PaaS": clone["Web Hosting Providers"]["Cloud PaaS"],
                }
            }
            if (clone["Web Hosting Providers"]["Cloud Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud Hosting": clone["Web Hosting Providers"]["Cloud Hosting"],
                }
            }
            if (clone["Web Hosting Providers"]["Dedicated Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Dedicated Hosting": clone["Web Hosting Providers"]["Dedicated Hosting"],
                }
            }
        }


        if (clone["Widgets"] && clone["Widgets"]["Marketing Automation"]) {
            clone.Productivity = {
                ...clone.Productivity,
                "Marketing Automation": clone["Widgets"]["Marketing Automation"],
            }
        }
    }
    // if (clone) {
    //     const _return = { ...clone }
    //     // delete _return["Payment"]
    //     // delete _return["Analytics and Tracking"]["CRM"]
    //     // delete _return["Analytics and Tracking"]["Lead Generation"]
    //     // delete _return["Analytics and Tracking"]["Product Recommendations"]
    //     // delete _return["Analytics and Tracking"]["Feedback Forms and Surveys"]
    //     // delete _return["Email Hosting Providers"]["Campaign Management"]
    //     // delete _return["Email Hosting Providers"]["Business Email Hosting"]
    //     // delete _return["Email Hosting Providers"]["Web Hosting Provider Email"]
    //     // delete _return["Email Hosting Providers"]["Marketing Platform"]
    //     // delete _return["Web Hosting Providers"]["Cloud Paas"]
    //     // delete _return["Web Hosting Providers"]["Cloud Hosting"]
    //     // delete _return["Web Hosting Providers"]["Dedicated Hosting"]
    //     // delete _return["Widgets"]["Marketing Automation"]
    //     // return _return
    // }

    return clone
}

const trimArray = array => array.map(string => string.trim())

exports.totalDigitalEngagement = async function (req, res) {

    let file_name = req.body.file_name;
    let dataset = req.body.dataset;
    let frimographicFilter = req.body.frimographicFilter;
    let digitalPresenceFilter = req.body.digitalPresenceFilter;
    // let technologyFilter = req.body.searchedBrandsFilter ? req.body.searchedBrandsFilter : req.body.technologyFilter
    let technologyFilter = req.body.technologyFilter
    let restrictTechnologyFilter = req.body.restrictTechnologyFilter
    // const otherCompanyIds = req.body.searchedBrandsFilter ? null : req.body.otherCompanyIds
    const otherCompanyIds = req.body.otherCompanyIds
    const { expertiseCompanyFilter, categoryFilter, empSizeFilter, yearIOFilter } = req.body;
    let maxValue, minValue, selectorValue
    let whereFilter = [{ dataset }];

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }
    let result = [], results = {}, totalArr = [], mainData = [], otherCompanies = []

    let basic = 0;
    let intermediate = 0;
    let high = 0;
    let advance = 0;

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substring(1)
    }

    try {
        const companies = await CompanyItem.findAll({
            where: {
                [Op.and]: whereFilter
            },
            attributes: ["id", "asset", "industry", "overall_knapshot_score", "dataset"],
            include: [
                { model: Directory }
            ]
        }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter
        ))

        if (technologyFilter && Array.isArray(otherCompanyIds) && otherCompanyIds.length) {
            otherCompanies = await Company.findAll({
                where: { id: { [Op.or]: otherCompanyIds } },
                attributes: ["overall_knapshot_score", "dataset"],
                include: [
                    { model: Directory }
                ],
            }).then(COMP => {
                return COMP.map(x => {
                    let { directories } = x.dataValues
                    directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))
                    let dirObj = { default: 0 }
                    for (let directory in directories) {
                        if (!directories.hasOwnProperty(directory)) continue;
                        let dirName = directories[directory].directory
                        dirObj[dirName] = dirObj[dirName] ? dirObj[dirName] + 1 : 1
                    }
                    let totalMaxDir = Math.max(...Object.values(dirObj))

                    // data change
                    x.dataValues.totalMaxDir = totalMaxDir;
                    return x;

                }).filter(row => {
                    let { totalMaxDir } = row.dataValues
                    if (digitalPresenceFilter && digitalPresenceFilter.directory) {
                        let arr = digitalPresenceFilter.directory
                        let numberArr = []
                        for (let index in arr) {
                            if (!arr.hasOwnProperty(index)) continue;

                            if (arr[index] === '0 Presence') numberArr.push(0)
                            else if (arr[index] === '1 - 2') numberArr.push(1, 2)
                            else if (arr[index] === '3 - 5') numberArr.push(3, 4, 5)
                            else if (arr[index] === '>6') for (var i = 6; i < 50; i++) numberArr.push(i)
                        }
                        if (numberArr.includes(totalMaxDir)) return true
                        else return false
                    }
                    return true
                });
            })
        }

        // console.log("comp", companies.length)
        // console.log("otherCompanies", otherCompanies.length)
        mainData = [...companies, ...otherCompanies]

        // console.log("check data", mainData.length, companies.length, otherCompanies.length)

        if (mainData) {
            for (let i = 0; i < mainData.length; i++) {
                let score = mainData[i].overall_knapshot_score;
                let dataset = capitalize(mainData[i].dataset);


                // if (score < 2) basic += 1;
                // if (score >= 2 && score < 5) intermediate += 1;
                // if (score >= 5 && score < 8) high += 1;
                // if (score >= 8) advance += 1;

                if (!results[dataset]) results[dataset] = {}
                if (!results[dataset].count) results[dataset].count = 0
                if (!results[dataset].basic) results[dataset].basic = 0
                if (!results[dataset].intermediate) results[dataset].intermediate = 0
                if (!results[dataset].high) results[dataset].high = 0
                if (!results[dataset].advance) results[dataset].advance = 0

                if (score < 2) {
                    results[dataset].basic += 1;
                    basic += 1;
                }
                if (score >= 2 && score < 5) {
                    results[dataset].intermediate += 1;
                    intermediate += 1;
                }
                if (score >= 5 && score < 8) {
                    results[dataset].high += 1;
                    high += 1;
                }
                if (score >= 8) {
                    results[dataset].advance += 1;
                    advance += 1;
                }

                results[dataset].count += 1;
            }
        }

        result.push(
            { label: "Basic", count: basic },
            { label: "Intermediate", count: intermediate },
            { label: "High", count: high },
            { label: "Advanced", count: advance },
        );

        return res.status(200).json({
            message: "Successful",
            data: result,
            dataByCountry: results,
            count: mainData.length,
            techno: technologyFilter
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.industryBreakDown = async function (req, res) {

    const datasetName = req.body.dataset;
    const industryNames = req.body.industries;
    const digitalNames = req.body.digitals;
    const fileName = req.body.file_name;
    let technologyFilter = req.body.technologyFilter;
    let restrictTechnologyFilter = req.body.restrictTechnologyFilter
    let digitalPresenceFilter = req.body.digitalPresenceFilter;
    let otherCompanyIds = req.body.otherCompanyIds

    let totalIndustries = [];
    let results = [];


    try {
        for (let i = 0; i < industryNames.length; i++) {

            let obj = {
                label: industryNames[i],
                count: 0,
                basic: 0,
                intermediate: 0,
                high: 0,
                advanced: 0
            };

            let industryQuery = [
                { industry: industryNames[i] },
                { dataset: datasetName }
            ];
            let basicQuery = [
                { overall_knapshot_score: { [Op.lt]: 2 } },
                { dataset: datasetName },
                { industry: industryNames[i] }
            ];
            let intermediateQuery = [
                { overall_knapshot_score: { [Op.gte]: 2 } },
                { overall_knapshot_score: { [Op.lt]: 5 } },
                { industry: industryNames[i] },
                { dataset: datasetName }
            ];
            let highQuery = [
                { overall_knapshot_score: { [Op.gte]: 5 } },
                { overall_knapshot_score: { [Op.lt]: 8 } },
                { industry: industryNames[i] },
                { dataset: datasetName }
            ];
            let advancedQuery = [
                { overall_knapshot_score: { [Op.gte]: 8 } },
                { industry: industryNames[i] },
                { dataset: datasetName },
            ];

            if (fileName !== "Master DB (Golden Source)") {
                industryQuery.push({ file_name: fileName });
                basicQuery.push({ file_name: fileName });
                intermediateQuery.push({ file_name: fileName });
                highQuery.push({ file_name: fileName });
                advancedQuery.push({ file_name: fileName });
            }

            let industries, otherCompanies

            industries = await CompanyItem.findAll({
                where: { [Op.and]: industryQuery },
                // attributes: ["id", "asset", "industry"],
                include: [
                    { model: Directory }
                ]
            }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter));

            if (industries) {

                totalIndustries.push({ name: industryNames[i], count: industries.length });
                obj.count = industries.length;

                if (digitalNames.indexOf("Basic") >= 0) {
                    let basic = await Company.findAll({
                        where: { [Op.and]: basicQuery },
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter));
                    obj.basic = basic.length;
                }

                if (digitalNames.indexOf("Intermediate") >= 0) {
                    let intermediate = await Company.findAll({
                        where: { [Op.and]: intermediateQuery },
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter));
                    obj.intermediate = intermediate.length;
                }

                if (digitalNames.indexOf("High") >= 0) {
                    let high = await Company.findAll({
                        where: { [Op.and]: highQuery },
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter));
                    obj.high = high.length;
                }

                if (digitalNames.indexOf("Advanced") >= 0) {
                    let advance = await Company.findAll({
                        where: { [Op.and]: advancedQuery },
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter));
                    obj.advanced = advance.length;
                }

                results.push(obj);
            }

            if (technologyFilter && Array.isArray(otherCompanyIds)) {
                otherCompanies = await CompanyItem.findAll({
                    where: { [Op.and]: [{ id: { [Op.or]: otherCompanyIds } }, { industry: industryNames[i] }] },
                    attributes: ["overall_knapshot_score", "dataset"],
                    include: [
                        { model: Directory }
                    ],
                }).then(COMP => noneCompanyFilterFunction(COMP, digitalPresenceFilter))
            }

            if (otherCompanies) {
                totalIndustries[totalIndustries.length - 1].count += otherCompanies.length
                obj.count += otherCompanies.length;

                if (digitalNames.indexOf("Basic") >= 0) {
                    let basic = await Company.findAll({
                        where: { [Op.and]: basicQuery.concat({ id: { [Op.or]: otherCompanyIds } }) },
                        attributes: ["id"],
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => noneCompanyFilterFunction(COMP, digitalPresenceFilter))
                    obj.basic += basic.length;
                    for (let i in basic) {
                        if (!basic.hasOwnProperty(i)) continue;
                        if (!obj.id) obj.id = {}
                        if (!obj.id.basic) obj.id.basic = []
                        obj.id.basic.push(basic[i].dataValues.id)
                    }
                }

                if (digitalNames.indexOf("Intermediate") >= 0) {
                    let intermediate = await Company.findAll({
                        where: { [Op.and]: intermediateQuery.concat({ id: { [Op.or]: otherCompanyIds } }) },
                        attributes: ["id"],
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => noneCompanyFilterFunction(COMP, digitalPresenceFilter))
                    obj.intermediate += intermediate.length;
                    for (let i in intermediate) {
                        if (!intermediate.hasOwnProperty(i)) continue;
                        if (!obj.id) obj.id = {}
                        if (!obj.id.intermediate) obj.id.intermediate = []
                        obj.id.intermediate.push(intermediate[i].dataValues.id)
                    }
                }

                if (digitalNames.indexOf("High") >= 0) {
                    let high = await Company.findAll({
                        where: { [Op.and]: highQuery.concat({ id: { [Op.or]: otherCompanyIds } }) },
                        attributes: ["id"],
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => noneCompanyFilterFunction(COMP, digitalPresenceFilter))
                    obj.high += high.length;
                    // for (let i in high) {
                    //     if (!high.hasOwnProperty(i)) continue;
                    //     // if (!obj.id) obj.id = {}
                    //     // if (!obj.id.high) obj.id.high = []
                    //     // obj.id.high.push(high[i].dataValues.id)
                    // }
                }

                if (digitalNames.indexOf("Advanced") >= 0) {
                    let advance = await Company.findAll({
                        where: { [Op.and]: advancedQuery.concat({ id: { [Op.or]: otherCompanyIds } }) },
                        attributes: ["id"],
                        include: [
                            { model: Directory }
                        ]
                    }).then(COMP => noneCompanyFilterFunction(COMP, digitalPresenceFilter))
                    obj.advanced += advance.length;
                    // for (let i in advance) {
                    //     if (!advance.hasOwnProperty(i)) continue;
                    //     // if (!obj.id) obj.id = {}
                    //     // if (!obj.id.advance) obj.id.advance = []
                    //     // obj.id.advance.push(advance[i].dataValues.id)
                    // }
                }
            }
        }

        return res.status(200).json({
            message: "Successful",
            results: results,
            totalIndustries: totalIndustries
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getDigitalPresentByCountry = async function (req, res) {

    const dataset = req.body.datasets;
    const filename = req.body.fileName;

    let results = {};

    let types = [
        {
            type: "Basic",
            query: {
                overall_knapshot_score: {
                    [Op.lt]: 2
                }
            }
        },
        {
            type: "Intermediate",
            query: {
                overall_knapshot_score: {
                    [Op.gte]: 2
                },
                overall_knapshot_score: {
                    [Op.lt]: 5
                },
            }
        },
        {
            type: "High",
            query: {
                overall_knapshot_score: {
                    [Op.gte]: 5
                },
                overall_knapshot_score: {
                    [Op.lt]: 8
                },
            }
        },
        {
            type: "Advanced",
            query: {
                overall_knapshot_score: {
                    [Op.gte]: 8
                },
            }
        }
    ];

    if (filename !== "Master DB (Golden Source)") {
        types.map(t => {
            t["query"] = { ...t["query"], file_name: filename };
        });
    }

    try {
        for (let j = 0; j < types.length; j++) {

            const count = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        types[j].query
                    ]
                }
            });

            const noUrl_noDirPsc_noSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.eq]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.lte]: 0
                            }
                        },
                        {
                            [Op.and]: [
                                {
                                    facebook: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.eq]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            const noUrl_hasDirPsc_noSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.eq]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.gt]: 0
                            }
                        },
                        {
                            [Op.and]: [
                                {
                                    facebook: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.eq]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            const noUrl_hasDirPsc_hasSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.eq]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.gt]: 0
                            }
                        },
                        {
                            [Op.or]: [
                                {
                                    facebook: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.ne]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            const hasUrl_noDirPsc_noSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.ne]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.lte]: 0
                            }
                        },
                        {
                            [Op.or]: [
                                {
                                    facebook: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.eq]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            const hasUrl_hasDirPsc_noSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.ne]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.gt]: 0
                            }
                        },
                        {
                            [Op.and]: [
                                {
                                    facebook: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.eq]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.eq]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            const hasUrl_hasDirPsc_hasSocial = await CompanyItem.count({
                where: {
                    [Op.and]: [
                        {
                            dataset: dataset
                        },
                        {
                            website: {
                                [Op.ne]: null
                            }
                        },
                        {
                            no_of_directory_presence: {
                                [Op.gt]: 0
                            }
                        },
                        {
                            [Op.or]: [
                                {
                                    facebook: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    linkedIn: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    twitter: {
                                        [Op.ne]: null
                                    }
                                },
                                {
                                    instagram: {
                                        [Op.ne]: null
                                    }
                                }
                            ]
                        },
                        types[j].query
                    ]
                }
            });

            results[types[j]["type"]] = [
                types[j]["type"],
                count,
                noUrl_noDirPsc_noSocial,
                noUrl_hasDirPsc_noSocial,
                noUrl_hasDirPsc_hasSocial,
                hasUrl_noDirPsc_noSocial,
                hasUrl_hasDirPsc_noSocial,
                hasUrl_hasDirPsc_hasSocial
            ];
        }
        return res.status(200).json({ message: 'Successful', results: results });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

exports.totalIndustry = async function (req, res) {

    let dataset = req.body.dataset;
    let file_name = req.body.file_name;

    let industryName = [];
    let totalIndustry = 0;
    let industries;

    try {
        if (file_name !== "Master DB (Golden Source)") {
            industries = await db.query(
                `SELECT IF(industry IS NULL OR industry = '', 'Not Available', industry) industry, COUNT(1) as count FROM company WHERE dataset IN(:datasets) and file_name LIKE :file_name GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset, file_name: file_name },
                    type: db.QueryTypes.SELECT
                }
            );
        } else {
            industries = await db.query(
                `SELECT IF(industry IS NULL OR industry = '', 'Not Available', industry) industry, COUNT(1) as count FROM company WHERE dataset IN(:datasets) GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset },
                    type: db.QueryTypes.SELECT
                }
            );
        }

        for (let i = 0; i < industries.length; i++) {
            industryName.push(industries[i].industry);
            totalIndustry += industries[i].count
        }

        return res.status(200).json({
            message: "Successful",
            results: {
                industries: industries,
                totalIndustry: totalIndustry,
                industryName: industryName
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.totalCountry = async function (req, res) {

    let countries = {};
    let countryName = [];
    let totalCountry = 0;

    const file_name = req.body.file_name;
    const companyFilter = req.body.companyFilter;
    let maxValue, minValue, selectorValue
    const { user_id, categoryFilter, empSizeFilter, yearIOFilter, partnerFilter,
        digitalEngagementFilter, company_id, userFavCompFilter, productServiceFilter } = req.body;

    let whereFilter = [];

    let digitalEngagementFilterArr = [], totalCompanyFilter = []

    if (file_name) whereFilter.push({ file_name });

    if (company_id) whereFilter.push({ id: company_id });

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]

    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]

    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilter.push({ company_name: totalCompanyFilter });

    // if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }


    try {
        await CompanyItem.findAll({
            include: [
                // Expertise,PersonnelItem
                {
                    model: Expertise,
                    required: false,
                    where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                },
                {
                    model: PersonnelItem,
                },
                {
                    model: FavouriteCompanyList,
                    // where: { user_id: parseInt(user_id) },
                }
            ],
            where: { [Op.and]: whereFilter },
            // attributes : ["dataset"],
            order: [
                ['company_name', 'ASC'],
            ],
        }).then(async resp => {

            resp.forEach(async data => {
                let company = data.dataValues
                let dataset = data.dataValues.dataset
                let expertise = data.dataValues.expertises
                let total_personnel = data.dataValues.total_personnel




                if (productServiceFilter && productServiceFilter.length) {
                    var index = productServiceFilter.indexOf("Blank");
                    const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                    if (!company.product_service && index !== -1) {

                    }
                    else {
                        if (!company.product_service) return false
                        if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                    }
                }
                if (partnerFilter && partnerFilter.length) {
                    var index = partnerFilter.indexOf("Blank");
                    for (let single of expertise) {
                        let list = single.dataValues.list
                        if (list === "-") {
                            if (index == "-1") return false
                        }
                        else {
                            let subPartners = []
                            Object.keys(JSON.parse(list)).map(key =>
                                JSON.parse(list)[key].map(subKey => {
                                    let trimSubKey = subKey.trim()
                                    subPartners.push(trimSubKey)
                                }))
                            if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                        }
                    }
                }


                totalCountry++
                if (!countries[dataset]) countries[dataset] = 0
                countries[dataset]++

            });

            let resVal = []

            Object.keys(countries).map(country => resVal.push({ "dataset": country, "count": countries[country] }))

            return res.status(200).json({
                message: "Successful",
                results: {
                    country: resVal,
                    countryName: Object.keys(countries),
                    totalCountry: totalCountry,
                }
            });
        })
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }



    // try {

    //     // if (filename !== "Master DB (Golden Source)") {
    //     //     countries = await db.query(
    //     //         `SELECT dataset, COUNT(1) as count FROM company WHERE file_name LIKE :filename GROUP BY dataset ORDER BY count DESC`,
    //     //         {
    //     //             replacements: { filename: filename },
    //     //             type: db.QueryTypes.SELECT
    //     //         }
    //     //     );
    //     // } else {
    //     //     countries = await db.query(
    //     //         `SELECT dataset, COUNT(1) as count FROM company GROUP BY dataset ORDER BY count DESC`,
    //     //         {
    //     //             type: db.QueryTypes.SELECT
    //     //         }
    //     //     );
    //     // }

    //     for (let i = 0; i < countries.length; i++) {
    //         countryName.push(countries[i].dataset);
    //         totalCountry += countries[i].count;
    //     }

    //     return res.status(200).json({
    //         message: "Successful",
    //         results: {
    //             country: countries,
    //             countryName: countryName,
    //             totalCountry: totalCountry,
    //         }
    //     });

    // } catch (error) {
    //     return res.status(500).json({ message: error.message });
    // }
}

exports.totalPersonnel = async function (req, res) {

    let dataset = req.body.dataset;
    let file_name = req.body.file_name;


    let personnelName = [];
    let totalPersonnel = 0;
    let personnel;

    try {
        if (file_name !== "Master DB (Golden Source)") {
            personnel = await db.query(
                `SELECT IF(total_Personnel IS NULL OR total_Personnel = '' OR total_Personnel = '-1', 'Not Available', total_Personnel) total_Personnel, COUNT(1) as count FROM company WHERE dataset IN(:datasets) and file_name LIKE :file_name GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset, file_name: file_name },
                    type: db.QueryTypes.SELECT
                }
            );
        } else {
            personnel = await db.query(
                `SELECT IF(total_Personnel IS NULL OR total_Personnel = '', 'Not Available', total_Personnel) total_Personnel, COUNT(1) as count FROM company WHERE dataset IN(:datasets) GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset },
                    type: db.QueryTypes.SELECT
                }
            );
        }

        for (let i = 0; i < personnel.length; i++) {

            personnelName.push(personnel[i].total_Personnel);
            totalPersonnel += personnel[i].count
        }

        return res.status(200).json({
            message: "Successful",
            results: {
                personnel: personnel,
                totalPersonnel: totalPersonnel,
                personnelName: personnelName
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.totalCompanyStaff = async function (req, res) {

    let dataset = req.body.dataset;
    let file_name = req.body.file_name;


    let personnelName = [];
    let totalPersonnel = 0;
    let personnel;

    let whereFilter = [{ dataset }];
    let CompData = [{ label: "Company with Staff", count: 0, company_name: [] }, { label: "Company without Staff", count: 0, company_name: [] }]

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    try {
        const personnel = await Company.findAll({
            where: {
                [Op.and]: whereFilter
            },
            attributes: ["company_name"],
            include: [
                { model: PersonnelItem }
            ]
        }).then(COMP => {
            COMP.map(x => {
                const { company_name, personnels } = x.dataValues
                if (personnels.length > 0) {
                    CompData[0].count += 1
                    CompData[0].company_name.push(company_name)
                }
                else {
                    CompData[1].count += 1
                    CompData[1].company_name.push(company_name)
                }
            })
        })

        for (let i = 0; i < CompData.length; i++) {

            personnelName.push(CompData[i].label);
            totalPersonnel += CompData[i].count
        }

        return res.status(200).json({
            message: "Successful",
            results: {
                personnel: CompData,
                totalPersonnel: totalPersonnel,
                personnelName: personnelName
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.totalHQLocation = async function (req, res) {

    let dataset = req.body.dataset;
    let file_name = req.body.file_name;


    let HQLocationName = [];
    let totalHQLocation = 0;
    let HQLocation;

    try {
        if (file_name !== "Master DB (Golden Source)") {
            HQLocation = await db.query(
                `SELECT IF(main_hq_location IS NULL OR main_hq_location = '', 'Not Available', main_hq_location) main_hq_location, COUNT(1) as count FROM company WHERE dataset IN(:datasets) and file_name LIKE :file_name GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset, file_name: file_name },
                    type: db.QueryTypes.SELECT
                }
            );
        } else {
            HQLocation = await db.query(
                `SELECT IF(main_hq_location IS NULL OR main_hq_location = '', 'Not Available', main_hq_location) main_hq_location, COUNT(1) as count FROM company WHERE dataset IN(:datasets) GROUP BY 1 ORDER BY count DESC`,
                {
                    replacements: { datasets: dataset },
                    type: db.QueryTypes.SELECT
                }
            );
        }

        for (let i = 0; i < HQLocation.length; i++) {
            HQLocationName.push(HQLocation[i].main_hq_location);
            totalHQLocation += HQLocation[i].count
        }


        return res.status(200).json({
            message: "Successful",
            results: {
                HQLocation: HQLocation,
                totalHQLocation: totalHQLocation,
                HQLocationName: HQLocationName
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getEndUserTechnology = async function (req, res) {

    const datasets = req.body.datasets;
    const filename = req.body.fileName;

    let technologies = [
        "All Technology",
        "Advertising",
        "Analytics and Tracking",
        "Ecommerce",
        "Payment",
        "Widgets"
    ];

    let data = {
        "All Technology": [],
        "Advertising": [],
        "Analytics and Tracking": [],
        "Ecommerce": [],
        "Payment": [],
        "Widgets": []
    };

    let header = {
        "Advertising": ["Country", "Total Company", "Ad Network", "ads txt", "Contextual Advertising", "Ad Exchange", "Facebook Exchange", "Retargeting / Remarketing"],
        "Analytics and Tracking": ["Country", "Total Company", "Conversion Optimization", "Tag Management", "Advertiser Tracking", "Audience Measurement", "Lead Generation", "Marketing Automation"],
        "Ecommerce": ["Country", "Total Company", "Non Platform", "Hosted Solution", "Open Source", "Multi-Channel", "Enterprise", "SMB Solution"],
        "Payment": ["Country", "Total Company", "Payments Processor", "Payment Acceptance", "Payment Currency", "Checkout Buttons", "PP, PA, PC, CO", "PA & PC CO"],
        "Widgets": ["Country", "Total Company", "Live Chat", "Customer Login", "Social Sharing", "Schedule Management", "Ticketing System", "Bookings"],
        "All Technology": ["Country", "Total Company", "Advertising", "SEO", "Analytics", "E-commerce", "Payments", "Widgets"]
    }

    try {
        for (let i = 0; i < datasets.length; i++) {

            let companies;

            if (filename !== "Master DB (Golden Source)") {
                companies = await CompanyItem.findAll({
                    attributes: ["asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            },
                            {
                                filename: fileName
                            }
                        ]
                    }
                });
            } else {
                companies = await CompanyItem.findAll({
                    attributes: ["asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            }
                        ]
                    }
                });
            }

            let adNetwork = 0;
            let adsTxt = 0;
            let contextualAds = 0;
            let adExchange = 0;
            let fbExchange = 0;
            let retargetingAds = 0;

            let conversionOpt = 0;
            let tagMng = 0;
            let adsTracking = 0;
            let audienceMeasurement = 0;
            let leadGeneration = 0;
            let marketAutomation = 0;

            let nonPlatform = 0;
            let hostedSolution = 0;
            let openSource = 0;
            let multiChannel = 0;
            let enterprise = 0;
            let smbSolution = 0;

            let payProcessor = 0;
            let payAcceptance = 0;
            let payCurrency = 0;
            let checkOurButton = 0;
            let PPPAPCCO = 0;
            let PAPCCO = 0;

            let liveChat = 0;
            let customerLogin = 0;
            let socialSharing = 0;
            let scheduleManagement = 0;
            let ticketingSystem = 0;
            let bookings = 0;

            let totalAdvertisingCount = 0;
            let totalSEOCount = 0;
            let totalAnalyticsCount = 0;
            let totalEcommerceCount = 0;
            let totalPaymentCount = 0;
            let totalWidgetsCount = 0;

            for (let j = 0; j < companies.length; j++) {

                let jsonObj = JSON.parse(companies[j]["asset"]);

                if (jsonObj !== null) {

                    if (jsonObj["Advertising"] !== undefined) {
                        totalAdvertisingCount += 1;
                        if (jsonObj["Advertising"]["Ad Network"] !== undefined) adNetwork += 1;
                        if (jsonObj["Advertising"]["ads txt"] !== undefined) adsTxt += 1;
                        if (jsonObj["Advertising"]["Contextual Advertising"] !== undefined) contextualAds += 1;
                        if (jsonObj["Advertising"]["Ad Exchange"] !== undefined) adExchange += 1;
                        if (jsonObj["Advertising"]["Facebook Exchange"] !== undefined) fbExchange += 1;
                        if (jsonObj["Advertising"]["Retargeting / Remarketing"] !== undefined) retargetingAds += 1;
                    }

                    if (jsonObj["Analytics and Tracking"] !== undefined) {
                        totalAnalyticsCount += 1;
                        if (jsonObj["Analytics and Tracking"]["Conversion Optimization"] !== undefined) conversionOpt += 1;
                        if (jsonObj["Analytics and Tracking"]["Tag Management"] !== undefined) tagMng += 1;
                        if (jsonObj["Analytics and Tracking"]["Advertiser Tracking"] !== undefined) adsTracking += 1;
                        if (jsonObj["Analytics and Tracking"]["Audience Measurement"] !== undefined) audienceMeasurement += 1;
                        if (jsonObj["Analytics and Tracking"]["Lead Generation"] !== undefined) leadGeneration += 1;
                        if (jsonObj["Analytics and Tracking"]["Marketing Automation"] !== undefined) marketAutomation += 1;
                    }

                    if (jsonObj["Ecommerce"] !== undefined) {
                        totalEcommerceCount += 1;
                        if (jsonObj["Ecommerce"]["Non Platform"] !== undefined) nonPlatform += 1;
                        if (jsonObj["Ecommerce"]["Hosted Solution"] !== undefined) hostedSolution += 1;
                        if (jsonObj["Ecommerce"]["Open Source"] !== undefined) openSource += 1;
                        if (jsonObj["Ecommerce"]["Multi-Channel"] !== undefined) multiChannel += 1;
                        if (jsonObj["Ecommerce"]["Enterprise"] !== undefined) enterprise += 1;
                        if (jsonObj["Ecommerce"]["SMB Solution"] !== undefined) smbSolution += 1;
                    }

                    if (jsonObj["Payment"] !== undefined) {
                        totalPaymentCount += 1;
                        if (jsonObj["Payment"]["Payments Processor"] !== undefined) payProcessor += 1;
                        if (jsonObj["Payment"]["Payment Acceptance"] !== undefined) payAcceptance += 1;
                        if (jsonObj["Payment"]["Payment Currency"] !== undefined) payCurrency += 1;
                        if (jsonObj["Payment"]["Checkout Buttons"] !== undefined) checkOurButton += 1;

                        if (jsonObj["Payment"]["Payment Acceptance"] !== undefined &&
                            jsonObj["Payment"]["Payment Currency"] !== undefined &&
                            jsonObj["Payment"]["Checkout Buttons"] !== undefined
                        ) {
                            PAPCCO += 1;
                        }

                        if (jsonObj["Payment"]["Payments Processor"] !== undefined &&
                            jsonObj["Payment"]["Payment Acceptance"] !== undefined &&
                            jsonObj["Payment"]["Payment Currency"] !== undefined &&
                            jsonObj["Payment"]["Checkout Buttons"] !== undefined
                        ) {
                            PPPAPCCO += 1;
                        }

                    }

                    if (jsonObj["Widgets"] !== undefined) {
                        totalWidgetsCount += 1;
                        if (jsonObj["Widgets"]["Live Chat"] !== undefined) liveChat += 1;
                        if (jsonObj["Widgets"]["Login"] !== undefined) customerLogin += 1;
                        if (jsonObj["Widgets"]["Social Sharing"] !== undefined) socialSharing += 1;
                        if (jsonObj["Widgets"]["Schedule Management"] !== undefined) scheduleManagement += 1;
                        if (jsonObj["Widgets"]["Ticketing System"] !== undefined) ticketingSystem += 1;
                        if (jsonObj["Widgets"]["Bookings"] !== undefined) bookings += 1;
                    }
                }
            }

            let adsObj = {};
            adsObj["Total Company"] = totalAdvertisingCount;
            adsObj["Country"] = datasets[i];
            adsObj["Ad Network"] = isNaN(Math.round((adNetwork / totalAdvertisingCount) * 100)) ? 0 : Math.round((adNetwork / totalAdvertisingCount) * 100);
            adsObj["ads txt"] = isNaN(Math.round((adsTxt / totalAdvertisingCount) * 100)) ? 0 : Math.round((adsTxt / totalAdvertisingCount) * 100);
            adsObj["Contextual Advertising"] = isNaN(Math.round((contextualAds / totalAdvertisingCount) * 100)) ? 0 : Math.round((contextualAds / totalAdvertisingCount) * 100);
            adsObj["Ad Exchange"] = isNaN(Math.round((adExchange / totalAdvertisingCount) * 100)) ? 0 : Math.round((adExchange / totalAdvertisingCount) * 100);
            adsObj["Facebook Exchange"] = isNaN(Math.round((fbExchange / totalAdvertisingCount) * 100)) ? 0 : Math.round((fbExchange / totalAdvertisingCount) * 100);
            adsObj["Retargeting / Remarketing"] = isNaN(Math.round((retargetingAds / totalAdvertisingCount) * 100)) ? 0 : Math.round((retargetingAds / totalAdvertisingCount) * 100);

            let analyticAndTrackingObj = {};
            analyticAndTrackingObj["Total Company"] = totalAnalyticsCount;
            analyticAndTrackingObj["Country"] = datasets[i];
            analyticAndTrackingObj["Conversion Optimization"] = isNaN(Math.round((conversionOpt / totalAnalyticsCount) * 100)) ? 0 : Math.round((conversionOpt / totalAnalyticsCount) * 100);
            analyticAndTrackingObj["Tag Management"] = isNaN(Math.round((tagMng / totalAnalyticsCount) * 100)) ? 0 : Math.round((tagMng / totalAnalyticsCount) * 100);
            analyticAndTrackingObj["Advertiser Tracking"] = isNaN(Math.round((adsTracking / totalAnalyticsCount) * 100)) ? 0 : Math.round((adsTracking / totalAnalyticsCount) * 100);
            analyticAndTrackingObj["Audience Measurement"] = isNaN(Math.round((audienceMeasurement / totalAnalyticsCount) * 100)) ? 0 : Math.round((audienceMeasurement / totalAnalyticsCount) * 100);
            analyticAndTrackingObj["Lead Generation"] = isNaN(Math.round((leadGeneration / totalAnalyticsCount) * 100)) ? 0 : Math.round((leadGeneration / totalAnalyticsCount) * 100);
            analyticAndTrackingObj["Marketing Automation"] = isNaN(Math.round((marketAutomation / totalAnalyticsCount) * 100)) ? 0 : Math.round((marketAutomation / totalAnalyticsCount) * 100);

            let ecommerceObj = {};
            ecommerceObj["Total Company"] = totalEcommerceCount;
            ecommerceObj["Country"] = datasets[i];
            ecommerceObj["Non Platform"] = isNaN(Math.round((nonPlatform / totalEcommerceCount) * 100)) ? 0 : Math.round((nonPlatform / totalEcommerceCount) * 100);
            ecommerceObj["Hosted Solution"] = isNaN(Math.round((hostedSolution / totalEcommerceCount) * 100)) ? 0 : Math.round((hostedSolution / totalEcommerceCount) * 100);
            ecommerceObj["Open Source"] = isNaN(Math.round((openSource / totalEcommerceCount) * 100)) ? 0 : Math.round((openSource / totalEcommerceCount) * 100);
            ecommerceObj["Multi-Channel"] = isNaN(Math.round((multiChannel / totalEcommerceCount) * 100)) ? 0 : Math.round((multiChannel / totalEcommerceCount) * 100);
            ecommerceObj["Enterprise"] = isNaN(Math.round((enterprise / totalEcommerceCount) * 100)) ? 0 : Math.round((enterprise / totalEcommerceCount) * 100);
            ecommerceObj["SMB Solution"] = isNaN(Math.round((smbSolution / totalEcommerceCount) * 100)) ? 0 : Math.round((smbSolution / totalEcommerceCount) * 100);

            let paymentObj = {};
            paymentObj["Total Company"] = totalPaymentCount;
            paymentObj["Country"] = datasets[i];
            paymentObj["Payments Processor"] = isNaN(Math.round((payProcessor / totalPaymentCount) * 100)) ? 0 : Math.round((payProcessor / totalPaymentCount) * 100);
            paymentObj["Payment Acceptance"] = isNaN(Math.round((payAcceptance / totalPaymentCount) * 100)) ? 0 : Math.round((payAcceptance / totalPaymentCount) * 100);
            paymentObj["Payment Currency"] = isNaN(Math.round((payCurrency / totalPaymentCount) * 100)) ? 0 : Math.round((payCurrency / totalPaymentCount) * 100);
            paymentObj["Checkout Buttons"] = isNaN(Math.round((checkOurButton / totalPaymentCount) * 100)) ? 0 : Math.round((checkOurButton / totalPaymentCount) * 100);
            paymentObj["PP, PA, PC, CO"] = isNaN(Math.round((PPPAPCCO / totalPaymentCount) * 100)) ? 0 : Math.round((PPPAPCCO / totalPaymentCount) * 100);
            paymentObj["PA & PC CO"] = isNaN(Math.round((PAPCCO / totalPaymentCount) * 100)) ? 0 : Math.round((PAPCCO / totalPaymentCount) * 100);

            let widgetsObj = {};
            widgetsObj["Total Company"] = totalWidgetsCount;
            widgetsObj["Country"] = datasets[i];
            widgetsObj["Live Chat"] = isNaN(Math.round((liveChat / totalWidgetsCount) * 100)) ? 0 : Math.round((liveChat / totalWidgetsCount) * 100);
            widgetsObj["Customer Login"] = isNaN(Math.round((customerLogin / totalWidgetsCount) * 100)) ? 0 : Math.round((customerLogin / totalWidgetsCount) * 100);
            widgetsObj["Social Sharing"] = isNaN(Math.round((socialSharing / totalWidgetsCount) * 100)) ? 0 : Math.round((socialSharing / totalWidgetsCount) * 100);
            widgetsObj["Schedule Management"] = isNaN(Math.round((scheduleManagement / totalWidgetsCount) * 100)) ? 0 : Math.round((scheduleManagement / totalWidgetsCount) * 100);
            widgetsObj["Ticketing System"] = isNaN(Math.round((ticketingSystem / totalWidgetsCount) * 100)) ? 0 : Math.round((ticketingSystem / totalWidgetsCount) * 100);
            widgetsObj["Bookings"] = isNaN(Math.round((bookings / totalWidgetsCount) * 100)) ? 0 : Math.round((bookings / totalWidgetsCount) * 100);

            let allTechnologyObj = {};
            allTechnologyObj["Total Company"] = companies.length;
            allTechnologyObj["Country"] = datasets[i];
            allTechnologyObj["Advertising"] = isNaN(Math.round((totalAdvertisingCount / companies.length) * 100)) ? 0 : Math.round((totalAdvertisingCount / companies.length) * 100);
            allTechnologyObj["SEO"] = 0;
            allTechnologyObj["Analytics"] = isNaN(Math.round((totalAnalyticsCount / companies.length) * 100)) ? 0 : Math.round((totalAnalyticsCount / companies.length) * 100);
            allTechnologyObj["E-commerce"] = isNaN(Math.round((totalEcommerceCount / companies.length) * 100)) ? 0 : Math.round((totalEcommerceCount / companies.length) * 100);
            allTechnologyObj["Payments"] = isNaN(Math.round((totalPaymentCount / companies.length) * 100)) ? 0 : Math.round((totalPaymentCount / companies.length) * 100);
            allTechnologyObj["Widgets"] = isNaN(Math.round((totalWidgetsCount / companies.length) * 100)) ? 0 : Math.round((totalWidgetsCount / companies.length) * 100);

            data["All Technology"].push(allTechnologyObj);
            data["Advertising"].push(adsObj);
            data["Analytics and Tracking"].push(analyticAndTrackingObj);
            data["Ecommerce"].push(ecommerceObj);
            data["Payment"].push(paymentObj);
            data["Widgets"].push(widgetsObj);
        }

        return res.status(200).json({
            message: "Successful",
            results: data,
            technologies: technologies,
            header: header
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getProviderTechnology = async function (req, res) {

    const datasets = req.body.datasets;
    const filename = req.body.fileName;

    let results = [];

    let types = ["Advertising", "Analytics and Tracking", "Ecommerce", "Payment", "Widgets"];

    let headers = [...datasets];

    const categoryTypes = {
        "Advertising": [
            // "Avertising  Network",
            "ads txt",
            // "Ad Exchange",
            "Audience Targeting",
            // "Facebook Exchange",
            // "Ad Server",
            // "Affiliate Programs",
            "Contextual Advertising",
            "Dynamic Creative Optimization",
            "Digital Video Ads",
            "Retargeting / Remarketing",
            // "Header Bidding"
        ],
        "Analytics and Tracking":
            [
                "Application Performance",
                // "A/B Testing",
                // "Ad Analytics",
                "Conversion Optimization",
                "Advertiser Tracking",
                "Tag Management",
                "Audience Measurement",
                "Visitor Count Tracking"
            ],
        "Ecommerce":
            [
                "Non Platform",
                "Hosted Solution",
                "Open Source",
                "Checkout Buttons",
                "Payment Acceptance",
                "Payments Processor",
                // "Payment Currency"
            ],
        "Widget":
            [
                "Live Chat",
                "Login",
                "Ticketing System",
                "Bookings",
                "Social Sharing",
                "Social Management"
            ],
        "Hosting":
            [
                "Cloud Hosting",
                "Cloud PaaS",
                "Dedicated Hosting",
                "Business Email Hosting",
                "Web Hosting Provider Email",
                "Marketing Platform",
            ],
        "Productivity":
            [
                "CRM",
                "Lead Generation",
                "Marketing Automation",
                "Product Recommendations",
                "Feedback Forms and Surveys",
                "Campaign Management"
            ]
    };

    let total = {
        "Advertising": {},
        "Analytics and Tracking": {},
        "Ecommerce": {},
        "Payment": {},
        "Widgets": {}
    }

    try {
        for (let i = 0; i < datasets.length; i++) {

            let data = {
                "Advertising": {
                    "ads txt": {},
                    "Audience Targeting": {},
                    "Contextual Advertising": {},
                    "Dynamic Creative Optimization": {},
                    "Digital Video Ads": {},
                    "Retargeting / Remarketing": {},
                },
                "Analytics and Tracking": {
                    "Application Performance": {},
                    "Conversion Optimization": {},
                    "Advertiser Tracking": {},
                    "Tag Management": {},
                    "Audience Measurement": {},
                    "Visitor Count Tracking": {},
                },
                "Ecommerce": {
                    "Non Platform": {},
                    "Hosted Solution": {},
                    "Open Source": {},
                    "Checkout Buttons": {},
                    "Payment Acceptance": {},
                    "Payments Processor": {},
                },
                "Hosting": {
                    "Cloud Hosting": {},
                    "Cloud PaaS": {},
                    "Dedicated Hostig": {},
                    "Business Email Hosting": {},
                    "Web Hosting Provider Email": {},
                    "Marketing Platform": {},
                },
                "Widgets": {
                    "Live Chat": {},
                    "Login": {},
                    "Ticketing System": {},
                    "Bookings": {},
                    "Social Sharing": {},
                    "Social Management": {},
                },
                "Productivity": {
                    "CRM": {},
                    "Lead Generation": {},
                    "Marketing Automation": {},
                    "Product Recommendations": {},
                    "Feedback Forms and Surveys": {},
                    "Campaign Management": {},
                }
            };

            let companies;
            if (filename !== "Master DB (Golden Source)") {
                companies = await CompanyItem.findAll({
                    attributes: ["asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            },
                            {
                                file_name: filename
                            }
                        ]
                    }
                });
            } else {
                companies = await CompanyItem.findAll({
                    attributes: ["asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            }
                        ]
                    }
                });
            }

            for (let j = 0; j < companies.length; j++) {

                let jsonObj = JSON.parse(companies[j]["asset"]);

                if (jsonObj["Advertising"] !== undefined) {
                    if (total["Advertising"][datasets[i]] === undefined) {
                        total["Advertising"][datasets[i]] = { count: 1 };
                    } else {
                        total["Advertising"][datasets[i]]["count"] += 1;
                    }
                    if (jsonObj["Advertising"]["Ad Network"] !== undefined) {
                        (jsonObj["Advertising"]["Ad Network"]).map(a => {
                            if (data["Advertising"]["Ad Network"][a] === undefined) {
                                data["Advertising"]["Ad Network"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["Ad Network"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Advertising"]["ads txt"] !== undefined) {
                        (jsonObj["Advertising"]["ads txt"]).map(a => {
                            if (data["Advertising"]["ads txt"][a] === undefined) {
                                data["Advertising"]["ads txt"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["ads txt"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Advertising"]["Contextual Advertising"] !== undefined) {
                        (jsonObj["Advertising"]["Contextual Advertising"]).map(a => {
                            if (data["Advertising"]["Contextual Advertising"][a] === undefined) {
                                data["Advertising"]["Contextual Advertising"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["Contextual Advertising"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Advertising"]["Ad Exchange"] !== undefined) {
                        (jsonObj["Advertising"]["Ad Exchange"]).map(a => {
                            if (data["Advertising"]["Ad Exchange"][a] === undefined) {
                                data["Advertising"]["Ad Exchange"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["Ad Exchange"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Advertising"]["Facebook Exchange"] !== undefined) {
                        (jsonObj["Advertising"]["Facebook Exchange"]).map(a => {
                            if (data["Advertising"]["Facebook Exchange"][a] === undefined) {
                                data["Advertising"]["Facebook Exchange"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["Facebook Exchange"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Advertising"]["Retargeting / Remarketing"] !== undefined) {
                        (jsonObj["Advertising"]["Retargeting / Remarketing"]).map(a => {
                            if (data["Advertising"]["Retargeting / Remarketing"][a] === undefined) {
                                data["Advertising"]["Retargeting / Remarketing"][a] = { "name": a, "count": 0 };
                            }
                            data["Advertising"]["Retargeting / Remarketing"][a]["count"] += 1;
                        });
                    }
                }

                if (jsonObj["Analytics and Tracking"] !== undefined) {
                    if (total["Analytics and Tracking"][datasets[i]] === undefined) {
                        total["Analytics and Tracking"][datasets[i]] = { count: 1 };
                    } else {
                        total["Analytics and Tracking"][datasets[i]]["count"] += 1;
                    }
                    if (jsonObj["Analytics and Tracking"]["Conversion Optimization"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Conversion Optimization"]).map(a => {
                            if (data["Analytics and Tracking"]["Conversion Optimization"][a] === undefined) {
                                data["Analytics and Tracking"]["Conversion Optimization"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Conversion Optimization"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Analytics and Tracking"]["Tag Management"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Tag Management"]).map(a => {
                            if (data["Analytics and Tracking"]["Tag Management"][a] === undefined) {
                                data["Analytics and Tracking"]["Tag Management"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Tag Management"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Analytics and Tracking"]["Advertiser Tracking"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Advertiser Tracking"]).map(a => {
                            if (data["Analytics and Tracking"]["Advertiser Tracking"][a] === undefined) {
                                data["Analytics and Tracking"]["Advertiser Tracking"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Advertiser Tracking"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Analytics and Tracking"]["Audience Measurement"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Audience Measurement"]).map(a => {
                            if (data["Analytics and Tracking"]["Audience Measurement"][a] === undefined) {
                                data["Analytics and Tracking"]["Audience Measurement"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Audience Measurement"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Analytics and Tracking"]["Lead Generation"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Lead Generation"]).map(a => {
                            if (data["Analytics and Tracking"]["Lead Generation"][a] === undefined) {
                                data["Analytics and Tracking"]["Lead Generation"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Lead Generation"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Analytics and Tracking"]["Marketing Automation"] !== undefined) {
                        (jsonObj["Analytics and Tracking"]["Marketing Automation"]).map(a => {
                            if (data["Analytics and Tracking"]["Marketing Automation"][a] === undefined) {
                                data["Analytics and Tracking"]["Marketing Automation"][a] = { "name": a, "count": 0 };
                            }
                            data["Analytics and Tracking"]["Marketing Automation"][a]["count"] += 1;
                        });
                    }
                }

                if (jsonObj["Ecommerce"] !== undefined) {
                    if (total["Ecommerce"][datasets[i]] === undefined) {
                        total["Ecommerce"][datasets[i]] = { count: 1 };
                    } else {
                        total["Ecommerce"][datasets[i]]["count"] += 1;
                    }
                    if (jsonObj["Ecommerce"]["Non Platform"] !== undefined) {
                        (jsonObj["Ecommerce"]["Non Platform"]).map(a => {
                            if (data["Ecommerce"]["Non Platform"][a] === undefined) {
                                data["Ecommerce"]["Non Platform"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["Non Platform"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Ecommerce"]["Hosted Solution"] !== undefined) {
                        (jsonObj["Ecommerce"]["Hosted Solution"]).map(a => {
                            if (data["Ecommerce"]["Hosted Solution"][a] === undefined) {
                                data["Ecommerce"]["Hosted Solution"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["Hosted Solution"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Ecommerce"]["Open Source"] !== undefined) {
                        (jsonObj["Ecommerce"]["Open Source"]).map(a => {
                            if (data["Ecommerce"]["Open Source"][a] === undefined) {
                                data["Ecommerce"]["Open Source"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["Open Source"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Ecommerce"]["Multi-Channel"] !== undefined) {
                        (jsonObj["Ecommerce"]["Multi-Channel"]).map(a => {
                            if (data["Ecommerce"]["Multi-Channel"][a] === undefined) {
                                data["Ecommerce"]["Multi-Channel"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["Multi-Channel"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Ecommerce"]["Enterprise"] !== undefined) {
                        (jsonObj["Ecommerce"]["Enterprise"]).map(a => {
                            if (data["Ecommerce"]["Enterprise"][a] === undefined) {
                                data["Ecommerce"]["Enterprise"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["Enterprise"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Ecommerce"]["SMB Solution"] !== undefined) {
                        (jsonObj["Ecommerce"]["SMB Solution"]).map(a => {
                            if (data["Ecommerce"]["SMB Solution"][a] === undefined) {
                                data["Ecommerce"]["SMB Solution"][a] = { "name": a, "count": 0 };
                            }
                            data["Ecommerce"]["SMB Solution"][a]["count"] += 1;
                        });
                    }
                }

                if (jsonObj["Payment"] !== undefined) {
                    if (total["Payment"][datasets[i]] === undefined) {
                        total["Payment"][datasets[i]] = { count: 1 };
                    } else {
                        total["Payment"][datasets[i]]["count"] += 1;
                    }
                    if (jsonObj["Payment"]["Payments Processor"] !== undefined) {
                        (jsonObj["Payment"]["Payments Processor"]).map(a => {
                            if (data["Payment"]["Payments Processor"][a] === undefined) {
                                data["Payment"]["Payments Processor"][a] = { "name": a, "count": 0 };
                            }
                            data["Payment"]["Payments Processor"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Payment"]["Payment Acceptance"] !== undefined) {
                        (jsonObj["Payment"]["Payment Acceptance"]).map(a => {
                            if (data["Payment"]["Payment Acceptance"][a] === undefined) {
                                data["Payment"]["Payment Acceptance"][a] = { "name": a, "count": 0 };
                            }
                            data["Payment"]["Payment Acceptance"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Payment"]["Payment Currency"] !== undefined) {
                        (jsonObj["Payment"]["Payment Currency"]).map(a => {
                            if (data["Payment"]["Payment Currency"][a] === undefined) {
                                data["Payment"]["Payment Currency"][a] = { "name": a, "count": 0 };
                            }
                            data["Payment"]["Payment Currency"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Payment"]["Checkout Buttons"] !== undefined) {
                        (jsonObj["Payment"]["Checkout Buttons"]).map(a => {
                            if (data["Payment"]["Checkout Buttons"][a] === undefined) {
                                data["Payment"]["Checkout Buttons"][a] = { "name": a, "count": 0 };
                            }
                            data["Payment"]["Checkout Buttons"][a]["count"] += 1;
                        });
                    }
                }

                if (jsonObj["Widgets"] !== undefined) {
                    if (total["Widgets"][datasets[i]] === undefined) {
                        total["Widgets"][datasets[i]] = { count: 1 };
                    } else {
                        total["Widgets"][datasets[i]]["count"] += 1;
                    }
                    if (jsonObj["Widgets"]["Live Chat"] !== undefined) {
                        (jsonObj["Widgets"]["Live Chat"]).map(a => {
                            if (data["Widgets"]["Live Chat"][a] === undefined) {
                                data["Widgets"]["Live Chat"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Live Chat"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Widgets"]["Customer Login"] !== undefined) {
                        (jsonObj["Widgets"]["Customer Login"]).map(a => {
                            if (data["Widgets"]["Customer Login"][a] === undefined) {
                                data["Widgets"]["Customer Login"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Customer Login"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Widgets"]["Social Sharing"] !== undefined) {
                        (jsonObj["Widgets"]["Social Sharing"]).map(a => {
                            if (data["Widgets"]["Social Sharing"][a] === undefined) {
                                data["Widgets"]["Social Sharing"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Social Sharing"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Widgets"]["Schedule Management"] !== undefined) {
                        (jsonObj["Widgets"]["Schedule Management"]).map(a => {
                            if (data["Widgets"]["Schedule Management"][a] === undefined) {
                                data["Widgets"]["Schedule Management"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Schedule Management"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Widgets"]["Ticketing System"] !== undefined) {
                        (jsonObj["Widgets"]["Ticketing System"]).map(a => {
                            if (data["Widgets"]["Ticketing System"][a] === undefined) {
                                data["Widgets"]["Ticketing System"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Ticketing System"][a]["count"] += 1;
                        });
                    }
                    if (jsonObj["Widgets"]["Bookings"] !== undefined) {
                        (jsonObj["Widgets"]["Bookings"]).map(a => {
                            if (data["Widgets"]["Bookings"][a] === undefined) {
                                data["Widgets"]["Bookings"][a] = { "name": a, "count": 0 };
                            }
                            data["Widgets"]["Bookings"][a]["count"] += 1;
                        });
                    }
                }
            }
            results.push(data);
        }

        return res.status(200).json({
            message: "Successful",
            results: results,
            types: types,
            categoryTypes: categoryTypes,
            headers: headers,
            total: total
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getTechnologyCountryView = async function (req, res) {

    const datasets = req.body.datasets;
    const industries = req.body.industries;
    const filename = req.body.fileName;

    let results = [];
    let jsonObj = {};
    let industryObj = {};
    let indObj = {};
    let data = {};

    try {

        for (let i = 0; i < datasets.length; i++) {

            let companies;
            if (filename !== "Master DB (Golden Source)") {
                companies = await CompanyItem.findAll({
                    attributes: ["industry", "asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                industry: {
                                    [Op.in]: industries
                                }
                            },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            },
                            {
                                file_name: filename
                            }
                        ]
                    }
                });
            } else {
                companies = await CompanyItem.findAll({
                    attributes: ["industry", "asset"],
                    where: {
                        [Op.and]: [
                            { dataset: datasets[i] },
                            {
                                industry: {
                                    [Op.in]: industries
                                }
                            },
                            {
                                asset: {
                                    [Op.ne]: null
                                }
                            }
                        ]
                    }
                });
            }


            data[datasets[i]] = {
                "Advertising": {
                    "Ad Network": {},
                    "ads txt": {},
                    "Contextual Advertising": {},
                    "Ad Exchange": {},
                    "Facebook Exchange": {},
                    "Retargeting / Remarketing": {}
                },
                "Analytics": {
                    "Conversion Optimization": {},
                    "Tag Management": {},
                    "Advertiser Tracking": {},
                    "Audience Measurement": {},
                    "Lead Generation": {},
                    "Marketing Automation": {}
                },
                "Ecommerce": {
                    "Non Platform": {},
                    "Hosted Solution": {},
                    "Open Source": {},
                    "Multi-Channel": {},
                    "Enterprise": {},
                    "SMB Solution": {}
                },
                "Payment": {
                    "Payments Processor": {},
                    "Payment Acceptance": {},
                    "Payment Currency": {},
                    "Checkout Buttons": {}
                },
                "Widgets": {
                    "Live Chat": {},
                    "Customer Login": {},
                    "Social Sharing": {},
                    "Schedule Management": {},
                    "Ticketing System": {},
                    "Bookings": {}
                }
            }

            let adNetwork = 0;
            let adsTxt = 0;
            let contextualAds = 0;
            let adExchange = 0;
            let fbExchange = 0;
            let retargetingAds = 0;

            let conversionOpt = 0;
            let tagMng = 0;
            let adsTracking = 0;
            let audienceMeasurement = 0;
            let leadGeneration = 0;
            let marketAutomation = 0;

            let nonPlatform = 0;
            let hostedSolution = 0;
            let openSource = 0;
            let multiChannel = 0;
            let enterprise = 0;
            let smbSolution = 0;

            let payProcessor = 0;
            let payAcceptance = 0;
            let payCurrency = 0;
            let checkOurButton = 0;
            let PPPAPCCO = 0;
            let PAPCCO = 0;

            let liveChat = 0;
            let customerLogin = 0;
            let socialSharing = 0;
            let scheduleManagement = 0;
            let ticketingSystem = 0;
            let bookings = 0;

            let totalAdvertisingCount = 0;
            let totalSEOCount = 0;
            let totalAnalyticsCount = 0;
            let totalEcommerceCount = 0;
            let totalPaymentCount = 0;
            let totalWidgetsCount = 0;

            if (jsonObj[datasets[i]] === undefined) {
                jsonObj[datasets[i]] = {
                    "Advertising": {},
                    "Analytics": {},
                    "Ecommerce": {},
                    "Payment": {},
                    "Widgets": {}
                };
            }

            if (industryObj[datasets[i]] === undefined) industryObj[datasets[i]] = {};
            if (industryObj[datasets[i]]["Advertising"] === undefined) industryObj[datasets[i]]["Advertising"] = {};
            if (industryObj[datasets[i]]["Analytics"] === undefined) industryObj[datasets[i]]["Analytics"] = {};
            if (industryObj[datasets[i]]["Ecommerce"] === undefined) industryObj[datasets[i]]["Ecommerce"] = {};
            if (industryObj[datasets[i]]["Payment"] === undefined) industryObj[datasets[i]]["Payment"] = {};
            if (industryObj[datasets[i]]["Widgets"] === undefined) industryObj[datasets[i]]["Widgets"] = {};

            for (let j = 0; j < companies.length; j++) {

                industryObj[datasets[i]]["Advertising"][companies[j].industry] = [];
                industryObj[datasets[i]]["Analytics"][companies[j].industry] = [];
                industryObj[datasets[i]]["Ecommerce"][companies[j].industry] = [];
                industryObj[datasets[i]]["Payment"][companies[j].industry] = [];
                industryObj[datasets[i]]["Widgets"][companies[j].industry] = [];

                let assets = JSON.parse(companies[j]["asset"]);

                if (assets) {

                    indObj[companies[j].industry] === undefined ? indObj[companies[j].industry] = {} : null;

                    if (assets["Advertising"] !== undefined) {
                        if (assets["Advertising"]["Ad Network"] !== undefined) {
                            adNetwork += 1;
                            if (indObj[companies[j].industry]["Ad Network"] === undefined) indObj[companies[j].industry]["Ad Network"] = 1
                            else indObj[companies[j].industry]["Ad Network"] += 1;
                            (assets["Advertising"]["Ad Network"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["Ad Network"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["Ad Network"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["Ad Network"][a]["count"] += 1;
                            });
                        }
                        if (assets["Advertising"]["ads txt"] !== undefined) {
                            adsTxt += 1;
                            if (indObj[companies[j].industry]["ads txt"] === undefined) indObj[companies[j].industry]["ads txt"] = 1
                            else indObj[companies[j].industry]["ads txt"] += 1;
                            (assets["Advertising"]["ads txt"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["ads txt"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["ads txt"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["ads txt"][a]["count"] += 1;
                            });
                        }
                        if (assets["Advertising"]["Contextual Advertising"] !== undefined) {
                            contextualAds += 1;
                            if (indObj[companies[j].industry]["Contextual Advertising"] === undefined) indObj[companies[j].industry]["Contextual Advertising"] = 1
                            else indObj[companies[j].industry]["Contextual Advertising"] += 1;
                            (assets["Advertising"]["Contextual Advertising"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["Contextual Advertising"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["Contextual Advertising"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["Contextual Advertising"][a]["count"] += 1;
                            });
                        }
                        if (assets["Advertising"]["Ad Exchange"] !== undefined) {
                            adExchange += 1;
                            if (indObj[companies[j].industry]["Ad Exchange"] === undefined) indObj[companies[j].industry]["Ad Exchange"] = 1
                            else indObj[companies[j].industry]["Ad Exchange"] += 1;
                            (assets["Advertising"]["Ad Exchange"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["Ad Exchange"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["Ad Exchange"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["Ad Exchange"][a]["count"] += 1;
                            });
                        }
                        if (assets["Advertising"]["Facebook Exchange"] !== undefined) {
                            fbExchange += 1;
                            if (indObj[companies[j].industry]["Facebook Exchange"] === undefined) indObj[companies[j].industry]["Facebook Exchange"] = 1
                            else indObj[companies[j].industry]["Facebook Exchange"] += 1;
                            (assets["Advertising"]["Facebook Exchange"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["Facebook Exchange"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["Facebook Exchange"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["Facebook Exchange"][a]["count"] += 1;
                            });
                        }
                        if (assets["Advertising"]["Retargeting / Remarketing"] !== undefined) {
                            retargetingAds += 1;
                            if (indObj[companies[j].industry]["Retargeting / Remarketing"] === undefined) indObj[companies[j].industry]["Retargeting / Remarketing"] = 1
                            else indObj[companies[j].industry]["Retargeting / Remarketing"] += 1;
                            (assets["Advertising"]["Retargeting / Remarketing"]).map(a => {
                                if (data[datasets[i]]["Advertising"]["Retargeting / Remarketing"][a] === undefined) {
                                    data[datasets[i]]["Advertising"]["Retargeting / Remarketing"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Advertising"]["Retargeting / Remarketing"][a]["count"] += 1;
                            });
                        }
                        totalAdvertisingCount += 1;
                    }

                    if (assets["Analytics and Tracking"] !== undefined) {
                        if (assets["Analytics and Tracking"]["Conversion Optimization"] !== undefined) {
                            conversionOpt += 1;
                            if (indObj[companies[j].industry]["Conversion Optimization"] === undefined) indObj[companies[j].industry]["Conversion Optimization"] = 1
                            else indObj[companies[j].industry]["Conversion Optimization"] += 1;
                            (assets["Analytics and Tracking"]["Conversion Optimization"]).map(a => {
                                if (data[datasets[i]]["Analytics"]["Conversion Optimization"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Conversion Optimization"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Conversion Optimization"][a]["count"] += 1;
                            });
                        }
                        if (assets["Analytics and Tracking"]["Tag Management"] !== undefined) {
                            tagMng += 1;
                            if (indObj[companies[j].industry]["Tag Management"] === undefined) indObj[companies[j].industry]["Tag Management"] = 1
                            else indObj[companies[j].industry]["Tag Management"] += 1;
                            let arr = assets["Analytics and Tracking"]["Tag Management"];

                            arr.map(a => {
                                if (data[datasets[i]]["Analytics"]["Tag Management"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Tag Management"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Tag Management"][a]["count"] += 1;
                            });
                        }
                        if (assets["Analytics and Tracking"]["Advertiser Tracking"] !== undefined) {
                            adsTracking += 1;
                            if (indObj[companies[j].industry]["Advertiser Tracking"] === undefined) indObj[companies[j].industry]["Advertiser Tracking"] = 1
                            else indObj[companies[j].industry]["Advertiser Tracking"] += 1;
                            (assets["Analytics and Tracking"]["Advertiser Tracking"]).map(a => {
                                if (data[datasets[i]]["Analytics"]["Advertiser Tracking"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Advertiser Tracking"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Advertiser Tracking"][a]["count"] += 1;
                            });
                        }
                        if (assets["Analytics and Tracking"]["Audience Measurement"] !== undefined) {
                            audienceMeasurement += 1;
                            if (indObj[companies[j].industry]["Audience Measurement"] === undefined) indObj[companies[j].industry]["Audience Measurement"] = 1
                            else indObj[companies[j].industry]["Audience Measurement"] += 1;
                            (assets["Analytics and Tracking"]["Audience Measurement"]).map(a => {
                                if (data[datasets[i]]["Analytics"]["Audience Measurement"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Audience Measurement"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Audience Measurement"][a]["count"] += 1;
                            });
                        }
                        if (assets["Analytics and Tracking"]["Lead Generation"] !== undefined) {
                            leadGeneration += 1;
                            if (indObj[companies[j].industry]["Lead Generation"] === undefined) indObj[companies[j].industry]["Lead Generation"] = 1
                            else indObj[companies[j].industry]["Lead Generation"] += 1;
                            (assets["Analytics and Tracking"]["Lead Generation"]).map(a => {
                                if (data[datasets[i]]["Analytics"]["Lead Generation"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Lead Generation"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Lead Generation"][a]["count"] += 1;
                            });
                        }
                        if (assets["Analytics and Tracking"]["Marketing Automation"] !== undefined) {
                            marketAutomation += 1;
                            if (indObj[companies[j].industry]["Marketing Automation"] === undefined) indObj[companies[j].industry]["Marketing Automation"] = 1
                            else indObj[companies[j].industry]["Marketing Automation"] += 1;
                            (assets["Analytics and Tracking"]["Marketing Automation"]).map(a => {
                                if (data[datasets[i]]["Analytics"]["Marketing Automation"][a] === undefined) {
                                    data[datasets[i]]["Analytics"]["Marketing Automation"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Analytics"]["Marketing Automation"][a]["count"] += 1;
                            });
                        }
                        totalAnalyticsCount += 1;
                    }

                    if (assets["Ecommerce"] !== undefined) {
                        if (assets["Ecommerce"]["Non Platform"] !== undefined) {
                            nonPlatform += 1;
                            if (indObj[companies[j].industry]["Non Platform"] === undefined) indObj[companies[j].industry]["Non Platform"] = 1
                            else indObj[companies[j].industry]["Non Platform"] += 1;
                            (assets["Ecommerce"]["Non Platform"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["Non Platform"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["Non Platform"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["Non Platform"][a]["count"] += 1;
                            });
                        }
                        if (assets["Ecommerce"]["Hosted Solution"] !== undefined) {
                            hostedSolution += 1;
                            if (indObj[companies[j].industry]["Hosted Solution"] === undefined) indObj[companies[j].industry]["Hosted Solution"] = 1
                            else indObj[companies[j].industry]["Hosted Solution"] += 1;
                            (assets["Ecommerce"]["Hosted Solution"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["Hosted Solution"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["Hosted Solution"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["Hosted Solution"][a]["count"] += 1;
                            });
                        }
                        if (assets["Ecommerce"]["Open Source"] !== undefined) {
                            openSource += 1;
                            if (indObj[companies[j].industry]["Open Source"] === undefined) indObj[companies[j].industry]["Open Source"] = 1
                            else indObj[companies[j].industry]["Open Source"] += 1;
                            (assets["Ecommerce"]["Open Source"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["Open Source"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["Open Source"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["Open Source"][a]["count"] += 1;
                            });
                        }
                        if (assets["Ecommerce"]["Multi-Channel"] !== undefined) {
                            multiChannel += 1;
                            if (indObj[companies[j].industry]["Multi-Channel"] === undefined) indObj[companies[j].industry]["Multi-Channel"] = 1
                            else indObj[companies[j].industry]["Multi-Channel"] += 1;
                            (assets["Ecommerce"]["Multi-Channel"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["Multi-Channel"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["Multi-Channel"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["Multi-Channel"][a]["count"] += 1;
                            });
                        }
                        if (assets["Ecommerce"]["Enterprise"] !== undefined) {
                            enterprise += 1;
                            if (indObj[companies[j].industry]["Enterprise"] === undefined) indObj[companies[j].industry]["Enterprise"] = 1
                            else indObj[companies[j].industry]["Enterprise"] += 1;
                            (assets["Ecommerce"]["Enterprise"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["Enterprise"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["Enterprise"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["Enterprise"][a]["count"] += 1;
                            });
                        }
                        if (assets["Ecommerce"]["SMB Solution"] !== undefined) {
                            smbSolution += 1;
                            if (indObj[companies[j].industry]["SMB Solution"] === undefined) indObj[companies[j].industry]["SMB Solution"] = 1
                            else indObj[companies[j].industry]["SMB Solution"] += 1;
                            (assets["Ecommerce"]["SMB Solution"]).map(a => {
                                if (data[datasets[i]]["Ecommerce"]["SMB Solution"][a] === undefined) {
                                    data[datasets[i]]["Ecommerce"]["SMB Solution"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Ecommerce"]["SMB Solution"][a]["count"] += 1;
                            });
                        }
                        totalEcommerceCount += 1;
                    }

                    if (assets["Payment"] !== undefined) {
                        if (assets["Payment"]["Payments Processor"] !== undefined) {
                            payProcessor += 1;
                            if (indObj[companies[j].industry]["Payments Processor"] === undefined) indObj[companies[j].industry]["Payments Processor"] = 1
                            else indObj[companies[j].industry]["Payments Processor"] += 1;
                            (assets["Payment"]["Payments Processor"]).map(a => {
                                if (data[datasets[i]]["Payment"]["Payments Processor"][a] === undefined) {
                                    data[datasets[i]]["Payment"]["Payments Processor"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Payment"]["Payments Processor"][a]["count"] += 1;
                            });
                        }
                        if (assets["Payment"]["Payment Acceptance"] !== undefined) {
                            payAcceptance += 1;
                            if (indObj[companies[j].industry]["Payment Acceptance"] === undefined) indObj[companies[j].industry]["Payment Acceptance"] = 1
                            else indObj[companies[j].industry]["Payment Acceptance"] += 1;
                            (assets["Payment"]["Payment Acceptance"]).map(a => {
                                if (data[datasets[i]]["Payment"]["Payment Acceptance"][a] === undefined) {
                                    data[datasets[i]]["Payment"]["Payment Acceptance"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Payment"]["Payment Acceptance"][a]["count"] += 1;
                            });
                        }
                        if (assets["Payment"]["Payment Currency"] !== undefined) {
                            payCurrency += 1;
                            if (indObj[companies[j].industry]["Payment Currency"] === undefined) indObj[companies[j].industry]["Payment Currency"] = 1
                            else indObj[companies[j].industry]["Payment Currency"] += 1;
                            (assets["Payment"]["Payment Currency"]).map(a => {
                                if (data[datasets[i]]["Payment"]["Payment Currency"][a] === undefined) {
                                    data[datasets[i]]["Payment"]["Payment Currency"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Payment"]["Payment Currency"][a]["count"] += 1;
                            });
                        }
                        if (assets["Payment"]["Checkout Buttons"] !== undefined) {
                            checkOurButton += 1;
                            if (indObj[companies[j].industry]["Checkout Buttons"] === undefined) indObj[companies[j].industry]["Checkout Buttons"] = 1
                            else indObj[companies[j].industry]["Checkout Buttons"] += 1;
                            (assets["Payment"]["Checkout Buttons"]).map(a => {
                                if (data[datasets[i]]["Payment"]["Checkout Buttons"][a] === undefined) {
                                    data[datasets[i]]["Payment"]["Checkout Buttons"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Payment"]["Checkout Buttons"][a]["count"] += 1;
                            });
                        }
                        if (assets["Payment"]["Payment Acceptance"] !== undefined &&
                            assets["Payment"]["Payment Currency"] !== undefined &&
                            assets["Payment"]["Checkout Buttons"] !== undefined
                        ) {
                            PAPCCO += 1;
                            if (indObj[companies[j].industry]["PAPCCO"] === undefined) indObj[companies[j].industry]["PAPCCO"] = 1
                            else indObj[companies[j].industry]["PAPCCO"] += 1;
                            // (assets["Payment"]["Payments Acceptance"]).map(a => {
                            //     if (data[datasets[i]]["Payment"]["PAPCCO"][a] === undefined) {
                            //         data[datasets[i]]["Payment"]["PAPCCO"][a] = { "name": a, "count": 0 };
                            //     }
                            //     data[datasets[i]]["Payment"]["PAPCCO"][a]["count"] += 1;
                            // });
                        }

                        if (assets["Payment"]["Payments Processor"] !== undefined &&
                            assets["Payment"]["Payment Acceptance"] !== undefined &&
                            assets["Payment"]["Payment Currency"] !== undefined &&
                            assets["Payment"]["Checkout Buttons"] !== undefined
                        ) {
                            PPPAPCCO += 1;
                            if (indObj[companies[j].industry]["PPPAPCCO"] === undefined) indObj[companies[j].industry]["PPPAPCCO"] = 1
                            else indObj[companies[j].industry]["PPPAPCCO"] += 1;
                            // (assets["Payment"]["Payments Currency"]).map(a => {
                            //     if (data[datasets[i]]["Payment"]["PPPAPCCO"][a] === undefined) {
                            //         data[datasets[i]]["Payment"]["PPPAPCCO"][a] = { "name": a, "count": 0 };
                            //     }
                            //     data[datasets[i]]["Payment"]["PPPAPCCO"][a]["count"] += 1;
                            // });
                        }
                        totalPaymentCount += 1;
                    }

                    if (assets["Widgets"] !== undefined) {
                        if (assets["Widgets"]["Live Chat"] !== undefined) {
                            liveChat += 1;
                            if (indObj[companies[j].industry]["Live Chat"] === undefined) indObj[companies[j].industry]["Live Chat"] = 1
                            else indObj[companies[j].industry]["Live Chat"] += 1;
                            (assets["Widgets"]["Live Chat"]).map(a => {
                                if (data[datasets[i]]["Widgets"]["Live Chat"][a] === undefined) {
                                    data[datasets[i]]["Widgets"]["Live Chat"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Widgets"]["Live Chat"][a]["count"] += 1;
                            });
                        }
                        if (assets["Widgets"]["Login"] !== undefined) {
                            customerLogin += 1;
                            if (indObj[companies[j].industry]["Login"] === undefined) indObj[companies[j].industry]["Login"] = 1
                            else indObj[companies[j].industry]["Login"] += 1;
                            // (assets["Widgets"]["Login"]).map(a => {
                            //     if (data[datasets[i]]["Widgets"]["Login"][a] === undefined) {
                            //         data[datasets[i]]["Widgets"]["Login"][a] = { "name": a, "count": 0 };
                            //     }
                            //     data[datasets[i]]["Widgets"]["Login"][a]["count"] += 1;
                            // });
                        }
                        if (assets["Widgets"]["Social Sharing"] !== undefined) {
                            socialSharing += 1;
                            if (indObj[companies[j].industry]["Social Sharing"] === undefined) indObj[companies[j].industry]["Social Sharing"] = 1
                            else indObj[companies[j].industry]["Social Sharing"] += 1;
                            (assets["Widgets"]["Social Sharing"]).map(a => {
                                if (data[datasets[i]]["Widgets"]["Social Sharing"][a] === undefined) {
                                    data[datasets[i]]["Widgets"]["Social Sharing"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Widgets"]["Social Sharing"][a]["count"] += 1;
                            });
                        }
                        if (assets["Widgets"]["Schedule Management"] !== undefined) {
                            scheduleManagement += 1;
                            if (indObj[companies[j].industry]["Schedule Management"] === undefined) indObj[companies[j].industry]["Schedule Management"] = 1
                            else indObj[companies[j].industry]["Schedule Management"] += 1;
                            (assets["Widgets"]["Schedule Management"]).map(a => {
                                if (data[datasets[i]]["Widgets"]["Schedule Management"][a] === undefined) {
                                    data[datasets[i]]["Widgets"]["Schedule Management"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Widgets"]["Schedule Management"][a]["count"] += 1;
                            });
                        }
                        if (assets["Widgets"]["Ticketing System"] !== undefined) {
                            ticketingSystem += 1;
                            if (indObj[companies[j].industry]["Ticketing System"] === undefined) indObj[companies[j].industry]["Ticketing System"] = 1
                            else indObj[companies[j].industry]["Ticketing System"] += 1;
                            (assets["Widgets"]["Ticketing System"]).map(a => {
                                if (data[datasets[i]]["Widgets"]["Ticketing System"][a] === undefined) {
                                    data[datasets[i]]["Widgets"]["Ticketing System"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Widgets"]["Ticketing System"][a]["count"] += 1;
                            });
                        }
                        if (assets["Widgets"]["Bookings"] !== undefined) {
                            bookings += 1;
                            if (indObj[companies[j].industry]["Bookings"] === undefined) indObj[companies[j].industry]["Bookings"] = 1
                            else indObj[companies[j].industry]["Bookings"] += 1;
                            (assets["Widgets"]["Bookings"]).map(a => {
                                if (data[datasets[i]]["Widgets"]["Bookings"][a] === undefined) {
                                    data[datasets[i]]["Widgets"]["Bookings"][a] = { "name": a, "count": 0 };
                                }
                                data[datasets[i]]["Widgets"]["Bookings"][a]["count"] += 1;
                            });
                        }
                        totalWidgetsCount += 1;
                    }

                    if (indObj[companies[j].industry]) {
                        industryObj[datasets[i]]["Advertising"][companies[j].industry] = [
                            companies[j].industry,
                            indObj[companies[j].industry]["Ad Network"] ? (indObj[companies[j].industry]["Ad Network"] / adNetwork) * 100 : 0,
                            indObj[companies[j].industry]["ads txt"] ? (indObj[companies[j].industry]["ads txt"] / adsTxt) * 100 : 0,
                            indObj[companies[j].industry]["Contextual Advertising"] ? (indObj[companies[j].industry]["Contextual Advertising"] / contextualAds) * 100 : 0,
                            indObj[companies[j].industry]["Ad Exchange"] ? (indObj[companies[j].industry]["Ad Exchange"] / adExchange) * 100 : 0,
                            indObj[companies[j].industry]["Facebook Exchange"] ? (indObj[companies[j].industry]["Facebook Exchange"] / fbExchange) * 100 : 0,
                            indObj[companies[j].industry]["Retargeting / Remarketing"] ? (indObj[companies[j].industry]["Retargeting / Remarketing"] / retargetingAds) * 100 : 0
                        ];
                        industryObj[datasets[i]]["Analytics"][companies[j].industry] = [
                            companies[j].industry,
                            indObj[companies[j].industry]["Conversion Optimization"] ? (indObj[companies[j].industry]["Conversion Optimization"] / conversionOpt) * 100 : 0,
                            indObj[companies[j].industry]["Tag Management"] ? (indObj[companies[j].industry]["Tag Management"] / tagMng) * 100 : 0,
                            indObj[companies[j].industry]["Advertiser Tracking"] ? (indObj[companies[j].industry]["Advertiser Tracking"] / adsTracking) * 100 : 0,
                            indObj[companies[j].industry]["Audience Measurement"] ? (indObj[companies[j].industry]["Audience Measurement"] / audienceMeasurement) * 100 : 0,
                            indObj[companies[j].industry]["Lead Generation"] ? (indObj[companies[j].industry]["Lead Generation"] / leadGeneration) * 100 : 0,
                            indObj[companies[j].industry]["Marketing Automation"] ? (indObj[companies[j].industry]["Marketing Automation"] / marketAutomation) * 100 : 0
                        ];
                        industryObj[datasets[i]]["Ecommerce"][companies[j].industry] = [
                            companies[j].industry,
                            indObj[companies[j].industry]["Non Platform"] ? (indObj[companies[j].industry]["Non Platform"] / nonPlatform) * 100 : 0,
                            indObj[companies[j].industry]["Hosted Solution"] ? (indObj[companies[j].industry]["Hosted Solution"] / hostedSolution) * 100 : 0,
                            indObj[companies[j].industry]["Open Source"] ? (indObj[companies[j].industry]["Open Source"] / openSource) * 100 : 0,
                            indObj[companies[j].industry]["Multi-Channel"] ? (indObj[companies[j].industry]["Multi-Channel"] / multiChannel) * 100 : 0,
                            indObj[companies[j].industry]["Enterprise"] ? (indObj[companies[j].industry]["Enterprise"] / enterprise) * 100 : 0,
                            indObj[companies[j].industry]["SMB Solution"] ? (indObj[companies[j].industry]["SMB Solution"] / smbSolution) * 100 : 0
                        ];
                        industryObj[datasets[i]]["Payment"][companies[j].industry] = [
                            companies[j].industry,
                            indObj[companies[j].industry]["Payments Processor"] ? (indObj[companies[j].industry]["Payments Processor"] / payProcessor) * 100 : 0,
                            indObj[companies[j].industry]["Payment Acceptance"] ? (indObj[companies[j].industry]["Payment Acceptance"] / payAcceptance) * 100 : 0,
                            indObj[companies[j].industry]["Payment Currency"] ? (indObj[companies[j].industry]["Payment Currency"] / payCurrency) * 100 : 0,
                            indObj[companies[j].industry]["Checkout Buttons"] ? (indObj[companies[j].industry]["Checkout Buttons"] / checkOurButton) * 100 : 0,
                            indObj[companies[j].industry]["PAPCCO"] ? (indObj[companies[j].industry]["PAPCCO"] / PAPCCO) * 100 : 0,
                            indObj[companies[j].industry]["PPPAPCCO"] ? (indObj[companies[j].industry]["PPPAPCCO"] / PPPAPCCO) * 100 : 0
                        ];
                        industryObj[datasets[i]]["Widgets"][companies[j].industry] = [
                            companies[j].industry,
                            indObj[companies[j].industry]["Live Chat"] ? (indObj[companies[j].industry]["Live Chat"] / liveChat) * 100 : 0,
                            indObj[companies[j].industry]["Login"] ? (indObj[companies[j].industry]["Login"] / customerLogin) * 100 : 0,
                            indObj[companies[j].industry]["Social Sharing"] ? (indObj[companies[j].industry]["Social Sharing"] / socialSharing) * 100 : 0,
                            indObj[companies[j].industry]["Schedule Management"] ? (indObj[companies[j].industry]["Schedule Management"] / scheduleManagement) * 100 : 0,
                            indObj[companies[j].industry]["Ticketing System"] ? (indObj[companies[j].industry]["Ticketing System"] / ticketingSystem) * 100 : 0,
                            indObj[companies[j].industry]["Bookings"] ? (indObj[companies[j].industry]["Bookings"] / bookings) * 100 : 0
                        ];
                    }
                }
            }

            jsonObj[datasets[i]]["Advertising"] = {
                "Type": "Advertising",
                "Count": totalAdvertisingCount,
                "Ad Network": {
                    percent: isNaN(Math.round((adNetwork / totalAdvertisingCount) * 100)) ? 0 : Math.round((adNetwork / totalAdvertisingCount) * 100),
                    count: adNetwork
                },
                "Ads Txt": {
                    percent: isNaN(Math.round((adsTxt / totalAdvertisingCount) * 100)) ? 0 : Math.round((adsTxt / totalAdvertisingCount) * 100),
                    count: adsTxt
                },
                "Contextual Ad": {
                    percent: isNaN(Math.round((contextualAds / totalAdvertisingCount) * 100)) ? 0 : Math.round((contextualAds / totalAdvertisingCount) * 100),
                    count: contextualAds
                },
                "Ad Exchange": {
                    percent: isNaN(Math.round((adExchange / totalAdvertisingCount) * 100)) ? 0 : Math.round((adExchange / totalAdvertisingCount) * 100),
                    count: adExchange
                },
                "Facebook Exchange": {
                    percent: isNaN(Math.round((fbExchange / totalAdvertisingCount) * 100)) ? 0 : Math.round((fbExchange / totalAdvertisingCount) * 100),
                    count: fbExchange
                },
                "Retargeting": {
                    percent: isNaN(Math.round((retargetingAds / totalAdvertisingCount) * 100)) ? 0 : Math.round((retargetingAds / totalAdvertisingCount) * 100),
                    count: retargetingAds
                }
            }

            jsonObj[datasets[i]]["Analytics"] = {
                "Type": "Analytics",
                "Count": totalAnalyticsCount,
                "Conversion Optimization": {
                    percent: isNaN(Math.round((conversionOpt / totalAnalyticsCount) * 100)) ? 0 : Math.round((conversionOpt / totalAnalyticsCount) * 100),
                    count: conversionOpt
                },
                "Tag Management": {
                    percent: isNaN(Math.round((tagMng / totalAnalyticsCount) * 100)) ? 0 : Math.round((tagMng / totalAnalyticsCount) * 100),
                    count: tagMng
                },
                "Advertising Tracking": {
                    percent: isNaN(Math.round((adsTracking / totalAnalyticsCount) * 100)) ? 0 : Math.round((adsTracking / totalAnalyticsCount) * 100),
                    count: adsTracking
                },
                "Audience Measurement": {
                    percent: isNaN(Math.round((audienceMeasurement / totalAnalyticsCount) * 100)) ? 0 : Math.round((audienceMeasurement / totalAnalyticsCount) * 100),
                    count: audienceMeasurement
                },
                "Lead Generation": {
                    percent: isNaN(Math.round((leadGeneration / totalAnalyticsCount) * 100)) ? 0 : Math.round((leadGeneration / totalAnalyticsCount) * 100),
                    count: leadGeneration
                },
                "Marketing Automation": {
                    percent: isNaN(Math.round((marketAutomation / totalAnalyticsCount) * 100)) ? 0 : Math.round((marketAutomation / totalAnalyticsCount) * 100),
                    count: marketAutomation
                }
            }

            jsonObj[datasets[i]]["Ecommerce"] = {
                "Type": "Ecommerce",
                "Count": totalEcommerceCount,
                "Non Platform": {
                    percent: isNaN(Math.round((nonPlatform / totalEcommerceCount) * 100)) ? 0 : Math.round((nonPlatform / totalEcommerceCount) * 100),
                    count: nonPlatform
                },
                "Hosted Solution": {
                    percent: isNaN(Math.round((hostedSolution / totalEcommerceCount) * 100)) ? 0 : Math.round((hostedSolution / totalEcommerceCount) * 100),
                    count: hostedSolution
                },
                "Open Source": {
                    percent: isNaN(Math.round((openSource / totalEcommerceCount) * 100)) ? 0 : Math.round((openSource / totalEcommerceCount) * 100),
                    count: openSource
                },
                "Multi-Channel": {
                    percent: isNaN(Math.round((multiChannel / totalEcommerceCount) * 100)) ? 0 : Math.round((multiChannel / totalEcommerceCount) * 100),
                    count: multiChannel
                },
                "Enterprise": {
                    percent: isNaN(Math.round((enterprise / totalEcommerceCount) * 100)) ? 0 : Math.round((enterprise / totalEcommerceCount) * 100),
                    count: enterprise
                },
                "SMB Solution": {
                    percent: isNaN(Math.round((smbSolution / totalEcommerceCount) * 100)) ? 0 : Math.round((smbSolution / totalEcommerceCount) * 100),
                    count: smbSolution
                }
            }

            jsonObj[datasets[i]]["Payment"] = {
                "Type": "Payment",
                "Count": totalPaymentCount,
                "Payments Processor": {
                    percent: isNaN(Math.round((payProcessor / totalPaymentCount) * 100)) ? 0 : Math.round((payProcessor / totalPaymentCount) * 100),
                    count: payProcessor
                },
                "Payment Acceptance": {
                    percent: isNaN(Math.round((payAcceptance / totalPaymentCount) * 100)) ? 0 : Math.round((payAcceptance / totalPaymentCount) * 100),
                    count: payAcceptance
                },
                "Payment Currency": {
                    percent: isNaN(Math.round((payCurrency / totalPaymentCount) * 100)) ? 0 : Math.round((payCurrency / totalPaymentCount) * 100),
                    count: payCurrency
                },
                "Checkout Buttons": {
                    percent: isNaN(Math.round((checkOurButton / totalPaymentCount) * 100)) ? 0 : Math.round((checkOurButton / totalPaymentCount) * 100),
                    count: checkOurButton
                },
                "PP, PA, PC, CO": {
                    percent: isNaN(Math.round((PPPAPCCO / totalPaymentCount) * 100)) ? 0 : Math.round((PPPAPCCO / totalPaymentCount) * 100),
                    count: PPPAPCCO
                },
                "PA & PC CO": {
                    percent: isNaN(Math.round((PAPCCO / totalPaymentCount) * 100)) ? 0 : Math.round((PAPCCO / totalPaymentCount) * 100),
                    count: PAPCCO
                }
            }

            jsonObj[datasets[i]]["Widgets"] = {
                "Type": "Widgets",
                "Count": totalWidgetsCount,
                "Live Chat": {
                    percent: isNaN(Math.round((liveChat / totalWidgetsCount) * 100)) ? 0 : Math.round((liveChat / totalWidgetsCount) * 100),
                    count: liveChat
                },
                "Customer Login": {
                    percent: isNaN(Math.round((customerLogin / totalWidgetsCount) * 100)) ? 0 : Math.round((customerLogin / totalWidgetsCount) * 100),
                    count: customerLogin
                },
                "Social Sharing": {
                    percent: isNaN(Math.round((socialSharing / totalWidgetsCount) * 100)) ? 0 : Math.round((socialSharing / totalWidgetsCount) * 100),
                    count: socialSharing
                },
                "Schedule Management": {
                    percent: isNaN(Math.round((scheduleManagement / totalWidgetsCount) * 100)) ? 0 : Math.round((scheduleManagement / totalWidgetsCount) * 100),
                    count: scheduleManagement
                },
                "Ticketing System": {
                    percent: isNaN(Math.round((ticketingSystem / totalWidgetsCount) * 100)) ? 0 : Math.round((ticketingSystem / totalWidgetsCount) * 100),
                    count: ticketingSystem
                },
                "Bookings": {
                    percent: isNaN(Math.round((bookings / totalWidgetsCount) * 100)) ? 0 : Math.round((bookings / totalWidgetsCount) * 100),
                    count: bookings
                }
            }

        }

        return res.status(200).json({
            message: "Successful",
            results: jsonObj,
            industry: industryObj,
            ind: indObj,
            industryProvider: data
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

function getBrandData(data, category, type) {
    if (data[category] && data[category][type]) return data[category][type]
    return "-"
}

exports.uploadPersonnels = async function (req, res) {
    let form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {

        const wb = XLSX.readFile(files.file.path, { raw: true });

        const wsname = wb.SheetNames[0];

        const ws = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        var values = {};

        data.forEach(function (row) {
            if (row.length >= 4) {
                var co_name = row[0];
                var p_name = row[1];
                var attr = row[2];
                var val = row[3];
                if (values[co_name] === undefined) {
                    values[co_name] = {
                        name: co_name,
                        personnels: {}
                    };
                }
                if (values[co_name].personnels[p_name] === undefined) {
                    values[co_name].personnels[p_name] = {
                        co_name: co_name,
                        p_name: p_name,
                        attr: {
                            industry: [],
                            industry_second_level: [],
                            industry_third_level: [],
                        },
                    }
                }
                if (attr === 'industry') {
                    var industry = row[3] !== undefined ? row[3] : null;
                    var industry_second_level = row[4] !== undefined ? row[4] : null;
                    var industry_third_level = row[5] !== undefined ? row[5] : null;
                    if (industry) {
                        values[co_name].personnels[p_name].attr.industry.push(industry);
                    }
                    if (industry_second_level) {
                        values[co_name].personnels[p_name].attr.industry_second_level.push(industry_second_level);
                    }
                    if (industry_third_level) {
                        values[co_name].personnels[p_name].attr.industry_third_level.push(industry_third_level);
                    }
                } else {
                    if (values[co_name].personnels[p_name].attr[attr] === undefined) {
                        values[co_name].personnels[p_name].attr[attr] = [];
                    }
                    if (val) {
                        values[co_name].personnels[p_name].attr[attr].push(val);
                    }
                }
            }
        });
        var companies = Object.values(values);
        var items = [];
        companies.forEach(function (company) {
            var personnels = Object.values(company.personnels).map(function (person) {
                var p_name = person.p_name;
                var co_name = person.co_name;
                var attr = person.attr;
                var p = {};
                p.personnel_name = p_name;
                p.title = 'cannot verify';
                if (attr.title && attr.title.length > 0) {
                    p.title = attr.title.join(',');
                }
                p.phone = null;
                if (attr.phone && attr.phone.length > 0) {
                    p.phone = attr.phone.join(',');
                }
                p.email = null;
                if (attr.email && attr.email.length > 0) {
                    p.email = attr.email.join(',');
                }
                p.status = null;
                if (attr.status && attr.status.length > 0) {
                    p.status = attr.status.join(',');
                }
                p.role = 'cannot verify';
                if (attr.role && attr.role.length > 0) {
                    p.role = attr.role.join(',');
                }
                p.seniority = 'cannot verify';
                if (attr.seniority && attr.seniority.length > 0) {
                    p.seniority = attr.seniority.join(',');
                }
                p.company_name = co_name;
                p.overall_knapshot_score = -1;
                if (attr.overallKnapshotScore && attr.overallKnapshotScore.length > 0) {
                    p.overall_knapshot_score = parseFloat(attr.overallKnapshotScore.join('-'));
                }
                p.organization_type = 'cannot verify';
                if (attr.organizationType && attr.organizationType.length > 0) {
                    p.organization_type = attr.organizationType.join(',');
                }
                p.year_in_operation = 'cannot verify';
                if (attr.yearOfOperation && attr.yearOfOperation.length > 0) {
                    p.year_in_operation = attr.yearOfOperation.join(',');
                }
                p.total_offices_region = -1;
                if (attr.totalOfficesByCountryOfPresence && attr.totalOfficesByCountryOfPresence.length > 0) {
                    p.total_offices_region = parseInt(attr.totalOfficesByCountryOfPresence.join(','), 10);
                }
                p.main_hq_location_region = 'cannot verify';
                if (attr.mainHqLocation && attr.mainHqLocation.length > 0) {
                    p.main_hq_location_region = attr.mainHqLocation.join(',');
                }
                return p;
            });
            items.push(...personnels);
        });

        Personnel
            .truncate()
            .then(function () {
                Personnel.bulkCreate(items).then(function () {
                    res.json({
                        meta: {
                            code: 200,
                            success: true,
                            message: 'Uploaded successfully',
                        },
                        personnels: items,
                        values: values,
                    })
                }).catch(function (e) {
                    throw e;
                });
            }).catch(function (e) {
                throw e;
            });

    });
};

exports.digitalPresenceFilter = async function (req, res) {

    let dataset = req.body.dataset;
    let file_name = req.body.file_name;
    let frimographicFilter = req.body.frimographicFilter;

    let twitterData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        facebookData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        linkedInData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        instagramData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        emailData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        addressData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        phoneData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }],
        websiteData = [{ label: "Has", count: 0 }, { label: "Doesn't", count: 0 }];

    let basic = 0, intermediate = 0, high = 0, advance = 0
    let zero = 0, _1to2 = 0, _3to5 = 0, _gt6 = 0
    let digitalEngagement = [], totalDirectoryPresence = []
    let review = []
    let whereFilter = [{ dataset }];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    try {
        await Company.findAll({
            where: {
                [Op.and]: whereFilter
            },
            attributes: ["company_name", "twitter", "facebook", "linkedIn", "instagram", "company_email_address", "address", "main_line_number", "website", "no_of_directory_presence", "overall_knapshot_score"],
            include: [
                { model: Directory }
            ]
        }).then(COMP => {
            COMP.map(x => {
                const { twitter, facebook, linkedIn, instagram, company_email_address, address, main_line_number, website, no_of_directory_presence, overall_knapshot_score, directories } = x.dataValues

                let filter = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))

                if (twitter) twitterData[0].count += 1
                else twitterData[1].count += 1
                if (facebook) facebookData[0].count += 1
                else facebookData[1].count += 1
                if (linkedIn) linkedInData[0].count += 1
                else linkedInData[1].count += 1
                if (instagram) instagramData[0].count += 1
                else instagramData[1].count += 1
                if (company_email_address) emailData[0].count += 1
                else emailData[1].count += 1
                if (address) addressData[0].count += 1
                else addressData[1].count += 1
                if (main_line_number) phoneData[0].count += 1
                else phoneData[1].count += 1
                if (website) websiteData[0].count += 1
                else websiteData[1].count += 1

                if (overall_knapshot_score < 2) basic += 1;
                if (overall_knapshot_score >= 2 && overall_knapshot_score < 5) intermediate += 1;
                if (overall_knapshot_score >= 5 && overall_knapshot_score < 8) high += 1;
                if (overall_knapshot_score >= 8) advance += 1;

                let dirObj = { default: 0 }
                for (let directory in filter) {
                    if (!filter.hasOwnProperty(directory)) continue;
                    let dirName = filter[directory].directory
                    dirObj[dirName] = dirObj[dirName] ? dirObj[dirName] + 1 : 1
                }
                let totalMaxDir = Math.max(...Object.values(dirObj))

                if (totalMaxDir === 0) zero += 1;
                if (totalMaxDir >= 1 && totalMaxDir <= 2) _1to2 += 1;
                if (totalMaxDir >= 3 && totalMaxDir <= 5) _3to5 += 1;
                if (totalMaxDir >= 6) _gt6 += 1;

            })
        })

        digitalEngagement.push({
            "KS Score 1-3": basic,
            "KS Score 3-5": intermediate,
            "KS Score 5-7": high,
            "KS Score > 7": advance
        })

        totalDirectoryPresence.push({
            "0 Presence": zero,
            "1 - 2": _1to2,
            "3 - 5": _3to5,
            ">6": _gt6
        })

        return res.status(200).json({
            message: "Successful",
            results: {
                websites: websiteData,
                email: emailData,
                phone: phoneData,
                address: addressData,
                twitter: twitterData,
                facebook: facebookData,
                linkedIn: linkedInData,
                instagram: instagramData,
                directoryPresence: totalDirectoryPresence,
                digitalEngagement: digitalEngagement,
                review: review
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }

    // try{
    //     await Directory.findAll({
    //         where : {
    //             [Op.and]: whereFilter
    //         },
    //         attributes: ["company_name", "link"]
    //     }).then(DIRECT =>{
    //         DIRECT.map(x =>{
    //         })
    //     })
    // }catch(error){
    //     return res.status(500).json({message: error.message})
    // }
}

exports.digitalEngagementSelect = async function (req, res) {

    let file_name = req.body.file_name;
    let dataset = req.body.dataset;
    let frimographicFilter = req.body.frimographicFilter;
    let digitalPresenceFilter = req.body.digitalPresenceFilter;
    let technologyFilter = req.body.technologyFilter;
    let restrictTechnologyFilter = req.body.restrictTechnologyFilter


    let twitterData = { count: 0, id: [] },
        facebookData = { count: 0, id: [] },
        linkedInData = { count: 0, id: [] },
        instagramData = { count: 0, id: [] },
        youtubeData = { count: 0, id: [] },
        websiteData = { count: 0, id: [] };

    let totalCount = 0

    let whereFilter = [{ dataset }];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }
    let results = [], obj = {}, digitalAssetsObj = {}, allProvider = [], digitalAssets = []

    try {
        const companies = await Company.findAll({
            where: {
                [Op.and]: whereFilter
            },
            attributes: ["id", "industry", "company_name", "asset"],
            include: [
                { model: Directory }
            ]
        }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
        // .then(COMP => {
        //     return COMP.map(x => {
        //         let { asset } = x.dataValues
        //         let assets = JSON.parse(asset)


        //         let total = {}
        //         if (assets) for (var category in assets) {
        //             if (!assets.hasOwnProperty(category)) continue;
        //             if (!keyValues[category]) continue;

        //             var types = assets[category];
        //             for (var type in types) {
        //                 if (!types.hasOwnProperty(type)) continue;
        //                 if (!keyValues[category].includes(type)) continue;


        //                 var brands = [...new Set(types[type])];
        //                 for (var j = 0; j < brands.length; j++) {
        //                     var brand = brands[j];

        //                     total[category] = total[category] ? total[category] : {};

        //                     var total_type = total[category];
        //                     total_type[type] = total_type[type] ? total_type[type] : [];

        //                     total[category][type].push(brand)
        //                 }
        //             }
        //         }

        //         // data change
        //         x.dataValues.asset = JSON.stringify(total);
        //         return x;

        //     })
        // }).filter(value => {
        //     let assets = JSON.parse(value.dataValues.asset);

        //     if (!(technologyFilter && Object.keys(technologyFilter).length)) return true
        //     if (assets) {
        //         var technologyFilterIterator = ThreeLevelIterator(technologyFilter);
        //         var pass = true;
        //         for (var row of technologyFilterIterator) {
        //             var { f_key, s_key, t_key } = row;
        //             if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {

        //             }
        //             else {
        //                 pass = false;
        //                 break;
        //             }
        //         }
        //         return pass;
        //     }
        //     return true
        // });
        // I am here
        await Company.findAll({
            where: {
                [Op.and]: whereFilter
            },
            attributes: ["id", "facebook", "twitter", "linkedIn", "instagram", "website", "youtube", "industry", "asset"],
            include: [
                { model: Directory }
            ]
        }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
            // .then(COMP => {
            //     return COMP.map(x => {
            //         let { asset } = x.dataValues
            //         let assets = JSON.parse(asset)


            //         let total = {}
            //         if (assets) for (var category in assets) {
            //             if (!assets.hasOwnProperty(category)) continue;
            //             if (!keyValues[category]) continue;

            //             var types = assets[category];
            //             for (var type in types) {
            //                 if (!types.hasOwnProperty(type)) continue;
            //                 if (!keyValues[category].includes(type)) continue;


            //                 var brands = [...new Set(types[type])];
            //                 for (var j = 0; j < brands.length; j++) {
            //                     var brand = brands[j];

            //                     total[category] = total[category] ? total[category] : {};

            //                     var total_type = total[category];
            //                     total_type[type] = total_type[type] ? total_type[type] : [];

            //                     total[category][type].push(brand)
            //                 }
            //             }
            //         }

            //         // data change
            //         x.dataValues.asset = JSON.stringify(total);
            //         return x;

            //     })
            // }).filter(value => {
            //     let assets = JSON.parse(value.dataValues.asset);

            //     if (!(technologyFilter && Object.keys(technologyFilter).length)) return true
            //     if (assets) {
            //         var technologyFilterIterator = ThreeLevelIterator(technologyFilter);
            //         var pass = true;
            //         for (var row of technologyFilterIterator) {
            //             var { f_key, s_key, t_key } = row;
            //             if (assets[f_key] && assets[f_key][s_key] && assets[f_key][s_key].includes(t_key)) {

            //             }
            //             else {
            //                 pass = false;
            //                 break;
            //             }
            //         }
            //         return pass;
            //     }
            //     return true
            // })
            .then(COMP => {
                COMP.map(x => {
                    const { id, twitter, facebook, linkedIn, instagram, website, industry } = x.dataValues

                    if (!digitalAssetsObj[industry]) {
                        digitalAssetsObj[industry] = {
                            industries: {
                                Twitter: { count: 0, id: [] },
                                Facebook: { count: 0, id: [] },
                                LinkedIn: { count: 0, id: [] },
                                Instagram: { count: 0, id: [] },
                                Youtube: { count: 0, id: [] },
                                Website: { count: 0, id: [] }
                            },
                            count: 0
                        };
                    }

                    if (twitter) {
                        twitterData.count += 1
                        twitterData.id.push(id)
                        digitalAssetsObj[industry]["industries"].Facebook.count += 1
                        digitalAssetsObj[industry]["industries"].Facebook.id.push(id)
                        digitalAssetsObj[industry].count += 1
                    }
                    if (facebook) {
                        facebookData.count += 1
                        facebookData.id.push(id)
                        digitalAssetsObj[industry]["industries"].Twitter.count += 1
                        digitalAssetsObj[industry]["industries"].Twitter.id.push(id)
                        digitalAssetsObj[industry].count += 1
                    }
                    if (linkedIn) {
                        linkedInData.count += 1
                        linkedInData.id.push(id)
                        digitalAssetsObj[industry]["industries"].LinkedIn.count += 1
                        digitalAssetsObj[industry]["industries"].LinkedIn.id.push(id)
                        digitalAssetsObj[industry].count += 1
                    }
                    if (instagram) {
                        instagramData.count += 1
                        instagramData.id.push(id)
                        digitalAssetsObj[industry]["industries"].Instagram.count += 1
                        digitalAssetsObj[industry]["industries"].Instagram.id.push(id)
                        digitalAssetsObj[industry].count += 1
                    }
                    if (website) {
                        websiteData.count += 1
                        websiteData.id.push(id)
                        digitalAssetsObj[industry]["industries"].Website.count += 1
                        digitalAssetsObj[industry]["industries"].Website.id.push(id)
                        digitalAssetsObj[industry].count += 1
                    }
                    if (twitter || facebook || linkedIn || instagram || website) totalCount += 1
                })
            });

        var count = 0, BusinessDir = 0, MarketPlaceDir = 0, JobDir = 0, LocationDir = 0, Forums = 0, Blogger = 0
        var BusinessDirId = [], MarketPlaceDirId = [], JobDirId = [], LocationDirId = [], ForumsId = [], BloggerId = []
        const DirectoryNameArr = ["bloggers", "forum", "jobDirectory", "locationDirectory", "marketplace", "businessDirectory"]
        if (companies) {
            for (let i in companies) {
                let id = companies[i].id;
                let industry = companies[i].industry
                if (!industry) continue;
                let directories = companies[i].directories
                let directoryArr = [], linkArr = []
                let provider = []

                for (let j in directories) {
                    if (DirectoryNameArr.indexOf(directories[j].directory) > -1) {
                        directories[j] && directoryArr.push(directories[j].directory)
                        directories[j] && directories[j].link && linkArr.push(directories[j].link)
                    }
                }

                if (!obj[industry]) {
                    obj[industry] = {
                        industries: {
                            BusinessDir: { count: 0, id: [] },
                            Forums: { count: 0, id: [] },
                            JobDir: { count: 0, id: [] },
                            LocationDir: { count: 0, id: [] },
                            MarketPlaceDir: { count: 0, id: [] },
                            Blogger: { count: 0, id: [] },
                        },
                        count: 0
                    };
                }

                const namePair = (name) => {
                    if (name === "locationDirectory") return "LocationDir"
                    if (name === "marketplace") return "MarketPlaceDir"
                    if (name === "forum") return "Forums"
                    if (name === "jobDirectory") return "JobDir"
                    if (name === "bloggers") return "Blogger"
                    return name
                }

                for (let link in linkArr) {
                    if (!linkArr.hasOwnProperty(link)) continue
                    let hostname = linkArr[link].replace('http://', '').replace('https://', '').replace('www.', '').split(/[/?#]/)[0];
                    provider.push({ label: hostname, key: namePair(directoryArr[link]), id: id })
                }

                allProvider.push(...provider)

                if (directoryArr.indexOf('forum') > -1) {
                    obj[industry]["industries"].Forums.count += 1
                    obj[industry]["industries"].Forums.id.push(id)
                    obj[industry].count += 1
                    ForumsId.push(id)
                    Forums += 1
                    count += 1
                }
                if (directoryArr.indexOf('jobDirectory') > -1) {
                    obj[industry]["industries"].JobDir.count += 1
                    obj[industry]["industries"].JobDir.id.push(id)
                    obj[industry].count += 1
                    JobDirId.push(id)
                    JobDir += 1
                    count += 1
                }
                if (directoryArr.indexOf('locationDirectory') > -1) {
                    obj[industry]["industries"].LocationDir.count += 1
                    obj[industry]["industries"].LocationDir.id.push(id)
                    obj[industry].count += 1
                    LocationDirId.push(id)
                    LocationDir += 1
                    count += 1
                }
                if (directoryArr.indexOf('marketplace') > -1) {
                    obj[industry]["industries"].MarketPlaceDir.count += 1
                    obj[industry]["industries"].MarketPlaceDir.id.push(id)
                    obj[industry].count += 1
                    MarketPlaceDirId.push(id)
                    MarketPlaceDir += 1
                    count += 1
                }
                if (directoryArr.indexOf('businessDirectory') > -1) {
                    obj[industry]["industries"].BusinessDir.count += 1
                    obj[industry]["industries"].BusinessDir.id.push(id)
                    obj[industry].count += 1
                    BusinessDirId.push(id)
                    BusinessDir += 1
                    count += 1
                }
                if (directoryArr.indexOf('bloggers') > -1) {
                    obj[industry]["industries"].Blogger.count += 1
                    obj[industry]["industries"].Blogger.id.push(id)
                    obj[industry].count += 1
                    BloggerId.push(id)
                    Blogger += 1
                    count += 1
                }
            }
        }

        results.push(
            { label: "Blogger", id: BloggerId, count: Blogger },
            { label: "BusinessDir", id: BusinessDirId, count: BusinessDir },
            { label: "Forums", id: ForumsId, count: Forums },
            { label: "JobDir", id: JobDirId, count: JobDir },
            { label: "LocationDir", id: LocationDirId, count: LocationDir },
            { label: "MarketPlaceDir", id: MarketPlaceDirId, count: MarketPlaceDir },
            count
        );

        // let totalCount = websiteData.count + linkedInData.count + facebookData.count + youtubeData.count + twitterData.count + instagramData.count

        digitalAssets.push(
            { label: "Website", id: websiteData.id, count: websiteData.count },
            { label: "LinkedIn", id: linkedInData.id, count: linkedInData.count },
            { label: "Facebook", id: facebookData.id, count: facebookData.count },
            { label: "Youtube", id: youtubeData.id, count: youtubeData.count },
            { label: "Instagram", id: instagramData.id, count: instagramData.count },
            { label: "Twitter", id: twitterData.id, count: twitterData.count },
            totalCount
        );

        const labelKeyCount = (arr) => {
            return [...arr.reduce((r, e) => {
                let k = `${e.label}}|${e.key}`;
                if (!r.has(k)) r.set(k, { label: e.label, key: e.key, id: [e.id], count: 1 })
                else {
                    r.get(k).count++
                    r.get(k).id.push(e.id)
                }
                return r;
            }, new Map).values()]
        }

        const convert = (arr) => {
            var result = {};
            for (var i = 0; i < arr.length; i++) {
                if (!result[arr[i].key]) result[arr[i].key] = {
                    label: [arr[i].label],
                    id: [arr[i].id],
                    count: [arr[i].count],
                    totalCount: arr[i].count
                }
                else {
                    result[arr[i].key].label.push(arr[i].label),
                        result[arr[i].key].id.push(arr[i].id),
                        result[arr[i].key].count.push(arr[i].count),
                        result[arr[i].key].totalCount += arr[i].count
                }
            }
            return result
        }

        return res.status(200).json({
            message: "Successful",
            data: obj,
            digitalAssetsData: digitalAssetsObj,
            digitalAssets: digitalAssets,
            companies: companies,
            results: results,
            provider: convert(labelKeyCount(allProvider).sort((a, b) => b.count - a.count)),
            // dirArr: directoryArr,
            // count: companies.length
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getDigitalFootprint = async function (req, res) {

    const dataset = req.body.dataset;
    const digitals = req.body.digitals;
    const file_name = req.body.file_name;

    let frimographicFilter = req.body.frimographicFilter;
    let digitalPresenceFilter = req.body.digitalPresenceFilter;
    const technologyFilter = req.body.searchedBrands ? req.body.searchedBrands : req.body.technologyFilter
    const restrictTechnologyFilter = req.body.restrictTechnologyFilter
    const otherCompanyIds = req.body.otherCompanyIds

    let whereFilter = [{ dataset }];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    // if (otherCompanyIds) whereFilter.push({ id: { [Op.or]: otherCompanyIds } })

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    // if (digitalPresenceFilter && digitalPresenceFilter.directory) {
    //     if (digitalPresenceFilter.directory.indexOf('0 Presence') > -1) digitalPresenceFilter.directory.push({ [Op.eq]: -1 })
    //     if (digitalPresenceFilter.directory.indexOf('intermediate') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
    //     if (digitalPresenceFilter.directory.indexOf('high') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
    //     if (digitalPresenceFilter.directory.indexOf('advance') > -1) digitalPresenceFilter.directory.push({ [Op.gte]: 8 })
    //     whereFilter.push({ no_of_directory_presence: { [Op.or]: digitalPresenceFilter.directory } })
    // }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }

    let results = [];

    let data = {
        Basic: {
            label: "Basic",
            backgroundColor: '#000000',
            radius: 3.5,
            pointBorderWidth: 0,
            scaleOverride: true,
            scaleSteps: 1,
            scaleStartValue: -1,
            data: []
        },
        Intermediate: {
            label: "Intermediate",
            backgroundColor: '#70AD47',
            radius: 3.5,
            pointBorderWidth: 0,
            scaleOverride: true,
            scaleSteps: 1,
            scaleStartValue: -1,
            data: []
        },
        High: {
            label: "High",
            backgroundColor: '#03B1F1',
            radius: 3.5,
            pointBorderWidth: 0,
            scaleOverride: true,
            scaleSteps: 1,
            scaleStartValue: -1,
            data: []
        },
        Advanced: {
            label: "Advanced",
            backgroundColor: '#4472C5',
            radius: 3.5,
            pointBorderWidth: 0,
            scaleOverride: true,
            scaleSteps: 1,
            scaleStartValue: -1,
            data: []
        },
    }

    let query = {
        Basic: [
            { dataset: dataset },
            { overall_knapshot_score: { [Op.lt]: 2.0 } }
        ],
        Intermediate: [
            { dataset: dataset },
            { overall_knapshot_score: { [Op.gte]: 2.0 } },
            { overall_knapshot_score: { [Op.lt]: 5.0 } }
        ],
        High: [
            { dataset: dataset },
            { overall_knapshot_score: { [Op.gte]: 5.0 } },
            { overall_knapshot_score: { [Op.lt]: 8.0 } }
        ],
        Advanced: [
            { dataset: dataset },
            { overall_knapshot_score: { [Op.gte]: 8.0 } },
        ]
    }

    // if (filename !== "Master DB (Golden Source)") {
    query["Basic"].push(...whereFilter);
    query["Intermediate"].push(...whereFilter);
    query["High"].push(...whereFilter);
    query["Advanced"].push(...whereFilter);
    // }

    try {
        let allCompanies = [];

        if (digitals.indexOf("Basic") >= 0) {
            let companies = await Company.findAll({
                where: { [Op.and]: query["Basic"] },
                include: [
                    { model: Directory }
                ]
            }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))

            allCompanies.push(...companies);
        }

        if (digitals.indexOf("Intermediate") >= 0) {
            let companies = await Company.findAll({
                where: { [Op.and]: query["Intermediate"] },
                include: [
                    { model: Directory }
                ]
            }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
            allCompanies.push(...companies);
        }

        if (digitals.indexOf("High") >= 0) {
            let companies = await Company.findAll({
                where: { [Op.and]: query["High"] },
                include: [
                    { model: Directory }
                ]
            }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
            allCompanies.push(...companies);
        }

        if (digitals.indexOf("Advanced") >= 0) {
            let companies = await Company.findAll({
                where: { [Op.and]: query["Advanced"] },
                include: [
                    { model: Directory }
                ]
            }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
            allCompanies.push(...companies);
        }

        if (otherCompanyIds) {
            let companies = await Company.findAll({
                where: { id: { [Op.or]: otherCompanyIds } },
                include: [
                    { model: Directory }
                ]
            })
            allCompanies.push(...companies);
        }

        if (allCompanies) {
            for (let i = 0; i < allCompanies.length; i++) {

                let company_name = allCompanies[i].company_name;
                let company_id = allCompanies[i].id;
                let total = allCompanies[i].overall_knapshot_score;
                let digitalValue = 0;
                let assetValue = 0;
                let totalTotal = {}

                if (allCompanies[i].website && allCompanies[i].website !== "cannot verify") {
                    digitalValue += 1.2;
                }
                if (allCompanies[i].linkedIn && allCompanies[i].linkedIn !== "cannot verify") {
                    digitalValue += 0.2;
                }
                if (allCompanies[i].facebook && allCompanies[i].facebook !== "cannot verify") {
                    digitalValue += 0.2;
                }
                if (allCompanies[i].twitter && allCompanies[i].twitter !== "cannot verify") {
                    digitalValue += 0.2;
                }
                // if (allCompanies[i].instagram && allCompanies[i].instagram !== "cannot verify") {
                //     digitalValue += 0.1;
                // }
                if (allCompanies[i].company_email_address && allCompanies[i].company_email_address !== "cannot verify") {
                    let mail = allCompanies[i].company_email_address.split('@')[1];
                    if (mail === 'gmail.com' || mail === 'yahoo.com') {
                        digitalValue += 0.2;
                    } else {
                        digitalValue += 0.4;
                    }
                }
                if (allCompanies[i].no_of_directory_presence && allCompanies[i].no_of_directory_presence !== "cannot verify") {
                    if (allCompanies[i].no_of_directory_presence <= 2) digitalValue += 0.2;
                    if (allCompanies[i].no_of_directory_presence >= 3) digitalValue += 0.4;
                }
                if (allCompanies[i].address && allCompanies[i].address !== "cannot verify") {
                    digitalValue += 0.2;
                }
                if (allCompanies[i].main_line_number && allCompanies[i].main_line_number !== "cannot verify" && allCompanies[i].main_line_number !== "+normal") {
                    digitalValue += 0.2;
                }

                // if (allCompanies[i].asset) {
                //     let assets = JSON.parse(allCompanies[i].asset);
                //     for (let [categoryKey, categoryValue] of Object.entries(assets)) {

                //         if (!keyValues[categoryKey]) continue;
                //         for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                //             if (!keyValues[categoryKey].includes(typeKey)) continue;
                //             let brands = [...new Set(typeValue)];
                //             !totalTotal[categoryKey] && (totalTotal[categoryKey] = {});
                //             !totalTotal[categoryKey][typeKey] && (totalTotal[categoryKey][typeKey] = []);
                //             totalTotal[categoryKey][typeKey] = brands;
                //         }
                //     }
                //     let clone = assetDataProcess(totalTotal)
                //     if (clone["Advertising"]) {
                //         let len = 0;
                //         Object.values(clone["Advertising"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 1.4) {
                //                         len += 0.1
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                //     if (clone["Analytics and Tracking"]) {
                //         let len = 0;
                //         Object.values(clone["Analytics and Tracking"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 1.4) {
                //                         len += 0.1
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                //     if (clone["Ecommerce"]) {
                //         let len = 0;
                //         Object.values(clone["Ecommerce"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 1.4) {
                //                         len += 0.1
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                //     if (clone["Productivity"] !== undefined) {
                //         let len = 0;
                //         Object.values(clone["Productivity"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 1.4) {
                //                         len += 0.1
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                //     if (clone["Widgets"]) {
                //         let len = 0;
                //         Object.values(clone["Widgets"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 0.6) {
                //                         len += 0.1
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                //     if (clone["Hosting"] !== undefined) {
                //         let len = 0;
                //         Object.values(clone["Hosting"]).map(a => {
                //             if (a && typeof a === "object" && a.length > 0) {
                //                 a.map(b => {
                //                     if (len < 0.7) {
                //                         len += 0.25
                //                     }
                //                 })
                //             }
                //         })
                //         assetValue += len;
                //     }
                // }

                // let total = assetValue + digitalValue;
                // console.log("total",total)
                // console.log("assetValue + digitalValue",assetValue + digitalValue)

                let xValue = parseFloat((total - digitalValue).toFixed(1));
                let yValue = parseFloat(digitalValue.toFixed(1));

                if (total < 2 && digitals.indexOf("Basic") >= 0) {
                    data["Basic"]["data"].push({ x: xValue, y: yValue, company_name: company_name, company_id: company_id });
                } else if (total >= 2 && total < 5 && digitals.indexOf("Intermediate") >= 0) {
                    data["Intermediate"]["data"].push({ x: xValue, y: yValue, company_name: company_name, company_id: company_id });
                } else if (total >= 5 && total < 8 && digitals.indexOf("High") >= 0) {
                    data["High"]["data"].push({ x: xValue, y: yValue, company_name: company_name, company_id: company_id });
                } else if (total >= 8 && digitals.indexOf("Advanced") >= 0) {
                    data["Advanced"]["data"].push({ x: xValue, y: yValue, company_name: company_name, company_id: company_id });
                }
            }
        }

        return res.status(200).json({ message: "OK", results: Object.values(data), count: allCompanies.length });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.totalTechnologySelect = async function (req, res) {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    // if (digitalPresenceFilter && digitalPresenceFilter.directory) {
    //     if (digitalPresenceFilter.directory.indexOf('0 Presence') > -1) digitalPresenceFilter.directory.push({ [Op.eq]: -1 })
    //     if (digitalPresenceFilter.directory.indexOf('intermediate') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
    //     if (digitalPresenceFilter.directory.indexOf('high') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
    //     if (digitalPresenceFilter.directory.indexOf('advance') > -1) digitalPresenceFilter.directory.push({ [Op.gte]: 8 })
    //     whereFilter.push({ no_of_directory_presence: { [Op.or]: digitalPresenceFilter.directory } })
    // }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }

    let total = {}, sortedTotal = {}, idArr = [], add = 0;

    try {

        const companies = await Company.findAll({
            where: { [Op.and]: whereFilter },
            attributes: ["asset", "id"]
        });

        if (companies) {
            for (let i = 0; i < companies.length; i++) {
                let id = companies[i]["id"];
                // idArr.push(id)
                if (companies[i]["asset"]) {

                    let assets = JSON.parse(companies[i]["asset"]);
                    // if(Object.keys(assets).length === 0) idArr.push(id)

                    for (let [categoryKey, categoryValue] of Object.entries(assets)) {

                        if (!keyValues[categoryKey]) continue;
                        for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                            if (!keyValues[categoryKey].includes(typeKey)) continue;
                            let brands = [...new Set(typeValue)];
                            for (let j = 0; j < brands.length; j++) {
                                add++
                                let brand = brands[j]
                                total[categoryKey] = total[categoryKey] ? total[categoryKey] : {};

                                var total_type = total[categoryKey];
                                total_type[typeKey] = total_type[typeKey] ? total_type[typeKey] : {};

                                var total_brand = total_type[typeKey];

                                if (!total_brand[brand]) {
                                    total_brand[brand] = 0
                                }
                                total_brand[brand]++
                            }
                        }
                    }

                    if (!add) idArr.push(id)
                    add = 0

                    // for (var category in assets) {
                    //     if (!assets.hasOwnProperty(category)) continue;
                    //     if (!keyValues[category]) continue;

                    //     var types = assets[category];
                    //     for (var type in types) {
                    //         if (!types.hasOwnProperty(type)) continue;
                    //         if (!keyValues[category].includes(type)) continue;


                    //         var brands = [...new Set(types[type])];
                    //         for (var j = 0; j < brands.length; j++) {
                    //             var brand = brands[j];

                    //             total[category] = total[category] ? total[category] : {};

                    //             var total_type = total[category];
                    //             total_type[type] = total_type[type] ? total_type[type] : {};

                    //             var total_brand = total_type[type];
                    //             total_brand[brand] = total_brand[brand] ? total_brand[brand] + 1 : 1;

                    //         }
                    //     }
                    // }
                }
                else idArr.push(id)
            }

            // console.log("before", Object.keys(total).length)
            let clone = AssetDP(total)
            // console.log("after", Object.keys(clone).length)

            Object.keys(clone).map(category => {
                Object.keys(clone[category]).map(type => {
                    let obj = clone[category][type];

                    // // Get an array of the keys:
                    let keys = Object.keys(obj);

                    // // Then sort by using the keys to lookup the values in the original object:
                    keys.sort(function (a, b) { return obj[b] - obj[a] });
                    keys.map(brands => {

                        !sortedTotal[category] && (sortedTotal[category] = {});
                        !sortedTotal[category][type] && (sortedTotal[category][type] = {});
                        sortedTotal[category][type][brands] = obj[brands];
                    })
                })
            })


            return res.status(200).json({
                message: "Successful",
                data: sortedTotal,
                idArr: [...new Set(idArr)]
            })
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.totalTechnology = async function (req, res) {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    const technologyFilter = req.body.searchedBrandsFilter ? req.body.searchedBrandsFilter : req.body.technologyFilter
    const restrictTechnologyFilter = req.body.restrictTechnologyFilter

    let maxValue, minValue, selectorValue

    const { expertiseCompanyFilter, categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, partnerFilter, companyFilter, productServiceFilter, userFavCompFilter } = req.body;

    console.log(partnerFilter)

    let whereFilter = [{ dataset }, { asset: { [Op.ne]: null } }];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    let totalCompanyFilter = [], digitalEngagementFilterArr = []

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]
    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]
    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilter.push({ company_name: totalCompanyFilter });


    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.directory) {

        if (digitalPresenceFilter.directory.indexOf('0 Presence') > -1) digitalPresenceFilter.directory.push({ [Op.eq]: -1 })
        if (digitalPresenceFilter.directory.indexOf('intermediate') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.directory.indexOf('high') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.directory.indexOf('advance') > -1) digitalPresenceFilter.directory.push({ [Op.gte]: 8 })
        whereFilter.push({ no_of_directory_presence: { [Op.or]: digitalPresenceFilter.directory } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }

    let obj = {}, industryArray = [], categoryArray = [], total = [], assets, loopCount = 0, outerLoop = 0, companyCount = 0, companyWithAsset = 0
    let add = 0, categoryName
    try {

        const companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            // attributes: ["id", "asset", "industry", "category"],
            include: [
                { model: Directory },
                {
                    model: Expertise,
                    required: false,
                    where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                },
                {
                    model: PersonnelItem,
                },
                {
                    model: FavouriteCompanyList,
                    // where: { user_id: parseInt(user_id) },
                }
            ]
        }).then(COMP => newFilterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))


        if (companies && companies.length) {
            let filteredCompanies = companies.filter((data, index) => {
                let company = data.dataValues
                let total_personnel = data.dataValues.total_personnel
                if (typeof empSizeFilter[0] === "object") {
                    if (selectorValue === '-') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) >= minValue)) return false
                            if (!(parseInt(splitData[1]) <= maxValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData >= minValue)) return false
                            if (!(intData <= maxValue)) return false
                        }
                    }

                    if (selectorValue === '>') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) >= minValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData >= minValue)) return false
                        }
                    }

                    if (selectorValue === '<') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) <= maxValue && parseInt(splitData[1]) >= maxValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData <= maxValue)) return false
                        }
                    }
                }

                if (productServiceFilter.length) {
                    var index = productServiceFilter.indexOf("Blank");
                    const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                    if (!company.product_service && index !== -1) return true
                    if (!company.product_service) return false
                    if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                }

                let expertises = data.dataValues.expertises
                if (partnerFilter && partnerFilter.length) {
                    var index = partnerFilter.indexOf("Blank");
                    for (let single of expertises) {
                        let list = single.dataValues.list
                        if (list === "-") {
                            if (index == "-1") return false
                        }
                        else {
                            let subPartners = []
                            Object.keys(JSON.parse(list)).map(key =>
                                JSON.parse(list)[key].map(subKey => {
                                    let trimSubKey = subKey.trim()
                                    subPartners.push(trimSubKey)
                                }))
                            if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                        }
                    }
                }
                return true

            })

            for (let i = 0; i < filteredCompanies.length; i++) {

                // companyCount++
                industryArray.push(filteredCompanies[i].industry)
                categoryArray.push(filteredCompanies[i].category)
                if (filteredCompanies[i]["asset"]) {

                    // companyWithAsset++
                    assets = JSON.parse(filteredCompanies[i]["asset"]);

                    // for (let [category, categoryValue] of Object.entries(assetDataProcess(assets))) {
                    for (let [category, categoryValue] of Object.entries(assets)) {
                        if (filteredCompanies[i].company_name == "2359 MEDIA (VIETNAM)") console.log("assets", assets)
                        if (filteredCompanies[i].company_name == "2359 MEDIA (VIETNAM)") console.log("check", category, categoryValue)

                        // outerLoop++
                        for (let [type, brands] of Object.entries(categoryValue)) {
                            for (var j = 0; j < brands.length; j++) {
                                var brand = brands[j];
                                total.push({
                                    type,
                                    brand,
                                    id: filteredCompanies[i].id
                                })

                                let id = filteredCompanies[i].id;
                                if (keyValuesPair2[category] && keyValuesPair2[category].includes(type)) {
                                    // loopCount++
                                    categoryName = category
                                    if (!obj[category]) {

                                        obj[category] = {
                                            type: category,
                                            // count: 1,
                                            options: [
                                                {
                                                    label: type,
                                                    count: 1,
                                                    id: [id]
                                                }
                                            ],
                                            industries: [
                                                {
                                                    label: filteredCompanies[i]["industry"],
                                                    key: type,
                                                    count: 1,
                                                    id: [id]
                                                }
                                            ],
                                            categories: [
                                                {
                                                    label: filteredCompanies[i]["category"],
                                                    key: type,
                                                    count: 1,
                                                    id: [id]
                                                }
                                            ]
                                        };
                                    } else {
                                        // obj[category]["count"] += 1;

                                        let isEqual = false;
                                        let industryEqual = false;
                                        let categoryEqual = false;

                                        obj[category]["options"].forEach(item => {
                                            if (item["label"] === type) {
                                                // add++
                                                if (!item["id"].includes(id)) {
                                                    item["count"] += 1;
                                                    item["id"].push(id);
                                                }
                                                isEqual = true;
                                            }
                                        });


                                        obj[category]["industries"].forEach(item => {
                                            if (item["label"] === filteredCompanies[i]["industry"] && item["key"] === type) {
                                                if (!item.id.includes(id)) {
                                                    item["count"] += 1;
                                                    item.id.push(id)
                                                }
                                                industryEqual = true;
                                            }
                                        });

                                        obj[category]["categories"].forEach(item => {
                                            if (item["label"] === filteredCompanies[i]["category"] && item["key"] === type) {
                                                if (!item.id.includes(id)) {
                                                    item["count"] += 1;
                                                    item.id.push(id)
                                                }
                                                categoryEqual = true;
                                            }
                                        });

                                        if (!isEqual) obj[category]["options"].push({ label: type, count: 1, id: [id] });
                                        if (!industryEqual) obj[category]["industries"].push({ label: filteredCompanies[i]["industry"], key: type, count: 1, id: [id] });
                                        if (!categoryEqual) obj[category]["categories"].push({ label: filteredCompanies[i]["category"], key: type, count: 1, id: [id] });
                                    }
                                }
                            }
                        }
                        // if (keyValues[category]) obj[category]["count"] += 1;
                        // if (categoryName && add) obj[categoryName]["count"] += 1;
                        add = 0, categoryName = null
                    }
                }
            }


            var output = [];

            total.forEach(function (item) {
                var existing = output.filter(function (v, i) {
                    return v.type == item.type;
                });
                if (existing.length) {
                    var existingIndex = output.indexOf(existing[0]);
                    output[existingIndex].brand = output[existingIndex].brand.concat(item.brand);
                    output[existingIndex].id = output[existingIndex].id.concat(item.id);
                } else {
                    if (typeof item.brand == 'string') {
                        item.id = [item.id]
                        item.brand = [item.brand];
                    }
                    output.push(item);
                }
            });

            let output2 = []

            let DupCount = (brands, Ids) => {

                let counts = {}, id = {};
                brands.forEach(myFunction)

                function myFunction(x, index) {
                    counts[x] = (counts[x] || 0) + 1;
                    if (Ids) {
                        if (!id[x]) id[x] = []
                        id[x].push(Ids[index])
                    }
                }

                // // Get an array of the keys:
                // let sortedObj = Object.keys(counts);

                // // Then sort by using the keys to lookup the values in the original object:
                // sortedObj.sort(function (a, b) { return obj[a] - obj[b] });


                var sortable = [];
                for (var brand in counts) {
                    sortable.push([brand, counts[brand]]);
                }

                sortable.sort((a, b) => b[1] - a[1]);

                function objectify(array) {
                    return array.reduce(function (p, c) {
                        p[c[0]] = c[1];
                        return p;
                    }, {});
                }

                if (Ids) return id
                return objectify(sortable)
            }

            for (var i in output) {
                if (output[i].brand) output2.push({
                    type: output[i].type,
                    brand: DupCount(output[i].brand),
                    // count: output[i].brand.length,
                    // count: [...new Set(output[i].brand)].length,
                    count: Math.max(...Object.values(DupCount(output[i].brand))),
                    id: DupCount(output[i].brand, output[i].id)
                })
            }

            industryArray = [...new Set(industryArray)]
            categoryArray = [...new Set(categoryArray)]

            Object.values(obj).forEach((item, i) => {
                let totalIdArr = []
                Object.values(item.options).map(option => totalIdArr.push(...option.id))
                item.count = [...new Set(totalIdArr)].length
                item.industryData = industryArray
                item.categoryData = categoryArray
                item.provider = output2

            })

            // console.log("loopCount", loopCount, "Outer", outerLoop, "Company With asset", companyWithAsset, "companyCount", companyCount)
            return res.status(200).json({ message: "Successful", data: Object.values(obj) })
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getRespondentSummary = async function (req, res) {
    let a = []
    let excelname = req.query.excelname
    const responseMap = {
        'S2': 'Vertical',
        'S4': 'Employee Size',
        'S6': 'Years in Operations',
        'S5.1': 'Country Presence',
        'S5.2': 'City Presence',
        'S7': 'Company Revenue',
        'S8': 'Digital Tools Usage'
    }
    try {
        await Survey.findAll({
            attributes: [
                "id", "responses"
            ],
            include: [
                {
                    association: Joint,
                    // where: {surveyId: Sequelize.col('survey.id')},
                    attributes: [
                        'value',
                        'label',
                        'question_identifier'
                    ],
                    // where: {
                    //     selection_type: 'Choose one',
                    //     question_type: 'S'
                    // },
                    as: "survey_responses"
                }
            ],
            where: {
                excel_file_name: excelname + '.csv'
            },
        })
            .then(
                resp => {

                    let responsesArr = [], obj = {}, types = {}
                    for (let row of resp) {
                        for (let instance of row.dataValues.survey_responses) {
                            instance.question_identifier
                            if (!obj[instance.question_identifier]) obj[instance.question_identifier] = []
                            obj[instance.question_identifier].push(instance.value)

                            types[instance.question_identifier] = JSON.parse(row.dataValues.responses)
                        }

                    }

                    for (let [key, value] of Object.entries(obj)) {
                        let obj2 = {}
                        for (let v of value) {
                            if (v) {
                                if (!obj2[v]) obj2[v] = 0
                                obj2[v]++
                            }
                        }
                        let arr2 = []
                        for (let [type, value] of Object.entries(obj2)) {
                            arr2.push(type)
                        }
                        if (!types[key]) continue;
                        let diff = arr_diff([... new Set(arr2)], types[key])
                        for (let i of diff) if (i !== 'unique') obj2[i] = 0
                        responsesArr.push({ labelname: responseMap[key], count: obj2 })
                    }


                    // for (let [key, value] of Object.entries(types)) {
                    //     let obj2 ={}
                    //     for(let v of value){
                    //         if((obj[key].indexOf(v) > -1)) {console.log("true",v)}
                    //         if(!obj2[v]) obj2[v] = 0
                    //         obj2[v]++
                    //         // if(!obj[key]) obj2[v] = 0
                    //         // else{
                    //         //     obj2[v]++
                    //         // }
                    //     }
                    //     responsesArr.push({labelname: responseMap[key],count: obj2})
                    // }
                    // console.log("a[0]", a[0])
                    return res.status(200).json({
                        message: "Successful",
                        data: responsesArr,
                    });
                }
            );

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getQuestionRespondent = async function (req, res) {

    let excelname = req.query.excelname

    const responseMap = {
        'S2': 'Vertical',
        'S4': 'Employee Size',
        'S6': 'Years in Operations',
        'S5.1': 'Country Presence',
        'S5.2': 'City Presence',
        'S7': 'Company Revenue',
        'S8': 'Digital Tools Usage'
    }
    try {
        await Survey.findAll({
            attributes: [
                "id", "responses", "selection_type"
            ],
            where: {
                // selection_type: 'Choose one',
                question_type: 'Q',
                excel_file_name: excelname + '.csv'
            },
            include: [
                {
                    association: Joint,
                    // where: {surveyId: Sequelize.col('survey.id')},
                    attributes: [
                        'value',
                        'label',
                        'question_identifier'
                    ],

                    as: "survey_responses"
                }
            ],
        }).then(
            resp => {
                let responsesArr = {}, obj = {}, types = {}, selection_type = []
                // console.log("resp", resp)

                // for (let row of resp) {
                //     for (let instance of row.dataValues.survey_responses) {
                //         console.log("instance.question_identifier", instance.question_identifier)
                //         if (!obj[instance.question_identifier]) obj[instance.question_identifier] = []
                //         obj[instance.question_identifier].push(instance.value)
                //         // obj[instance.question_identifier].push({type: instance.value, age: instance.value})

                //         types[instance.question_identifier] = JSON.parse(row.dataValues.responses)
                //     }
                // }
                for (let row of resp) {
                    let typ
                    for (var key in row.dataValues) {
                        // console.log("row",row.dataValues)
                        // if (row.dataValues.hasOwnProperty(key)) {

                        // }
                        if (key === 'selection_type') {
                            // if (!obj[key]) obj[key] = []
                            // obj[key].push(row.dataValues[key])
                            typ = row.dataValues[key]
                            // console.log("type", typ)
                        }
                        if (key === 'survey_responses')
                            // console.log(key + " -> " + row.dataValues[key]);
                            for (let instance of row.dataValues[key]) {
                                // console.log("instance",instance)
                                // console.log("instance.question_identifier", instance.dataValues.value)
                                if (!obj[instance.dataValues.question_identifier]) obj[instance.dataValues.question_identifier] = []
                                // obj[instance.question_identifier].push(instance.value)
                                obj[instance.dataValues.question_identifier].push({ type: typ, value: instance.dataValues.value, label: instance.dataValues.label })

                                types[instance.dataValues.question_identifier] = JSON.parse(row.dataValues.responses)
                                // instance.question_identifier
                            }
                    }
                }
                // console.log("selection_type",selection_type)
                // console.log("obj", obj)

                // let promiseChain = Promise.resolve()
                for (let [key, value] of Object.entries(obj)) {
                    // const makeNextPromise = (key) => async () => {
                    let obj2 = {}
                    for (let row of value) {
                        if (row.value) {
                            if (!obj2[row.value]) obj2[row.value] = 0
                            obj2[row.value]++
                        }
                    }

                    let arr2 = []
                    for (let [type, value] of Object.entries(obj2)) {
                        arr2.push(type)
                    }
                    if (!types[key]) continue
                    let diff = arr_diff([... new Set(arr2)], types[key])
                    for (let i of diff) if (i !== 'unique') obj2[i] = 0
                    responsesArr[key] = { value: obj2, type: value[0].type, label: value[0].label, responses: types[key] }
                    // }
                    // promiseChain = promiseChain.then(makeNextPromise(key))
                }


                // Promise.all([promiseChain]).then(() => {
                return res.status(200).json({
                    message: "Successful",
                    data: responsesArr,
                })
                // })
            }
        );

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getExcelFileNames = async (req, res) => {
    try {
        const excelName = await db.query(
            `select excel_file_name from survey group by excel_file_name`,
            {
                type: db.QueryTypes.SELECT
            }
        )

        return res.status(200).json({
            message: 'Successful',
            excelFiles: excelName.map(x => x.excel_file_name.replace('.csv', ''))
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
}

exports.getOverlayData = async function (req, res) {

    let excelname = req.query.excelname
    let qid = req.body.qid

    const responseMap = {
        'Vertical': 'S2',
        'Employee Size': 'S4',
        'Years in Operations': 'S6',
        'Country Presence': 'S5.1',
        'City Presence': 'S5.2',
        'Company Revenue': 'S7',
        'Digital Tools Usage': 'S8'
    }

    const overlayType = responseMap[req.body.value]

    // const getValue = (arr, filter) => {
    //     return arr.filter(x => {
    //         for (let key in filter) {
    //             if (x[key] === undefined || x[key] != filter[key]) return false
    //         }
    //         return true
    //     })[0].value
    // }

    try {
        await Survey.findAll({
            where: {
                selection_type: 'Choose one',
                question_type: ['Q', "S"],
                excel_file_name: excelname + '.csv'
            },
            include: [
                {
                    association: Joint,
                    // where: {surveyId: Sequelize.col('survey.id')},
                    as: "survey_responses"
                }
            ],
        }).then(
            resp => {

                let arr = [], train = [], test = [], question_identifier = [], unique_identifier = [], final = []
                resp.map(res => res.dataValues.survey_responses.map(res2 => arr.push(res2)))

                arr.map(res => {
                    unique_identifier.push(res.unique_identifier)
                    question_identifier.push(res.question_identifier)
                })

                unique_identifier = [... new Set(unique_identifier)]
                question_identifier = [... new Set(question_identifier)]

                train = arr.filter(x => x.question_identifier === qid).map(y => {
                    let obj = {}
                    obj[y.value] = y.unique_identifier
                    return obj
                })

                let trainData = {}, trainData2 = {}
                let promiseChain = Promise.resolve()
                for (let row of train) {
                    for (let [key, value] of Object.entries(row)) {
                        if (!trainData[key]) trainData[key] = []
                        trainData[key].push(arr.filter(x => x.unique_identifier === value && x.question_identifier === overlayType)[0].value)
                    }
                }
                for (let [key, value] of Object.entries(trainData)) {
                    const makeNextPromise = (key) => async () => {
                        let count = {}
                        if (!trainData2[key]) trainData2[key] = {}
                        value.map(x => {
                            if (!count[x]) count[x] = 0
                            count[x]++
                        })
                        trainData2[key] = count
                    }
                    promiseChain = promiseChain.then(makeNextPromise(key))
                }

                //     // let promiseChain = Promise.resolve()
                //     for (let [key, value] of Object.entries(obj)) {
                //         // const makeNextPromise = (key) => async () => {
                //             let obj2 = {}
                //             for (let row of value) {
                //                 if (row.value) {
                //                     if (!obj2[row.value]) obj2[row.value] = 0
                //                     obj2[row.value]++
                //                 }
                //             }
                //             let arr2 = []
                //             for (let [type, value] of Object.entries(obj2)) {
                //                 arr2.push(type)
                //             }
                //             if (!types[key]) continue
                //             let diff = arr_diff([... new Set(arr2)], types[key] )
                //             for (let i of diff) if (i !== 'unique') obj2[i] = 0
                //             responsesArr[key] = { value: obj2, type: value[0].type, label: value[0].label, responses: types[key] }
                //         // }
                //         // promiseChain = promiseChain.then(makeNextPromise(key))
                //     }


                Promise.all([promiseChain]).then(() => {
                    return res.status(200).json({
                        message: "Successful",
                        // data1: train,
                        data: trainData2,
                        // res11: test,
                        a: arr.length
                    })
                })
            }
        );

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getCompanyByOverlay = async (req, res) => {
    const value = req.body.value
    const filename = req.body.filename
    const label = req.body.label
    const overlayType = req.body.overlayType
    const qi = req.body.qi
    // console.log("value", value)
    // console.log("filename", filename)
    // console.log("label", label)
    // console.log("overlayType", overlayType)
    // console.log("qi", qi)
    let Sarr = [], Qarr = []
    try {
        await SurveyResponse.findAll({
            attributes: ["unique_identifier"],
            where: {
                [Op.and]: [
                    { value: label },
                    { question_identifier: qi }
                ]
            },
            include: [
                {
                    model: Survey,
                    as: 'survey',
                    where: {
                        excel_file_name: filename + '.csv'
                    }
                }
            ]
        }).then(
            resp => {
                resp.map(x => Qarr.push(x.dataValues.unique_identifier))
            }
        )

        await SurveyResponse.findAll({
            attributes: ["unique_identifier", "CompanySurveyId"],
            where: {
                [Op.and]: [
                    { value: value },
                    { question_identifier: overlayType }
                ]
            },
            include: [
                {
                    model: Survey,
                    as: 'survey',
                    where: {
                        excel_file_name: filename + '.csv'
                    }
                }
            ]
        }).then(
            resp => {
                resp.map(x => Sarr.push({ [x.dataValues.unique_identifier]: x.dataValues.CompanySurveyId }))
            }
        )

    } catch (error) {

    }
    let a = []
    Sarr.map(value => {
        for (let [key, id] of Object.entries(value)) {

            Qarr.filter(x => x === key).map(y => a.push(value[key]))
        }
    })
    return res.status(200).json({
        message: "Successful",
        data: a,
    })

}

exports.getCompanySurveyId = async (req, res) => {
    const websiteArr = req.body.websiteArr
    const fileName = req.body.fileName

    let data = [], unique = []
    let promiseChain = Promise.resolve()
    for (let webValue of websiteArr) {
        for (let [key, k] of Object.entries(webValue)) {
            let subData
            const makeNextPromise = (key) => async () => {
                try {
                    subData = await Company.findAll({
                        attributes: ["id"],
                        where: {
                            website: k
                        },
                        include: [
                            {
                                attributes: ["unique_identifier"],
                                association: Joint,
                                as: "survey_responses",
                                include: [
                                    {
                                        model: Survey,
                                        as: 'survey',
                                        where: { excel_file_name: fileName }
                                    }
                                ]
                            }
                        ],
                    }).then(
                        async resp => {
                            const id = resp[0].dataValues.id
                            CompanySurveyIdUpdate(fileName, id, key)

                        }
                    )
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }
            }
            promiseChain = promiseChain.then(makeNextPromise(key))
            data.push({ subData: subData })
            unique.push({ uniqueid: key })
        }
    }
    // console.log("d", data)
    Promise.all([promiseChain]).then(() => {
        return res.status(200).json({
            message: "Successful",
            data: data,
            uniqueId: unique
        })
    })
}

const CompanySurveyIdUpdate = async (filename, id, uniqueId) => {

    try {
        await SurveyResponse.findAll({
            where: {
                unique_identifier: uniqueId
            },
            include: [
                {
                    model: Survey,
                    as: 'survey',
                    where: {
                        excel_file_name: filename
                    }
                }
            ]
        }).map(
            row => {
                // console.log("Reas",row)
                row.update({
                    CompanySurveyId: id,
                })
            }
        )
        // await Survey.findAll({
        //     where: {

        //         excel_file_name: filename
        //     },
        //     include: [
        //         {
        //             association: Joint,
        //             as: 'survey_responses',
        //             where: {
        //                 unique_identifier: uniqueId
        //             }
        //         }
        //     ]
        // }).then(
        //     row => {
        //         console.log("Reas",row)
        //         // row.update({
        //         //     CompanySurveyId: id,
        //         // })
        //     }
        // )
    } catch (err) {

    }
}

exports.excelExport = async (req, res) => {
    let data = []
    let fileName = req.query.filename
    try {
        await Company.findAll({
            where: {
                // file_name: 'Google-social media agencies',
                file_name: fileName,
            },
            include: [
                { model: Directory }
            ]

        })
            .then(
                resp => {
                    let total
                    let directories
                    return XlsxPopulate.fromFileAsync("./Book1.xlsx")
                        .then(workbook => {

                            let i = 1
                            for (let row of resp) {
                                i++
                                directories = row.dataValues.directories
                                total = {}
                                let digital_engagement

                                if (row.dataValues.overall_knapshot_score < 2) digital_engagement = 'Basic'
                                if (row.dataValues.overall_knapshot_score >= 2 && row.dataValues.overall_knapshot_score < 5) digital_engagement = 'Intermediate'
                                if (row.dataValues.overall_knapshot_score >= 5 && row.dataValues.overall_knapshot_score < 8) digital_engagement = 'High'
                                if (row.dataValues.overall_knapshot_score >= 8) digital_engagement = 'Advance'

                                directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))

                                let assets = JSON.parse(row.dataValues.asset)


                                if (assets) for (var category in assets) {
                                    if (!assets.hasOwnProperty(category)) continue;
                                    if (!keyValues[category]) continue;

                                    var types = assets[category];
                                    for (var type in types) {
                                        if (!types.hasOwnProperty(type)) continue;
                                        if (!keyValues[category].includes(type)) continue;


                                        var brands = [...new Set(types[type])];
                                        for (var j = 0; j < brands.length; j++) {
                                            var brand = brands[j];

                                            total[category] = total[category] ? total[category] : {};

                                            var total_type = total[category];
                                            total_type[type] = total_type[type] ? total_type[type] : [];

                                            total[category][type].push(brand)
                                        }
                                    }
                                }

                                // console.log("row.dataValues.address", row.dataValues.address)

                                const techno = workbook.sheet(0).range(`A${i}:AC${i}`);
                                techno.value([
                                    [
                                        row.dataValues.company_name,
                                        row.dataValues.dataset,
                                        row.dataValues.industry,
                                        row.dataValues.website,
                                        digital_engagement,
                                        row.dataValues.overall_knapshot_score,
                                        row.dataValues.year_of_operation,
                                        row.dataValues.total_personnel,
                                        row.dataValues.main_hq_location,
                                        directories.length,
                                        directories.map(d => d.directory).toString(),
                                        getBrandData(total, 'Advertising', 'Audience Targeting').toString(),
                                        getBrandData(total, 'Advertising', 'Retargeting / Remarketing').toString(),
                                        getBrandData(total, 'Advertising', 'ads txt').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'Tag Management').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'Audience Measurement').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'Advertiser Tracking').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'Lead Generation').toString(),
                                        getBrandData(total, 'Email Hosting Providers', 'Campaign Management').toString(),
                                        getBrandData(total, 'Widgets', 'Marketing Automation').toString(),
                                        getBrandData(total, 'Analytics and Tracking', 'CRM').toString(),
                                        getBrandData(total, 'Widgets', 'Live Chat').toString(),
                                        getBrandData(total, 'Widgets', 'Login').toString(),
                                        getBrandData(total, 'Ecommerce', 'Non Platform').toString(),
                                        getBrandData(total, 'Payment', 'Checkout Buttons').toString(),
                                        getBrandData(total, 'Payment', 'Payments Processor').toString(),
                                        getBrandData(total, 'Email Hosting Providers', 'Campaign Management').toString(),
                                        row.dataValues.file_name,
                                    ]
                                ]);

                                const contact = workbook.sheet(1).range(`A${i}:J${i}`);
                                contact.value([
                                    [
                                        row.dataValues.company_name,
                                        row.dataValues.dataset,
                                        digital_engagement,
                                        row.dataValues.website,
                                        row.dataValues.facebook,
                                        row.dataValues.linkedIn,
                                        row.dataValues.twitter,
                                        row.dataValues.main_line_number,
                                        row.dataValues.company_email_address,
                                        row.dataValues.address
                                    ]
                                ])
                            }
                            return workbook.toFileAsync("./excelData.xlsx")
                        }).then((data) => {
                            res.type = 'application/vnd.openxmlformats'
                            res.sendFile(path.resolve('excelData.xlsx'))
                            res.body = data
                        });
                }
            )
    } catch (error) {
        console.log("error", error)
    }
}


exports.newExcelExport = async (req, res) => {
    let companyContactMapping = {
        "Website": "website",
        "LinkedIn": "linkedIn",
        "Facebook": "facebook",
        "Instagram": "instagram",
        "Twitter": "twitter",
        "Youtube": "youtube",
        "Main Line Number": "main_line_number",
        "Email Address": "company_email_address",
    }

    let companyFrimographicMapping = {
        "Industry": "industry",
        "Category": "category",
        "Products/Services": "product_service",
        "Years in Operation": "year_in_operation",
        "Employee Size": "total_personnel",
        "HQ Location": "main_hq_location",
        "Knapshot Score": "overall_knapshot_score"
    }

    // let allTechno = [
    //     "ads txt","Audience Targeting", "Contextual Advertising","Dynamic Creative Optimization","Digital Video Ads","Retargeting / Remarketing",
    //     "Application Performance","Conversion Optimization", "Advertiser Tracking", "Tag Management", "Audience Measurement","Visitor Count Tracking",
    //     "CRM","Campaign Management","Lead Generation","Product Recommendations", "Feedback Forms and Surveys","Marketing Automation",
    //     "Non Platform","Hosted Solution","Open Source","Checkout Buttons","Payments Processor","Payment Currency",
    //     "Cloud Hosting","Cloud PaaS","Dedicated Hosting","Business Email Hosting","Web Hosting Provider Email","Marketing Platform",
    //     "Live Chat","Login","Ticketing System","Bookings","Social Sharing","Schedule Management"
    // ]

    const requestedData = req.body.requestedData;

    let data = []
    try {
        data = await CompanyItem.findAll(
            {
                include: [
                    {
                        model: Expertise,
                    },
                    {
                        model: Directory,
                    }
                ]
            }).then(
                resp => {
                    let total
                    let directories
                    return XlsxPopulate.fromFileAsync('./excelData2.xlsx')
                        .then(workbook => {

                            let i = 1
                            if (resp) for (let row of resp) {
                                i++
                                directories = row.dataValues.directories
                                total = {}
                                let digital_engagement

                                if (row.dataValues.overall_knapshot_score < 2) digital_engagement = 'Basic'
                                if (row.dataValues.overall_knapshot_score >= 2 && row.dataValues.overall_knapshot_score < 5) digital_engagement = 'Intermediate'
                                if (row.dataValues.overall_knapshot_score >= 5 && row.dataValues.overall_knapshot_score < 8) digital_engagement = 'High'
                                if (row.dataValues.overall_knapshot_score >= 8) digital_engagement = 'Advance'

                                directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))

                                let assets = JSON.parse(row.dataValues.asset)


                                if (assets) for (var category in assets) {
                                    if (!assets.hasOwnProperty(category)) continue;
                                    if (!keyValues[category]) continue;

                                    var types = assets[category];
                                    for (var type in types) {
                                        if (!types.hasOwnProperty(type)) continue;
                                        if (!keyValues[category].includes(type)) continue;


                                        var brands = [...new Set(types[type])];
                                        for (var j = 0; j < brands.length; j++) {
                                            var brand = brands[j];

                                            total[category] = total[category] ? total[category] : {};

                                            var total_type = total[category];
                                            total_type[type] = total_type[type] ? total_type[type] : [];

                                            total[category][type].push(brand)
                                        }
                                    }
                                }

                                let expertise = row.dataValues.expertises;


                                let frimographicArr = ["Company Name", "Country"], frimographicDataArr = [row.dataValues.company_name, row.dataValues.dataset];
                                let companyContactArr = ["Company Name", "Country"], companyContactDataArr = [row.dataValues.company_name, row.dataValues.dataset]
                                let technographicArr = ["Company Name", "Country"], technographicDataArr = [row.dataValues.company_name, row.dataValues.dataset]

                                for (let column of requestedData) {

                                    if (column === "Company Name" || column === "Country") continue

                                    if (companyContactMapping[column]) {
                                        companyContactArr.push(column)
                                        companyContactDataArr.push(row.dataValues[companyContactMapping[column]])
                                    }

                                    else if (companyFrimographicMapping[column]) {
                                        frimographicArr.push(column)
                                        frimographicDataArr.push(row.dataValues[companyFrimographicMapping[column]])
                                    }

                                    else if (column === "Partners") {
                                        if (expertise.length == 0) {
                                            frimographicArr.push(column)
                                            frimographicDataArr.push("-")
                                        }
                                        else for (let single of expertise) {
                                            let { type, list } = single.dataValues
                                            let subPartners = []
                                            if (type == "Partners") {
                                                if (list === "-") {
                                                    frimographicArr.push(column)
                                                    frimographicDataArr.push("-")
                                                }
                                                else {
                                                    Object.keys(JSON.parse(list)).map(key =>
                                                        JSON.parse(list)[key].map(subKey => {
                                                            let trimSubKey = subKey.trim()
                                                            subPartners.push(trimSubKey)
                                                        }))
                                                    frimographicArr.push(column)
                                                    frimographicDataArr.push(subPartners.toString())
                                                }

                                            }
                                        }
                                    }

                                    else if (column == "Awards") {
                                        if (expertise.length == 0) {
                                            frimographicArr.push(column)
                                            frimographicDataArr.push("-")
                                        }
                                        else for (let single of expertise) {
                                            let { type, list } = single.dataValues
                                            if (type == "Awards & Accolades") {
                                                frimographicArr.push(column)
                                                frimographicDataArr.push(list)
                                            }
                                        }
                                    }

                                    else {
                                        technographicArr.push(column)
                                        technographicDataArr.push(getBrandData(total, typeCategoryPair[column], column).toString())
                                    }
                                }
                                // console.log("frimographicArr", frimographicArr)
                                const frimographicCol = workbook.sheet(0).range(`A${1}:K${1}`)
                                frimographicCol.value([frimographicArr])

                                const frimographic = workbook.sheet(0).range(`A${i}:K${i}`);
                                frimographic.value([frimographicDataArr])

                                const companyCol = workbook.sheet(1).range(`A${1}:J${1}`)
                                companyCol.value([companyContactArr])

                                const comp = workbook.sheet(1).range(`A${i}:J${i}`);
                                comp.value([companyContactDataArr]);

                                const technoCol = workbook.sheet(2).range(`A${1}:AL${1}`)
                                technoCol.value([technographicArr])

                                const compTechno = workbook.sheet(2).range(`A${i}:AL${i}`);
                                compTechno.value([technographicDataArr]);
                            }
                            return workbook.toFileAsync("./excelData.xlsx")

                        }).then((data) => {
                            res.type = 'application/vnd.openxmlformats'
                            res.sendFile(path.resolve('excelData.xlsx'))
                            res.body = data

                        });
                }
            )

    } catch (err) {
        console.log("ERROR", err)
        return res.status(500).json({
            message: err.message
        })

    }


}

exports.priorityScoreExport = async (req, res) => {
    let data = []
    let fileName = req.query.filename
    try {
        await Company.findAll({
            where: {
                // file_name: 'Google-social media agencies',
                file_name: fileName,
            },
            include: [
                { model: Directory },
                { model: Expertise },
                { model: Client }
            ]

        })
            .then(
                resp => {
                    // console.log(resp)
                    let total
                    let directories, expertise, client
                    return XlsxPopulate.fromFileAsync("./Priority Score.xlsx")
                        .then(workbook => {


                            let i = 1
                            let sheet2 = 1
                            for (let row of resp) {
                                i++
                                directories = row.dataValues.directories
                                expertise = row.dataValues.expertises
                                client = row.dataValues.clients
                                // console.log(client)
                                let p2keywords = '', p1keywords = '', offeringKeywords = '', kwCount = 0
                                let expertiseLists = '-', partnerLists = '-', clientLists = [], awardsOrAccoldateLists = '-'
                                let expertiseCount = '-', partnerCount = '-', clientCount = '-', awardsOrAccoldateCount = '-'

                                expertise.filter(y => y.type === 'P2Keyword').map(x => {
                                    p2keywords = x.list
                                })
                                expertise.filter(y => y.type === 'P1Keyword').map(x => {
                                    p1keywords = x.list
                                })
                                expertise.filter(y => y.type === 'OfferingKeyword').map(x => {
                                    offeringKeywords = x.list
                                })
                                expertise.filter(y => y.type === 'Expertise').map(x => {
                                    expertiseLists = x.list
                                })
                                expertise.filter(y => y.type === 'Partners').map(x => {
                                    partnerLists = x.list
                                })
                                // expertise.filter(y => y.type === 'Clients').map(x => {
                                //     clientLists = x.list
                                // })
                                expertise.filter(y => y.type === 'Awards & Accolades').map(x => {
                                    awardsOrAccoldateLists = x.list
                                })

                                client.map(x => {
                                    clientLists.push(x.dataValues.client_name)
                                })
                                console.log(clientLists)
                                // (("str1,str2,str3,str4".match(new RegExp("str", "g")) || []).length
                                if (p1keywords.length > 0 && p2keywords.length > 0) {
                                    // console.log("k",p1keywords,'|',p2keywords)
                                    kwCount = (p1keywords.match(new RegExp(",", "g")) || []).length + (p2keywords.match(new RegExp(",", "g")) || []).length + 2
                                } else kwCount = 0
                                if (expertiseLists !== '-' && expertiseLists.length > 0) {
                                    // console.log("e",expertiseLists)
                                    // expertiseCount = (expertiseLists.match(new RegExp(",", "g")) || []).length + 1
                                    expertiseCount = expertiseLists.split(',').length
                                } else expertiseCount = 0
                                if (partnerLists !== '-' && partnerLists.length) {
                                    // console.log("p",partnerLists)
                                    // partnerCount = (partnerLists.match(new RegExp(",", "g")) || []).length + 1
                                    partnerCount = partnerLists.split(',').length
                                } else partnerCount = 0
                                if (clientLists !== '-' && clientLists.length > 0) {
                                    // console.log("c",clientLists)
                                    // clientCount = (clientLists.match(new RegExp(",", "g")) || []).length + 1
                                    // clientCount = clientLists.split(',').length
                                    clientCount = clientLists.length
                                } else clientCount = 0
                                if (awardsOrAccoldateLists !== '-' && awardsOrAccoldateLists.length > 0) {
                                    // console.log("a", awardsOrAccoldateLists)
                                    // awardsOrAccoldateCount = (awardsOrAccoldateLists.match(new RegExp(",", "g")) || []).length + 1
                                    awardsOrAccoldateCount = awardsOrAccoldateLists.split(',').length
                                } else awardsOrAccoldateLists = 0
                                console.log("partnerCount", partnerCount)

                                total = {}
                                let digital_engagement
                                let keyword_score = 0, priority_score = 0, digital_presence_score = 0, credibilityScore = 0, marketingToolsUsageScore = 0, expertiseScore = 0

                                if (row.dataValues.overall_knapshot_score < 2) digital_engagement = 'Basic'
                                if (row.dataValues.overall_knapshot_score >= 2 && row.dataValues.overall_knapshot_score < 5) digital_engagement = 'Intermediate'
                                if (row.dataValues.overall_knapshot_score >= 5 && row.dataValues.overall_knapshot_score < 8) digital_engagement = 'High'
                                if (row.dataValues.overall_knapshot_score >= 8) digital_engagement = 'Advance'

                                if (row.dataValues.website) digital_presence_score += 0.75
                                if (row.dataValues.facebook) digital_presence_score += 0.2
                                if (row.dataValues.instagram) digital_presence_score += 0.2
                                if (row.dataValues.twitter) digital_presence_score += 0.2
                                if (row.dataValues.linkedIn) digital_presence_score += 0.2
                                if (row.dataValues.youtube) digital_presence_score += 0.2
                                // if (directories) {
                                //     if (directories.length >= 1 && directories.length <= 2) digital_presence_score += 0.25
                                //     else if (directories.length >= 3 && directories.length <= 4) digital_presence_score += 0.5
                                //     // else if (directories.length >= 5 && directories.length <= 6) digital_presence_score += 0.6
                                //     // else if (directories.length >= 7 && directories.length <= 8) digital_presence_score += 0.8
                                //     // else if (directories.length >= 9 && directories.length <= 10) digital_presence_score += 1.0
                                //     else if (directories.length >= 5) digital_presence_score += 0.75
                                //     else digital_presence_score += 0
                                // } else digital_presence_score += 0
                                if (row.dataValues.no_of_directory_presence >= 1 && row.dataValues.no_of_directory_presence <= 2) digital_presence_score += 0.25
                                else if (row.dataValues.no_of_directory_presence >= 3 && row.dataValues.no_of_directory_presence <= 4) digital_presence_score += 0.5
                                // else if (row.dataValues.no_of_directory_presence >= 5 && row.dataValues.no_of_directory_presence <= 6) digital_presence_score += 0.6
                                // else if (row.dataValues.no_of_directory_presence >= 7 && row.dataValues.no_of_directory_presence <= 8) digital_presence_score += 0.8
                                // else if (row.dataValues.no_of_directory_presence >= 9 && row.dataValues.no_of_directory_presence <= 10) digital_presence_score += 1.0
                                else if (row.dataValues.no_of_directory_presence >= 5) digital_presence_score += 0.75
                                else digital_presence_score += 0

                                if (kwCount > 0 && kwCount <= 2) expertiseScore += 0.2
                                else if (kwCount >= 3 && kwCount <= 4) expertiseScore += 0.4
                                else if (kwCount >= 5 && kwCount <= 6) expertiseScore += 0.6
                                else if (kwCount >= 7) expertiseScore += 1.0
                                else expertiseScore += 0

                                if (expertiseCount === 1) {
                                    expertiseScore += 0.2
                                    credibilityScore += 0.2
                                }
                                else if (expertiseCount === 2) {
                                    expertiseScore += 0.4
                                    credibilityScore += 0.4
                                }
                                else if (expertiseCount > 2) {
                                    expertiseScore += 0.5
                                    credibilityScore += 0.5
                                }
                                else {
                                    expertiseScore += 0
                                    credibilityScore += 0
                                }

                                if (partnerCount === 1) {
                                    expertiseScore += 0.2
                                    credibilityScore += 0.2
                                }
                                else if (partnerCount === 2) {
                                    expertiseScore += 0.4
                                    credibilityScore += 0.4
                                }
                                else if (partnerCount > 2) {
                                    expertiseScore += 0.5
                                    credibilityScore += 0.5
                                }
                                else {
                                    expertiseScore += 0
                                    credibilityScore += 0
                                }

                                if (clientCount >= 1 && clientCount <= 2) {
                                    expertiseScore += 0.1
                                    credibilityScore += 0.1
                                }
                                else if (clientCount >= 3 && clientCount <= 4) {
                                    expertiseScore += 0.2
                                    credibilityScore += 0.2
                                }
                                else if (clientCount >= 5 && clientCount <= 6) {
                                    expertiseScore += 0.3
                                    credibilityScore += 0.3
                                }
                                else if (clientCount >= 7 && clientCount <= 8) {
                                    expertiseScore += 0.4
                                    credibilityScore += 0.4
                                }
                                else if (clientCount >= 9) {
                                    expertiseScore += 0.5
                                    credibilityScore += 0.5
                                }
                                else {
                                    expertiseScore += 0
                                    credibilityScore += 0
                                }

                                if (row.dataValues.dataset === row.dataValues.main_hq_location) credibilityScore += 0
                                else credibilityScore += 0.5
                                if (row.dataValues.year_in_operation) {
                                    if (row.dataValues.year_in_operation <= 1) credibilityScore += 0.1
                                    if (row.dataValues.year_in_operation >= 2 && row.dataValues.year_in_operation <= 4) credibilityScore += 0.2
                                    if (row.dataValues.year_in_operation >= 5 && row.dataValues.year_in_operation <= 6) credibilityScore += 0.3
                                    if (row.dataValues.year_in_operation >= 7 && row.dataValues.year_in_operation <= 8) credibilityScore += 0.4
                                    else if (row.dataValues.year_in_operation >= 9) credibilityScore += 0.5
                                    else credibilityScore += 0
                                } else credibilityScore += 0
                                if (row.dataValues.total_personnel) {
                                    if (row.dataValues.total_personnel === '<10 Employees') credibilityScore += 0.2
                                    else if (row.dataValues.total_personnel === '11-50 Employees') credibilityScore += 0.4
                                    else if (row.dataValues.total_personnel === '201-500 Employees') credibilityScore += 0.6
                                    else if (row.dataValues.total_personnel === '501-1000 Employees') credibilityScore += 0.8
                                    else if (row.dataValues.total_personnel === '>1000 Employees' || row.dataValues.total_personnel === '1001-5000 Employees' || row.dataValues.total_personnel === '5001-10000 Employees' || row.dataValues.total_personnel === '>10000 Employees') credibilityScore += 1.0
                                    else credibilityScore += 0
                                } else credibilityScore += 0
                                if (awardsOrAccoldateCount === 1) credibilityScore += 0.1
                                else if (awardsOrAccoldateCount === 2) credibilityScore += 0.2
                                else if (awardsOrAccoldateCount === 3) credibilityScore += 0.3
                                else if (awardsOrAccoldateCount === 4) credibilityScore += 0.4
                                else if (awardsOrAccoldateCount > 4) credibilityScore += 0.5
                                else credibilityScore += 0


                                directories = directories.filter(d => ["marketplace", "infoDirectory", "locationDirectory", "jobDirectory", "forum", "bloggers"].includes(d.directory))

                                let assets = JSON.parse(row.dataValues.asset)

                                if (assets) for (var category in assets) {
                                    if (!assets.hasOwnProperty(category)) continue;
                                    if (!keyValues[category]) continue;

                                    var types = assets[category];
                                    for (var type in types) {
                                        if (!types.hasOwnProperty(type)) continue;
                                        if (!keyValues[category].includes(type)) continue;


                                        var brands = [...new Set(types[type])];
                                        for (var j = 0; j < brands.length; j++) {
                                            var brand = brands[j];

                                            total[category] = total[category] ? total[category] : {};

                                            var total_type = total[category];
                                            total_type[type] = total_type[type] ? total_type[type] : [];

                                            total[category][type].push(brand)
                                        }
                                    }
                                }

                                // console.log("row.dataValues.address", row.dataValues.address)
                                if (getBrandData(total, 'Analytics and Tracking', 'Tag Management') === '-') marketingToolsUsageScore += 0
                                else {
                                    if (getBrandData(total, 'Analytics and Tracking', 'Tag Management').length === 1) marketingToolsUsageScore += 0.3
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Tag Management').length === 2) marketingToolsUsageScore += 0.6
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Tag Management').length > 2) marketingToolsUsageScore += 0.75
                                    else marketingToolsUsageScore += 0
                                }

                                if (getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization') === '-') marketingToolsUsageScore += 0
                                else {
                                    if (getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').length === 1) marketingToolsUsageScore += 0.3
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').length === 2) marketingToolsUsageScore += 0.6
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').length > 2) marketingToolsUsageScore += 0.75
                                    else marketingToolsUsageScore += 0
                                }

                                if (getBrandData(total, 'Analytics and Tracking', 'Lead Generation') === '-') marketingToolsUsageScore += 0
                                else {
                                    if (getBrandData(total, 'Analytics and Tracking', 'Lead Generation').length === 1) marketingToolsUsageScore += 0.3
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Lead Generation').length === 2) marketingToolsUsageScore += 0.6
                                    else if (getBrandData(total, 'Analytics and Tracking', 'Lead Generation').length > 2) marketingToolsUsageScore += 0.75
                                    else marketingToolsUsageScore += 0
                                }

                                if (getBrandData(total, 'Widgets', 'Marketing Automation') === '-') marketingToolsUsageScore += 0
                                else {
                                    if (getBrandData(total, 'Widgets', 'Marketing Automation').length === 1) marketingToolsUsageScore += 0.3
                                    else if (getBrandData(total, 'Widgets', 'Marketing Automation').length === 2) marketingToolsUsageScore += 0.6
                                    else if (getBrandData(total, 'Widgets', 'Marketing Automation').length > 2) marketingToolsUsageScore += 0.75
                                    else marketingToolsUsageScore += 0
                                }

                                priority_score = digital_presence_score + expertiseScore + credibilityScore + marketingToolsUsageScore

                                const techno = workbook.sheet(0).range(`A${i}:AE${i}`);
                                techno.value([
                                    [
                                        row.dataValues.dataset || '-',
                                        row.dataValues.company_name || '-',
                                        priority_score || '-',
                                        row.dataValues.main_line_number || '-',
                                        row.dataValues.company_email_address || '-',
                                        row.dataValues.overall_knapshot_score || '-',
                                        row.dataValues.website || '-',
                                        keyword_score,
                                        row.dataValues.facebook || '-',
                                        row.dataValues.instagram || '-',
                                        row.dataValues.twitter || '-',
                                        row.dataValues.linkedIn || '-',
                                        row.dataValues.youtube || '-',
                                        // directories.map(d => d.directory).toString() || '-',
                                        row.dataValues.no_of_directory_presence || '-',
                                        digital_presence_score || '-',
                                        offeringKeywords || '-',
                                        (p1keywords || '-') + ' | ' + (p2keywords || '-'),
                                        expertiseLists || '-',
                                        partnerLists || '-',
                                        clientLists.toString() || '-',
                                        expertiseScore || '-',
                                        row.dataValues.main_hq_location || '-',
                                        row.dataValues.year_in_operation || '-',
                                        row.dataValues.total_personnel || '-',
                                        awardsOrAccoldateLists || '-',
                                        credibilityScore || '-',
                                        getBrandData(total, 'Analytics and Tracking', 'Tag Management').toString() || '-',
                                        getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').toString() || '-',
                                        getBrandData(total, 'Analytics and Tracking', 'Lead Generation').toString() || '-',
                                        getBrandData(total, 'Widgets', 'Marketing Automation').toString() || '-',
                                        marketingToolsUsageScore || '-'
                                    ]
                                ]);

                                const info = workbook.sheet(2).range(`A${i}:D${i}`)
                                info.value([
                                    [
                                        row.dataValues.dataset || '-',
                                        row.dataValues.company_name || '-',
                                        row.dataValues.overall_knapshot_score || '-',
                                        row.dataValues.no_of_directory_presence || '-',
                                    ]
                                ])

                                client.filter(y => y.company_name === row.dataValues.company_name).map(x => {
                                    sheet2++
                                    let clientAssetTotal = {}
                                    let clientAssets = x.asset && JSON.parse(x.asset)

                                    if (clientAssets) for (var category in clientAssets) {
                                        if (!clientAssets.hasOwnProperty(category)) continue;
                                        if (!keyValues[category]) continue;

                                        var types = clientAssets[category];
                                        for (var type in types) {
                                            if (!types.hasOwnProperty(type)) continue;
                                            if (!keyValues[category].includes(type)) continue;


                                            var brands = [...new Set(types[type])];
                                            for (var j = 0; j < brands.length; j++) {
                                                var brand = brands[j];

                                                clientAssetTotal[category] = clientAssetTotal[category] ? clientAssetTotal[category] : {};

                                                var total_type = clientAssetTotal[category];
                                                total_type[type] = total_type[type] ? total_type[type] : [];

                                                clientAssetTotal[category][type].push(brand)
                                            }
                                        }
                                    }
                                    const contact = workbook.sheet(1).range(`A${sheet2}:O${sheet2}`);
                                    contact.value([
                                        [
                                            // row.dataValues.dataset,
                                            // row.dataValues.company_name,
                                            // row.dataValues.website,
                                            // getBrandData(total, 'Analytics and Tracking', 'Tag Management').toString() || '-',
                                            // getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').toString() || '-',
                                            // x.client_name || '-',
                                            // x.client_website || '-',
                                            // getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Tag Management').toString() || '-',
                                            // getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Conversion Optimization').toString() || '-',
                                            // getBrandData(clientAssetTotal, 'Widgets', 'Marketing Automation').toString() || '-',
                                            row.dataValues.dataset,
                                            row.dataValues.company_name,
                                            row.dataValues.website,
                                            getBrandData(total, 'Analytics and Tracking', 'Tag Management').toString() || '-',
                                            getBrandData(total, 'Analytics and Tracking', 'Conversion Optimization').toString() || '-',
                                            x.client_name || '-',
                                            x.client_website || '-',
                                            getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Tag Management').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Conversion Optimization').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Advertiser Tracking').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Analytics and Tracking', 'Lead Generation').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Widgets', 'Marketing Automation').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Ecommerce', 'Non Platform').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Ecommerce', 'Hosted Solution').toString() || '-',
                                            getBrandData(clientAssetTotal, 'Ecommerce', 'Open Source').toString() || '-',
                                        ]
                                    ])
                                })
                            }
                            return workbook.toFileAsync("./excelData.xlsx")
                        }).then((data) => {
                            res.type = 'application/vnd.openxmlformats'
                            res.sendFile(path.resolve('excelData.xlsx'))
                            res.body = data
                        });
                }
            )
    } catch (error) {
        console.log("error", error)
    }


}

exports.getKeywordsByCompany = async (req, res) => {
    const { company_name } = req.body

    try {
        await Expertise.findAll({
            where: {
                company_name: company_name
            },
        }).then(
            resp => {
                return res.status(200).json({
                    message: "Successful",
                    data: resp,
                })
            }
        )
    } catch (error) {

    }
}

exports.getCompanyExpertiseData = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { user_id, categoryFilter, empSizeFilter, yearIOFilter, partnerFilter,
        digitalEngagementFilter, company_id, userFavCompFilter, productServiceFilter } = req.body;

    let whereFilter = [
        { dataset },
        // { company_name: "2359 MEDIA (INDO)" }
        // { asset: { [Op.ne]: null } }
    ];

    let digitalEngagementFilterArr = [], totalCompanyFilter = []

    if (file_name) whereFilter.push({ file_name });

    if (company_id) whereFilter.push({ id: company_id });

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]

    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]

    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilter.push({ company_name: totalCompanyFilter });

    // if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }


    try {
        let scoreData = await ScoreList.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        file_name: file_name
                    }
                ]

            }
        })
        let scoreConfig
        if (scoreData) {
            scoreConfig = await ScoreConfig.findOne({
                where: { list_name: scoreData.score_name },
            })
        }

        await CompanyItem.findAll({
            include: [
                // Expertise,PersonnelItem
                {
                    model: Expertise,
                    required: false,
                    // where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                },
                {
                    model: PersonnelItem,
                },
                {
                    model: FavouriteCompanyList,
                    // where: { user_id: parseInt(user_id) },
                },
                {
                    model: ScoreConfigCalculate,
                    where: { score_config_name: scoreData ? scoreData.score_name : null },
                    required: false
                },
            ],
            where: { [Op.and]: whereFilter },
            order: [
                ['company_name', 'ASC'],
            ],
        }).then(async resp => {

            // console.log("resp", resp)


            let companyData = [], companyName = [],
                hasPartner = 0, basic = 0, intermediate = 0, high = 0, advance = 0

            resp.forEach(async data => {
                let hasStaff = 0
                let company = data.dataValues
                let expertise = data.dataValues.expertises
                let total_personnel = data.dataValues.total_personnel
                let favCompList = data.dataValues.fav_company_lists
                let ScoreConfigCalculate = data.dataValues.score_config_calculates

                favCompList = favCompList.filter((obj) => obj.user_id == user_id).length;


                let partnerList, expertiseList, keywordList, productServiceObj = {
                    'Google Related': [],
                    'Social Related': [],
                    'Others': []
                }, awardList

                let personnels = data.dataValues.personnels
                let personnelData = []

                if (personnels && personnels.length > 0) {
                    // hasStaff++
                    let obj = {}
                    if (personnels[0].linkedIn) { hasLinkedIn++ }
                    personnels.forEach(pData => {
                        let linkedIn = pData.dataValues.linkedinUrl
                        if (linkedIn) hasStaff++

                        obj = {
                            personnel_name: pData.dataValues.personnel_name,
                            title: pData.dataValues.title,
                            linkedIn: linkedIn
                        }
                        personnelData.push(obj)
                    })
                }
                // else {
                //     personnelData.push({ personnel_name: '-', title: '-', linkedIn: '' })
                // }

                if (productServiceFilter && productServiceFilter.length) {
                    var index = productServiceFilter.indexOf("Blank");
                    const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                    if (!company.product_service && index !== -1) {

                    }
                    else {
                        if (!company.product_service) return false
                        if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                    }
                    // company.product_service.split(",(?![^()]*\\))\\s*").map(ps => {

                }
                if (company.product_service) {
                    company.product_service.split(",").map(ps => {
                        let trimPS = ps.trim()
                        if (productServicePair["Google"].includes(trimPS.toLowerCase())) {
                            productServiceObj['Google Related'].push(trimPS)
                        }
                        else if (productServicePair["Social"].includes(trimPS.toLowerCase())) {
                            productServiceObj['Social Related'].push(trimPS)
                        }
                        else {
                            productServiceObj['Others'].push(trimPS)
                        }
                    })
                }

                // if (company.product_service) {

                //     if (!company.product_service && index !== -1) console.log(company.company_name)

                //     if (PSFilter && PSFilter.length && !trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0))
                //         return false

                //     // console.log("after")

                //     // let totalProdService = []
                //     // company.product_service.split(",(?![^()]*\\))\\s*").map(ps => {

                // }

                if (productServiceObj['Google Related']) productServiceObj['Google Related'] = [...new Set(productServiceObj['Google Related'])].filter(rmv => rmv != '')
                if (productServiceObj['Social Related']) productServiceObj['Social Related'] = [...new Set(productServiceObj['Social Related'])].filter(rmv => rmv != '')
                if (productServiceObj['Others']) productServiceObj['Others'] = [...new Set(productServiceObj['Others'])].filter(rmv => rmv != '')

                // console.log(company.company_name, productServiceObj)

                if (partnerFilter && partnerFilter.length) {
                    var index = partnerFilter.indexOf("Blank");
                    for (let single of expertise) {
                        let { list, type } = single.dataValues
                        if (type === "Partners") {

                            if (list === "-") {
                                if (index == "-1") return false
                            }
                            else {
                                let subPartners = []
                                Object.keys(JSON.parse(list)).map(key =>
                                    JSON.parse(list)[key].map(subKey => {
                                        let trimSubKey = subKey.trim()
                                        subPartners.push(trimSubKey)
                                    }))
                                if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                            }
                        }
                    }
                }



                if (company.overall_knapshot_score < 2) basic += 1;
                if (company.overall_knapshot_score >= 2 && company.overall_knapshot_score < 5) intermediate += 1;
                if (company.overall_knapshot_score >= 5 && company.overall_knapshot_score < 8) high += 1;
                if (company.overall_knapshot_score >= 8) advance += 1;

                expertise.forEach(expertiseData => {

                    let test = expertiseData.dataValues.type
                    let result = expertiseData.dataValues.list
                    // if (test === 'Partners' && result && result !== '-') hasPartner++
                    switch (test) {
                        case 'Partners': partnerList = result; break;
                        case 'Expertise': expertiseList = result; break;
                        case 'OfferingKeyword': keywordList = result; break;
                        case 'Awards & Accolades': awardList = result; break;
                        default: break;
                    }
                })

                const partnerCountFunc = (list) => {
                    if (list && list !== '-' && list.length) return trimArray(list.split(",")).filter(x => x).length
                    else return 0
                    // if (!list || list==="-") return 0
                    // return list.split(",").filter(e => e.trim() !== '').length
                }


                let obj = {
                    id: company.id,
                    company_name: company.company_name,
                    website: company.website,
                    dataset: company.dataset,
                    phone: company.main_line_number,
                    facebook: company.facebook || '-',
                    twitter: company.twitter || '-',
                    linkedIn: company.linkedIn || '-',
                    email: company.company_email_address,
                    instagram: company.instagram || '-',
                    youtube: company.youtube || '-',
                    category: company.category || 'No Data for now',
                    tags: 'No Data for now',
                    infoArr: {
                        Industry: company.industry,
                        "Years In Operation": company.year_in_operation || 0,
                        Employees: company.total_personnel,
                        "Staff Found": hasStaff,
                    },
                    HQ: company.main_hq_location,
                    ksScore: company.overall_knapshot_score,
                    customScore: {
                        name: scoreData && scoreData.score_name,
                        value: ScoreConfigCalculate && ScoreConfigCalculate.length && ScoreConfigCalculate[0].dataValues.score,
                        scoreConfig: scoreConfig && scoreConfig.score,
                    },
                    keyword: keywordList || '-',
                    expertise: expertiseList || '-',
                    favCompList: favCompList ? true : false,
                    partner: partnerList || '-',
                    award: awardList || '-',
                    awardCount: partnerCountFunc(awardList) || '-',
                    // hasStaff: hasStaff,
                    personnel: personnelData,
                    partnerCount: partnerCountFunc(partnerList),
                    asset: company.asset,
                    product_service: productServiceObj

                }
                companyData.push(obj)
                companyName.push(company.company_name)
            });
            return res.json({
                data: companyData,
                companyName: companyName,
                total: companyData.length,
                hasPartner: hasPartner,
                digitalEngagement: {
                    basic: basic,
                    intermediate: intermediate,
                    high: high,
                    advance: advance
                }
            })
        })
    } catch (error) {
        console.log("err", error)
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getCompanyNamesExpertise = async (req, res) => {

    const {
        selectedFilename, selectedDataset, companyFilter, userFavCompFilter,
        categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter,
        partnerFilter, expertiseFilter,
    } = req.body;

    // console.log(companyFilter, partnerFilter, expertiseFilter)

    let whereFilter = [
        { type: ["Expertise", "Partners"] }
    ];

    let digitalEngagementFilterArr = []

    let whereFilterForCompany = [
        { dataset: selectedDataset }
    ];

    let totalCompanyFilter = []

    if (selectedFilename !== "Master DB (Golden Source)") whereFilterForCompany.push({ file_name: selectedFilename });

    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]

    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilterForCompany.push({ company_name: totalCompanyFilter });

    // if (categoryFilter && categoryFilter.length) whereFilterForCompany.push({ category: categoryFilter });

    // if (empSizeFilter && empSizeFilter.length) whereFilterForCompany.push({ total_personnel: empSizeFilter });

    // if (yearIOFilter && yearIOFilter.length) {
    //     let filterData = []
    //     if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
    //     if (yearIOFilter.includes("2-3 years")) filterData.push(2)
    //     if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
    //     if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
    //     // whereFilterForCompany.push({ year_in_operation: filterData });
    //     whereFilterForCompany.push({ year_in_operation: { [Op.or]: filterData } });
    // }

    // if (digitalEngagementFilter && digitalEngagementFilter.length) {
    //     if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
    //     if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
    //     if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
    //     if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
    //     whereFilterForCompany.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    // }


    // const trimArray = array => array.map(string => string.trim())

    try {
        if (!partnerFilter.length && !expertiseFilter.length) {
            let companies = await CompanyItem.findAll({
                where: { [Op.and]: whereFilterForCompany },
                attributes: ["company_name"]
            })
            return res.status(200).json({
                data: companies.map(comp => comp.company_name)
            })
        }

        await CompanyItem.findAll({
            include: [
                {
                    model: Expertise,
                    where: { [Op.and]: whereFilter },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                }
            ],
            where: { [Op.and]: whereFilterForCompany },
            order: [
                ['company_name', 'ASC'],
            ],
        }).then(resp => {

            let allData = [], expertiseArr = [], partnerArr = [], sameData = [], oldData, newData

            resp.forEach(data => {

                let company = data.dataValues
                let expertise = data.dataValues.expertises
                let partnerList, expertiseList, ptn, ept

                expertise.forEach(expertiseData => {

                    let { type, list, company_name } = expertiseData.dataValues
                    if (type === "Partners") ptn = trimArray(list.split(",")).some(r => partnerFilter.indexOf(r) >= 0)
                    if (type === "Expertise") ept = trimArray(list.split(",")).some(r => expertiseFilter.indexOf(r) >= 0)
                    if (ptn) partnerArr.push(company_name)
                    if (ept) expertiseArr.push(company_name)
                })

                partnerArr = [... new Set(partnerArr)]
                expertiseArr = [... new Set(expertiseArr)]
                allData = [...partnerArr, ...expertiseArr]

                allData.sort().map((x, i) => {
                    if (i !== 0) oldData = allData[i - 1]
                    newData = x
                    if (oldData === newData) sameData.push(x)
                })
            });

            return res.json({
                data: sameData.length ? sameData : ["NONE"],
                partnerArr: partnerArr.length ? partnerArr : ["NONE"],
                expertiseArr: expertiseArr.length ? expertiseArr : ["NONE"]
            })
        })

    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getCompanyClientAwardData = async (req, res) => {
    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });
    try {
        await Company.findAll({
            include: [
                {
                    model: Expertise,
                    attributes: ["list", "type"],
                },
                {
                    model: Client,
                    attributes: ["client_name"]
                }
            ],
            where: { [Op.and]: whereFilter },
            order: [
                ['company_name', 'ASC'],
            ],
        }).then(resp => {

            let companyData = [], companyName = [],
                hasClient = 0, basic = 0, intermediate = 0, high = 0, advance = 0

            resp.forEach(data => {

                let company = data.dataValues
                let expertise = data.dataValues.expertises
                let awardList
                let client = data.dataValues.clients
                let clientArr = []


                if (company.overall_knapshot_score < 2) basic += 1;
                if (company.overall_knapshot_score >= 2 && company.overall_knapshot_score < 5) intermediate += 1;
                if (company.overall_knapshot_score >= 5 && company.overall_knapshot_score < 8) high += 1;
                if (company.overall_knapshot_score >= 8) advance += 1;

                expertise.forEach(expertiseData => {

                    let test = expertiseData.dataValues.type
                    let result = expertiseData.dataValues.list
                    switch (test) {
                        case 'Awards & Accolades': awardList = result; break;
                        default: break;
                    }
                })

                if (client.length) hasClient++
                client.forEach(clientData => {
                    clientArr.push(clientData.dataValues.client_name)
                })

                let obj = {
                    company_name: company.company_name,
                    website: company.website,
                    dataset: company.dataset,
                    phone: company.main_line_number,
                    facebook: company.facebook,
                    twitter: company.twitter,
                    linkedIn: company.linkedIn,
                    email: company.company_email_address,
                    instagram: company.instagram,
                    youtube: company.youtube,
                    category: company.category,
                    tags: 'No Data for now',
                    ksScore: company.overall_knapshot_score,
                    award: awardList || '-',
                    client: clientArr.toString() || '-'

                }
                companyData.push(obj)
                companyName.push(company.company_name)
            });
            return res.json({
                data: companyData,
                companyName: companyName,
                total: companyData.length,
                hasClient: hasClient,
                digitalEngagement: {
                    basic: basic,
                    intermediate: intermediate,
                    high: high,
                    advance: advance
                }
            })
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getCompanyPersonnelData = async (req, res) => {
    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });
    try {
        await CompanyItem.findAll({
            include: [
                {
                    model: PersonnelItem,
                }
            ],
            where: { [Op.and]: whereFilter },
            order: [
                ['company_name', 'ASC'],
            ],
        }).then(resp => {
            let companyData = [], hasStaff = 0, hasLinkedIn = 0, companyName = []
            resp.forEach(data => {
                let company = data.dataValues
                let personnels = data.dataValues.personnels
                let personnelData = []

                if (personnels.length > 0) {
                    hasStaff++
                    let obj = {}
                    if (personnels[0].linkedIn) hasLinkedIn++
                    personnels.forEach(pData => {

                        obj = {
                            personnel_name: pData.dataValues.personnel_name,
                            title: pData.dataValues.title,
                            linkedIn: pData.dataValues.linkedinUrl
                        }
                        personnelData.push(obj)
                    })
                } else {
                    personnelData.push({ personnel_name: '-', title: '-', linkedIn: '' })
                }

                let obj = {
                    company_name: company.company_name,
                    website: company.website,
                    dataset: company.dataset,
                    phone: company.main_line_number,
                    facebook: company.facebook,
                    twitter: company.twitter,
                    linkedIn: company.linkedIn,
                    email: company.company_email_address,
                    instagram: company.instagram,
                    youtube: company.youtube,
                    category: company.category,
                    tags: 'No Data for now',
                    HQ: company.main_hq_location,
                    emp_size: company.total_personnel,
                    yearIO: company.year_in_operation,
                    personnel: personnelData,

                }
                companyData.push(obj)
                companyName.push(company.company_name)
            })

            return res.json({
                data: companyData,
                companyName: companyName,
                total: companyData.length,
                hasStaff: hasStaff,
                hasLinkedIn: hasLinkedIn
            })
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getUserTechnologyData = async function (req, res) {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter


    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    if (digitalPresenceFilter && digitalPresenceFilter.websites) {
        if (digitalPresenceFilter.websites.indexOf('Has') > -1) digitalPresenceFilter.websites.push({ [Op.ne]: null })
        whereFilter.push({ website: { [Op.or]: digitalPresenceFilter.websites } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.email) {
        if (digitalPresenceFilter.email.indexOf('Has') > -1) digitalPresenceFilter.email.push({ [Op.ne]: null })
        whereFilter.push({ company_email_address: { [Op.or]: digitalPresenceFilter.email } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.phone) {
        if (digitalPresenceFilter.phone.indexOf('Has') > -1) digitalPresenceFilter.phone.push({ [Op.ne]: null })
        whereFilter.push({ main_line_number: { [Op.or]: digitalPresenceFilter.phone } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.twitter) {
        if (digitalPresenceFilter.twitter.indexOf('Has') > -1) digitalPresenceFilter.twitter.push({ [Op.ne]: null })
        whereFilter.push({ twitter: { [Op.or]: digitalPresenceFilter.twitter } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.linkedIn) {
        if (digitalPresenceFilter.linkedIn.indexOf('Has') > -1) digitalPresenceFilter.linkedIn.push({ [Op.ne]: null })
        whereFilter.push({ linkedIn: { [Op.or]: digitalPresenceFilter.linkedIn } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.instagram) {
        if (digitalPresenceFilter.instagram.indexOf('Has') > -1) digitalPresenceFilter.instagram.push({ [Op.ne]: null })
        whereFilter.push({ instagram: { [Op.or]: digitalPresenceFilter.instagram } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.facebook) {
        if (digitalPresenceFilter.facebook.indexOf('Has') > -1) digitalPresenceFilter.facebook.push({ [Op.ne]: null })
        whereFilter.push({ facebook: { [Op.or]: digitalPresenceFilter.facebook } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    // if (digitalPresenceFilter && digitalPresenceFilter.directory) {
    //     if (digitalPresenceFilter.directory.indexOf('0 Presence') > -1) digitalPresenceFilter.directory.push({ [Op.eq]: -1 })
    //     if (digitalPresenceFilter.directory.indexOf('intermediate') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
    //     if (digitalPresenceFilter.directory.indexOf('high') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
    //     if (digitalPresenceFilter.directory.indexOf('advance') > -1) digitalPresenceFilter.directory.push({ [Op.gte]: 8 })
    //     whereFilter.push({ no_of_directory_presence: { [Op.or]: digitalPresenceFilter.directory } })
    // }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }

    let sortedTotal = {}, idArr = [], add = 0, companyData = [], basic = 0, intermediate = 0, high = 0, advance = 0, companyName = [];

    try {

        const companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            order: [
                ['company_name', 'ASC'],
            ],
            // attributes: ["asset", "id"]
        });

        if (companies) {
            for (let i = 0; i < companies.length; i++) {
                let id = companies[i]["id"];
                companyName.push(companies[i].company_name)
                // idArr.push(id)
                if (companies[i].overall_knapshot_score < 2) basic += 1;
                if (companies[i].overall_knapshot_score >= 2 && companies[i].overall_knapshot_score < 5) intermediate += 1;
                if (companies[i].overall_knapshot_score >= 5 && companies[i].overall_knapshot_score < 8) high += 1;
                if (companies[i].overall_knapshot_score >= 8) advance += 1;
                if (companies[i]["asset"]) {
                    let total = {}
                    let assets = JSON.parse(companies[i]["asset"]);
                    // if(Object.keys(assets).length === 0) idArr.push(id)

                    for (let [categoryKey, categoryValue] of Object.entries(assets)) {

                        if (!keyValues[categoryKey]) continue;
                        for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                            if (!keyValues[categoryKey].includes(typeKey)) continue;
                            let brands = [...new Set(typeValue)];
                            for (let j = 0; j < brands.length; j++) {
                                add++
                                let brand = brands[j]
                                total[categoryKey] = total[categoryKey] ? total[categoryKey] : {};

                                var total_type = total[categoryKey];
                                total_type[typeKey] = total_type[typeKey] ? total_type[typeKey] : [];

                                total_type[typeKey].push(brand)

                                // var total_brand = total_type[typeKey];

                                // if (!total_brand[brand]) {
                                //     total_brand[brand] = 0
                                // }
                                // total_brand[brand]++
                            }
                        }
                    }

                    companyData.push(
                        {
                            assets: AssetDPForUserTechnology(total),
                            company_name: companies[i].company_name,
                            website: companies[i].website,
                            dataset: companies[i].dataset,
                            phone: companies[i].main_line_number,
                            facebook: companies[i].facebook,
                            twitter: companies[i].twitter,
                            linkedIn: companies[i].linkedIn,
                            email: companies[i].company_email_address,
                            instagram: companies[i].instagram,
                            youtube: companies[i].youtube,
                            category: companies[i].category,
                            tags: 'No Data for now',
                            ksScore: companies[i].overall_knapshot_score
                        }
                    )

                    if (!add) idArr.push(id)
                    add = 0
                }
                else idArr.push(id)
            }

            return res.status(200).json({
                message: "Successful",
                data: companyData,
                companyName: companyName,
                total: companyData.length,
                digitalEngagement: {
                    basic: basic,
                    intermediate: intermediate,
                    high: high,
                    advance: advance
                }
                // idArr: [...new Set(idArr)]
            })
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getCompanyNames = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { expertiseCompanyFilter, categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter, partnerFilter } = req.body;

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    let digitalEngagementFilterArr = []

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    // if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    try {
        let totalData = []
        if (partnerFilter && partnerFilter.length)
            await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                where: { [Op.and]: whereFilter },
                order: [
                    ['company_name', 'ASC'],
                ],
            }).then(resp => {
                resp.forEach(async data => {
                    let company = data.dataValues
                    let expertises = data.dataValues.expertises

                    if (productServiceFilter && productServiceFilter.length) {
                        var index = productServiceFilter.indexOf("Blank");
                        const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                        if (!company.product_service && index !== -1) totalData.push(company.company_name)
                        if (!company.product_service) return false
                        if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                    }

                    // for (let single of expertise) {
                    //     let record = single.dataValues
                    //     // console.log("before",partnerFilter,record.list.split(","))
                    //     if (!trimArray(record.list.split(",")).some(r => partnerFilter.indexOf(r) >= 0)) return false
                    // }
                    var index = partnerFilter.indexOf("Blank");
                    if (partnerFilter && partnerFilter.length) {
                        var index = partnerFilter.indexOf("Blank");
                        for (let single of expertises) {
                            let list = single.dataValues.list
                            if (list === "-") {
                                if (index == "-1") return false
                            }
                            else {
                                let subPartners = []
                                Object.keys(JSON.parse(list)).map(key =>
                                    JSON.parse(list)[key].map(subKey => {
                                        let trimSubKey = subKey.trim()
                                        subPartners.push(trimSubKey)
                                    }))
                                if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                            }
                        }
                    }
                    // console.log("company.company_name",company.company_name)
                    totalData.push(company.company_name)
                })
            })

        else await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            // attributes: ["company_name"],
            order: [
                ['company_name', 'ASC'],
            ]
        }).then(resp => {
            resp.forEach(async data => {
                let company = data.dataValues
                let total_personnel = data.dataValues.total_personnel
                if (typeof empSizeFilter[0] === "object") {
                    if (selectorValue === '-') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) >= minValue)) return false
                            if (!(parseInt(splitData[1]) <= maxValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData >= minValue)) return false
                            if (!(intData <= maxValue)) return false
                        }
                    }

                    if (selectorValue === '>') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) >= minValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData >= minValue)) return false
                        }
                    }

                    if (selectorValue === '<') {
                        if (total_personnel.includes("-")) {
                            let splitData = total_personnel.split('-')
                            if (!(parseInt(splitData[0]) <= maxValue && parseInt(splitData[1]) >= maxValue)) return false
                        }
                        else {
                            let intData = parseInt(total_personnel)
                            if (!(intData <= maxValue)) return false
                        }
                    }
                }
                if (productServiceFilter && productServiceFilter.length) {
                    var index = productServiceFilter.indexOf("Blank");
                    const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                    if (!company.product_service && index !== -1) totalData.push(company.company_name)
                    if (!company.product_service) return false
                    if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                }
                totalData.push(company.company_name)
            })
        })
        if (totalData) return res.status(200).json({
            message: "Successful",
            companyName: totalData
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalPartners = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;
    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter } = req.body;

    let whereFilter = [
        { dataset },
    ];

    let digitalEngagementFilterArr = []

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    if (file_name) whereFilter.push({ file_name });

    // if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    try {
        await CompanyItem.findAll({
            include: [
                {
                    model: Expertise,
                    required: false,
                    where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                }
            ],
            where: { [Op.and]: whereFilter },
            order: [
                ['company_name', 'ASC'],
            ],
        })

            // await Expertise.findAll({
            //     where: { [Op.and]: { type: "Partners" } },
            //     include: [
            //         {
            //             model: CompanyItem,
            //             required: false,
            //             where: { [Op.and]: whereFilter },
            //         }
            //     ],
            // })
            .then(resp => {
                let allData = [], partner = {}
                resp.forEach(data => {
                    // let record = data.dataValues
                    let expertises = data.dataValues.expertises
                    let total_personnel = data.dataValues.total_personnel

                    let company = data.dataValues
                    if (productServiceFilter && productServiceFilter.length) {
                        var index = productServiceFilter.indexOf("Blank");
                        const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                        if (!company.product_service && index !== -1) { }
                        else if (!company.product_service) return false
                        else if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                    }

                    // if(expertises.length === 0) {
                    //     console.log("name",company.company_name)
                    //     if (!partner['Blank']) partner['Blank'] = 0
                    //         partner['Blank']++
                    // }


                    for (let expertise of expertises) {
                        let record = expertise.dataValues
                        let list = record.list

                        if (list === "-") {
                            if (!partner['Blank']) {
                                partner['Blank'] = {}
                                partner['Blank'].count = 0
                                partner['Blank'].subPartner = {}
                            }
                            partner['Blank'].count++
                        }


                        else Object.keys(JSON.parse(list)).map(key => {
                            if (!partner[key]) {
                                partner[key] = {}
                                partner[key].count = 0
                                partner[key].subPartner = {}
                            }
                            partner[key].count++
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                if (!partner[key].subPartner[trimSubKey]) partner[key].subPartner[trimSubKey] = 0
                                partner[key].subPartner[trimSubKey]++
                            })
                            // partner[key].subPartner
                        })

                        // if (record.list.trim() === '-') {
                        //     if (!partner['Blank']) partner['Blank'] = 0
                        //     partner['Blank']++
                        // }
                        // record.type === "Partners" && record.list.split(",").map(ptn => {
                        //     let key = ptn.trim()
                        //     if (!partner[key]) partner[key] = 0
                        //     partner[key]++
                        // })
                    }

                })
                return res.status(200).json({
                    partner: Object.keys(partner)
                        .sort()
                        .reduce((acc, key) => ({
                            ...acc, [key]: partner[key]
                        }), { "Blank": 0 })
                })
            })
    } catch (error) {
        console.log(error)
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalExpertise = async (req, res) => {

    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    let whereFilter = [
        { type: "Expertise" }
    ];

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    // if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    try {
        await Expertise.findAll({
            where: { [Op.and]: whereFilter },
        }).then(resp => {
            let expertise = {}
            resp.forEach(data => {
                let record = data.dataValues
                record.list.split(",").map(ept => {
                    let key = ept.trim()
                    if (!expertise[key]) expertise[key] = 0
                    expertise[key]++
                })
            })
            // console.log("record", record)
            // let company = record.company
            // if (productServiceFilter.length) {
            //     if (!trimArray(company.product_service.split(",")).some(r => productServiceFilter.indexOf(r) >= 0)) return false
            //     if (!company.product_service) return false
            // }

            // record.type === "Partners" && record.list.split(",").map(ptn => {
            //     let key = ptn.trim()
            //     if(!partner[key]) partner[key] = 0
            //     partner[key] ++
            // })
            // record.type === "Expertise" && record.list.split(",").map(ept => {
            //     let key = ept.trim()
            //     if(!expertise[key]) expertise[key] = 0
            //     expertise[key] ++
            // })
            return res.status(200).json({
                expertise: Object.keys(expertise)
                    .sort()
                    .reduce((acc, key) => ({
                        ...acc, [key]: expertise[key]
                    }), {})
            })
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalCategory = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter, partnerFilter } = req.body;


    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    let digitalEngagementFilterArr = []

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    try {
        let companies
        if (partnerFilter && partnerFilter.length)
            companies = await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                where: { [Op.and]: whereFilter },
                order: [
                    ['category', 'ASC'],
                ],
            })

        else companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            order: [
                ['category', 'ASC'],
            ],
        })
        let category = {}
        companies.filter(data => {

            let company = data.dataValues
            let total_personnel = data.dataValues.total_personnel

            if (productServiceFilter && productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) return true
                if (!company.product_service) return false
                if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
            }
            let expertises = data.dataValues.expertises
            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                for (let single of expertises) {
                    let list = single.dataValues.list
                    if (list === "-") {
                        if (index == "-1") return false
                    }
                    else {
                        let subPartners = []
                        Object.keys(JSON.parse(list)).map(key =>
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                subPartners.push(trimSubKey)
                            }))
                        if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                    }
                }
            }
            return true

        }).map((x, i) => {
            let key = x.dataValues.category
            if (!category[key]) category[key] = 0
            category[key]++
        })
        return res.status(200).json({
            category: category
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalYearInOperation = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter, partnerFilter } = req.body;

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    let digitalEngagementFilterArr = []

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    try {
        let companies
        if (partnerFilter && partnerFilter.length)
            companies = await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                where: { [Op.and]: whereFilter },
                order: [
                    ['year_in_operation', 'ASC'],
                ],
            })
        else companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            order: [
                ['year_in_operation', 'ASC'],
            ],
        })
        let data = {}
        companies.filter(data => {

            let company = data.dataValues
            let total_personnel = data.dataValues.total_personnel

            if (productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) return true
                if (!company.product_service) return false
                if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
            }
            let expertises = data.dataValues.expertises
            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                for (let single of expertises) {
                    let list = single.dataValues.list
                    if (list === "-") {
                        if (index == "-1") return false
                    }
                    else {
                        let subPartners = []
                        Object.keys(JSON.parse(list)).map(key =>
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                subPartners.push(trimSubKey)
                            }))
                        if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                    }
                }
            }
            return true

        }).map((x, i) => {
            let key = x.dataValues.year_in_operation
            let name = x.dataValues.company_name
            // console.log(name,key)
            if (!data[key]) data[key] = 0
            data[key]++
        })

        // delete data[null]

        let realData = {
            "<2 year": 0,
            "2-3 years": 0,
            "3-10 year": 0,
            ">10 year": 0,
        }
        // console.log("data", data)
        // console.log("data2", data["2"])

        Object.keys(realData).map(key => {
            if (key === "<2 year") {
                if (data[null]) realData[key] += data[null]
                if (data["0"]) realData[key] += data["0"]
                if (data["1"]) realData[key] += data["1"]
            }
            else if (key === "2-3 years") {
                if (data["2"]) realData[key] = data["2"]
            }
            else if (key === "3-10 year") {
                for (let i = 3; i < 10; i++) {
                    // console.log(i, data[i])
                    if (data[i]) realData[key] += data[i]
                }
            }
            else for (let i of Object.keys(data)) { if (i > 9) realData[key] += data[i]; }
        })

        // console.log("realData", realData)

        var filteredObject = Object.keys(realData).reduce(function (r, e) {
            if (realData[e] != 0) r[e] = realData[e]
            return r;
        }, {})

        return res.status(200).json({
            // data: data
            data: filteredObject
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalEmpSize = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter, partnerFilter } = req.body;

    let whereFilter = [
        { dataset },
        // { asset: { [Op.ne]: null } }
    ];

    let digitalEngagementFilterArr = []

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') {
                    // whereFilter.push({  [Op.or]:{ "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } }  })

                    // whereFilter.push({ "min_emp": { [Op.gte]: intMin } })
                    // whereFilter.push({ "max_emp": { [Op.lte]: intMax } })

                    // whereEmpFilter.push({ "min_emp": { [Op.gte]: intMin } })
                    // whereEmpFilter.push({ "max_emp": { [Op.lte]: intMax } })

                    whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })


                    // whereMinFilter.push({ [Op.gte]: intMin })
                    // whereMaxFilter.push({ [Op.lte]: intMax })
                }

                if (selectValue === '<') {
                    // whereFilter.push({ "max_emp": { [Op.lt]: intMax } })

                    whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                    // whereMaxFilter.push({ [Op.lt]: intMax })
                }

                if (selectValue === '>') {
                    // whereFilter.push({ "min_emp": { [Op.gt]: intMin } })

                    whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })

                    // whereMinFilter.push({ [Op.gt]: intMin })
                }
            })

            whereFilter.push({
                [Op.or]: whereEmpFilter
            })
            // whereFilter.push({ "min_emp": { [Op.or]: whereMinFilter } })
            // whereFilter.push({ "max_emp": { [Op.or]: whereMaxFilter } })

            // if (whereMaxFilter.length && whereMinFilter.length) whereFilter.push({
            //     [Op.or]: [
            //         { "min_emp": { [Op.or]: whereMinFilter } },
            //         { "max_emp": { [Op.or]: whereMaxFilter } }
            //     ]
            // })

            // if (whereMaxFilter.length && whereMinFilter.length) whereFilter.push({
            //     [Op.and]: whereEmpFilter
            // })

            // else if (whereMaxFilter.length) whereFilter.push({
            //     [Op.or]: [
            //         { "max_emp": { [Op.or]: whereMaxFilter } }
            //     ]
            // })

            // else if (whereMinFilter.length) whereFilter.push({
            //     [Op.or]: [
            //         { "min_emp": { [Op.or]: whereMinFilter } }
            //     ]
            // })

            // whereFilter.push({ "min_emp": whereMinFilter })
            // whereFilter.push({ "max_emp": whereMaxFilter })
        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }

    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    try {
        let companies
        if (partnerFilter && partnerFilter.length)
            companies = await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                // attributes: ["total_personnel"],
                where: { [Op.and]: whereFilter },
                order: [
                    ['total_personnel', 'ASC'],
                ],
            })
        else companies = await CompanyItem.findAll({
            // attributes: ["total_personnel"],
            where: { [Op.and]: whereFilter },
            order: [
                ['total_personnel', 'ASC'],
            ],
        })
        let data = {}
        companies.filter(data => {

            let company = data.dataValues
            let total_personnel = data.dataValues.total_personnel
            // if (empSizeFilter && typeof empSizeFilter[0] === "object") {
            //     if (selectorValue === '-') {
            //         if (total_personnel.includes("-")) {
            //             let splitData = total_personnel.split('-')
            //             if (!(parseInt(splitData[0]) >= minValue)) return false
            //             if (!(parseInt(splitData[1]) <= maxValue)) return false
            //         }
            //         else {
            //             let intData = parseInt(total_personnel)
            //             if (!(intData >= minValue)) return false
            //             if (!(intData <= maxValue)) return false
            //         }
            //     }

            //     if (selectorValue === '>') {
            //         if (total_personnel.includes("-")) {
            //             let splitData = total_personnel.split('-')
            //             if (!(parseInt(splitData[0]) >= minValue)) return false
            //         }
            //         else {
            //             let intData = parseInt(total_personnel)
            //             if (!(intData >= minValue)) return false
            //         }
            //     }

            //     if (selectorValue === '<') {
            //         if (total_personnel.includes("-")) {
            //             let splitData = total_personnel.split('-')
            //             console.log(splitData,maxValue,( parseInt(splitData[1]) < maxValue && parseInt(splitData[0]) < maxValue))
            //             if (!( parseInt(splitData[1]) < maxValue && parseInt(splitData[0]) < maxValue)) return false
            //         }
            //         else {
            //             let intData = parseInt(total_personnel)
            //             if (!(intData <= maxValue)) return false
            //         }
            //     }
            // }

            if (productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) return true
                if (!company.product_service) return false
                if (!trimArray(company.product_service.split(",")).some(r => productServiceFilter.indexOf(r) >= 0)) return false
            }
            let expertises = data.dataValues.expertises
            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                for (let single of expertises) {
                    let list = single.dataValues.list
                    if (list === "-") {
                        if (index == "-1") return false
                    }
                    else {
                        let subPartners = []
                        Object.keys(JSON.parse(list)).map(key =>
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                subPartners.push(trimSubKey)
                            }))
                        if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                    }
                }
            }
            return true

        }).map((x, i) => {
            let key = x.dataValues.total_personnel
            if (!data[key]) data[key] = 0
            data[key]++
        })
        return res.status(200).json({
            data: data
        })
    } catch (error) {
        console.log(error)
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalDigitalEngagement = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, productServiceFilter, partnerFilter } = req.body;

    let whereFilter = [
        { dataset }
    ];

    let digitalEngagementFilterArr = []

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    try {
        let companies
        if (partnerFilter && partnerFilter.length)
            companies = await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                where: { [Op.and]: whereFilter },
                order: [
                    ['total_personnel', 'ASC'],
                ],
            })
        else companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            order: [
                ['total_personnel', 'ASC'],
            ],
        })
        let data = {}, Basic = 0, Intermediate = 0, High = 0, Advance = 0
        companies.filter(data => {
            let company = data.dataValues
            let total_personnel = data.dataValues.total_personnel

            if (productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) return true
                if (!company.product_service) return false
                if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
            }
            let expertises = data.dataValues.expertises
            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                for (let single of expertises) {
                    let list = single.dataValues.list
                    if (list === "-") {
                        if (index == "-1") return false
                    }
                    else {
                        let subPartners = []
                        Object.keys(JSON.parse(list)).map(key =>
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                subPartners.push(trimSubKey)
                            }))
                        if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                    }
                }
            }
            return true

        }).map((x, i) => {
            let score = x.dataValues.overall_knapshot_score

            if (score < 2) Basic += 1;
            if (score >= 2 && score < 5) Intermediate += 1;
            if (score >= 5 && score < 8) High += 1;
            if (score >= 8) Advance += 1;

        })

        if (Basic) data.Basic = Basic
        if (Intermediate) data.Intermediate = Intermediate
        if (High) data.High = High
        if (Advance) data.Advance = Advance

        return res.status(200).json({
            data: data
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getTotalProductService = async (req, res) => {

    const file_name = req.body.file_name;
    const dataset = req.body.dataset;
    const companyFilter = req.body.companyFilter;
    const expertiseCompanyFilter = req.body.expertiseCompanyFilter;

    const frimographicFilter = req.body.frimographicFilter;
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    let maxValue, minValue, selectorValue
    const { categoryFilter, empSizeFilter, yearIOFilter, digitalEngagementFilter, partnerFilter } = req.body;

    let whereFilter = [
        { dataset }
    ];

    let digitalEngagementFilterArr = []

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (companyFilter && companyFilter.length) whereFilter.push({ company_name: companyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }
    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    try {
        let companies
        if (partnerFilter && partnerFilter.length)
            companies = await CompanyItem.findAll({
                include: [
                    {
                        model: Expertise,
                        required: false,
                        where: { [Op.and]: { type: "Partners" } },
                        on: {
                            'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                            'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                        }
                    }
                ],
                where: { [Op.and]: whereFilter },
                order: [
                    ['total_personnel', 'ASC'],
                ],
            })
        else companies = await CompanyItem.findAll({
            where: { [Op.and]: whereFilter },
            order: [
                ['total_personnel', 'ASC'],
            ],
        })
        let data = {}, sortedData = {}, checkArr = []
        companies.filter(comp => {
            let expertises = comp.dataValues.expertises
            let total_personnel = comp.dataValues.total_personnel

            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                for (let single of expertises) {
                    let list = single.dataValues.list
                    if (list === "-") {
                        if (index == "-1") return false
                    }
                    else {
                        let subPartners = []
                        Object.keys(JSON.parse(list)).map(key =>
                            JSON.parse(list)[key].map(subKey => {
                                let trimSubKey = subKey.trim()
                                subPartners.push(trimSubKey)
                            }))
                        if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                    }
                }
            }
            return true
        }).map((x, i) => {
            if (x.dataValues.product_service === null) {
                if (!data['Blank']) data['Blank'] = 0
                data['Blank']++
            }

            let product_service = x.dataValues.product_service ? [...new Set(x.dataValues.product_service.split(","))] : []

            product_service.map(ps => {

                let trimPS = ps.trim()
                if (!data[trimPS]) data[trimPS] = 0
                data[trimPS] += 1
                // checkArr.push(trimPS)
            })


        })

        let sortedKeys = Object.keys(data).sort()

        sortedKeys.map(key => {
            sortedData["Blank"] = data["Blank"]
            sortedData[key] = data[key]
        })

        delete sortedData[""]


        return res.status(200).json({
            // data: data
            data: sortedData,
            // checkArr: checkArr
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getMaxYearIO = async (req, res) => {

    try {
        let companies = await CompanyItem.findAll({
            attributes: [[Sequelize.fn('max', Sequelize.col('year_in_operation')), 'maxYear']],
            raw: true,
        });

        return res.status(200).json({
            data: companies[0].maxYear,
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getYearIOByRange = async (req, res) => {

    let maxValue, minValue, selectorValue
    const { file_name, dataset, companyFilter, min, max, selectValue,
        user_id, categoryFilter, empSizeFilter, yearIOFilter, partnerFilter,
        digitalEngagementFilter, company_id, userFavCompFilter, productServiceFilter } = req.body;

    let whereFilter = [
        { dataset },
    ];

    let digitalEngagementFilterArr = [], totalCompanyFilter = []

    if (file_name) whereFilter.push({ file_name });

    if (company_id) whereFilter.push({ id: company_id });

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]

    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]

    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilter.push({ company_name: totalCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = [], whereEmpFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') whereEmpFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })

                if (selectValue === '<') whereEmpFilter.push({ "max_emp": { [Op.lt]: intMax } })

                if (selectValue === '>') whereEmpFilter.push({ "min_emp": { [Op.gt]: intMin } })
            })

            whereFilter.push({ [Op.or]: whereEmpFilter })

        }
        else whereFilter.push({ total_personnel: empSizeFilter });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }

    if (!min && !max) return res.status(200).json({ data: 0 })

    whereFilter.push({ "year_in_operation": getQueryCondition({ min, max, selectValue }) })

    try {
        let companies = await CompanyItem.findAll({
            // attributes: ["total_personnel","product_service",[Sequelize.fn('COUNT', Sequelize.col('company.id')), 'count']],
            attributes: ["total_personnel", "product_service"],
            include: [
                {
                    model: Expertise,
                    required: false,
                    where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                },
                // {
                //     model: PersonnelItem,
                // },
                // {
                //     model: FavouriteCompanyList,
                // }
            ],
            where: { [Op.and]: whereFilter },
            raw: true,
        });

        companies = companies.filter(comp => {
            let company = comp
            let list = comp['expertises.list']
            let total_personnel = comp.total_personnel
            console.log(comp)



            // favCompList = favCompList.filter((obj) => obj.user_id == user_id).length;


            if (productServiceFilter && productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) {

                }
                else {
                    if (!company.product_service) return false
                    if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                }
            }

            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                // for (let single of expertises) {
                // let list = single.dataValues.list
                if (list === "-") {
                    if (index == "-1") return false
                }
                else {
                    let subPartners = []
                    Object.keys(JSON.parse(list)).map(key =>
                        JSON.parse(list)[key].map(subKey => {
                            let trimSubKey = subKey.trim()
                            subPartners.push(trimSubKey)
                        }))
                    if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                }
                // }
            }
            return true
        })


        return res.status(200).json({
            data: companies.length,
        })
    } catch (error) {
        console.log(error)
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getMaxEmpSize = async (req, res) => {

    try {
        let companies = await CompanyItem.findAll({
            attributes: [[Sequelize.fn('max', Sequelize.col('year_in_operation')), 'maxYear']],
            raw: true,
        });

        return res.status(200).json({
            data: companies[0].maxYear,
        })
    } catch (error) {
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}

exports.getEmpSizeByRange = async (req, res) => {

    const { min, max, selectValue,
        user_id, categoryFilter, yearIOFilter, partnerFilter, file_name, dataset, companyFilter,
        digitalEngagementFilter, company_id, userFavCompFilter, productServiceFilter } = req.body;

    let whereFilter = [
        { dataset },
    ];

    let digitalEngagementFilterArr = [], totalCompanyFilter = []

    if (file_name) whereFilter.push({ file_name });

    if (company_id) whereFilter.push({ id: company_id });

    if (companyFilter && companyFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...companyFilter]

    if (userFavCompFilter && userFavCompFilter.length) totalCompanyFilter = [...totalCompanyFilter, ...userFavCompFilter]

    if ((companyFilter && companyFilter.length) || (userFavCompFilter && userFavCompFilter.length)) whereFilter.push({ company_name: totalCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (yearIOFilter && yearIOFilter.length) {
        let filterData = []
        if (typeof yearIOFilter[0] === "object") {
            yearIOFilter.map(obj => {
                filterData.push(getQueryCondition(obj))
            })
        }
        else {
            if (yearIOFilter.includes("<2 year")) filterData.push(0, 1, null)
            if (yearIOFilter.includes("2-3 years")) filterData.push(2)
            if (yearIOFilter.includes("3-10 year")) filterData.push(3, 4, 5, 6, 7, 8, 9)
            if (yearIOFilter.includes(">10 year")) filterData.push({ [Op.gte]: 10 })
        }
        whereFilter.push({ year_in_operation: { [Op.or]: filterData } });
    }

    if (digitalEngagementFilter && digitalEngagementFilter.length) {
        if (digitalEngagementFilter.indexOf('Basic') > -1) digitalEngagementFilterArr.push({ [Op.lt]: 2 })
        if (digitalEngagementFilter.indexOf('Intermediate') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalEngagementFilter.indexOf('High') > -1) digitalEngagementFilterArr.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalEngagementFilter.indexOf('Advance') > -1) digitalEngagementFilterArr.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalEngagementFilterArr } })
    }


    if (!min && !max) return res.status(200).json({ data: 0 })

    let intMin = parseInt(min)
    let intMax = parseInt(max)

    if (selectValue === '-') {
        whereFilter.push({ [Op.and]: { "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } } })
    }

    if (selectValue === '<') {
        whereFilter.push({ "max_emp": { [Op.lt]: intMax } })
    }

    if (selectValue === '>') {
        whereFilter.push({ "min_emp": { [Op.gt]: intMin } })
    }


    // whereFilter.push({ "total_personnel": getQueryCondition({ min: intMin, max: intMax, selectValue }) })

    // console.log(getQueryCondition({ min: intMin, max: intMax, selectValue }))

    try {
        let companies = await CompanyItem.findAll({
            // attributes: ["total_personnel", [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            attributes: ["total_personnel", "product_service"],
            where: { [Op.and]: whereFilter },
            raw: true,
            include: [
                {
                    model: Expertise,
                    required: false,
                    where: { [Op.and]: { type: "Partners" } },
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                }
            ],
        });

        // console.log("before companies", companies.length)

        let reason = []

        companies = companies.filter(comp => {
            // console.log(comp)
            let data = comp.total_personnel
            let list = comp['expertises.list']
            let company = comp

            // favCompList = favCompList.filter((obj) => obj.user_id == user_id).length;

            if (productServiceFilter && productServiceFilter.length) {
                var index = productServiceFilter.indexOf("Blank");
                const PSFilter = productServiceFilter.filter(item => item !== "Blank")
                if (!company.product_service && index !== -1) {

                }
                else {
                    if (!company.product_service) return false
                    if (!trimArray(company.product_service.split(",")).some(r => PSFilter.indexOf(r) >= 0)) return false
                }
            }


            if (partnerFilter && partnerFilter.length) {
                var index = partnerFilter.indexOf("Blank");
                // for (let single of expertises) {
                // let list = single.dataValues.list
                if (list === "-") {
                    if (index == "-1") return false
                }
                else {
                    let subPartners = []
                    Object.keys(JSON.parse(list)).map(key =>
                        JSON.parse(list)[key].map(subKey => {
                            let trimSubKey = subKey.trim()
                            subPartners.push(trimSubKey)
                        }))
                    if (!subPartners.some(r => partnerFilter.indexOf(r) >= 0)) return false
                }
                // }
            }

            // if (selectValue === '-') {
            //     if (data.includes("-")) {
            //         let splitData = data.split('-')
            //         if (!(parseInt(splitData[0]) >= intMin)) {
            //             reason.push({
            //                 data: data,
            //                 op: "- min",
            //                 min: splitData[0]
            //             })
            //             return false
            //         }
            //         if (!(parseInt(splitData[1]) <= intMax)) {
            //             reason.push({
            //                 data: data,
            //                 op: "- max",
            //                 max: splitData[1]
            //             })
            //             return false
            //         }
            //     }
            //     else {
            //         let intData = parseInt(data)
            //         if (!(intData >= intMin)) {
            //             reason.push({
            //                 data: intData,
            //                 op: "min",
            //                 min: intMin
            //             })
            //             return false
            //         }
            //         if (!(intData <= intMax)) {
            //             reason.push({
            //                 data: intData,
            //                 op: "max",
            //                 max: intMax
            //             })
            //             return false
            //         }
            //     }
            // }

            // if (selectValue === '>') {
            //     if (data.includes("-")) {
            //         let splitData = data.split('-')
            //         if (!(parseInt(splitData[0]) > intMin)) {
            //             reason.push({
            //                 data: data,
            //                 op: ">",
            //                 min: splitData[0]
            //             })
            //             return false
            //         }
            //     }
            //     else {
            //         let intData = parseInt(data)
            //         if (!(intData >= intMin)) {
            //             reason.push({
            //                 data: intData,
            //                 op: "min",
            //                 min: intMin
            //             })
            //             return false
            //         }
            //     }
            // }

            // if (selectValue === '<') {
            //     if (data.includes("-")) {
            //         let splitData = data.split('-')
            //         if (!(parseInt(splitData[0]) <= intMax && parseInt(splitData[1]) >= intMax)) {
            //             reason.push({
            //                 data: data,
            //                 op: "<",
            //                 max: splitData[1]
            //             })
            //             return false
            //         }
            //     }
            //     else {
            //         let intData = parseInt(data)
            //         if (!(intData <= intMax)) {
            //             reason.push({
            //                 data: intData,
            //                 op: "max",
            //                 max: intMax
            //             })
            //             return false
            //         }
            //     }
            // }

            return true
        })

        // companies.map(comp => comp.total_personnel)

        // console.log("reason", reason)
        // console.log("after companies", companies)

        return res.status(200).json({
            data: companies.length,
            reason: reason,
            comp: companies,
        })
    } catch (error) {
        console.log(error)
        return res.json({
            meta: {
                code: 0,
                success: false,
                message: error.message,
            }
        })
    }
}



