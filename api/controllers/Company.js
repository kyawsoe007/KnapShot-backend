'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const formidable = require('formidable');
const fs = require('fs');
const XLSX = require('xlsx');
const PersonnelItem = require('../models/Personnel');
const CompanyItem = require('../models/CompanyItem');
const axios = require('axios');

//models
const db = require('../models/db');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const Directory = require("../models/Directory");
const FavouriteCompanyList = require("../models/FavouriteCompanyList");

//util
const paginate = require('../utils/pagination');
const ThreeLevelIterator = require('../utils/ThreeLevelIterator');

//constants
const keyValues = require('../constants/keyValuesMap');
const countries = require('../constants/countries');

//config
const config = require('../../config');

function getQueryCondition({ min, max, selectValue }) {
    if (selectValue === '-') return { [Op.and]: [{ [Op.gte]: min }, { [Op.lte]: max }] }
    else if (selectValue === '<') return { [Op.lt]: max }
    else return { [Op.gt]: min }
}


Array.prototype.unique = function () {
    let a = this.concat();
    for (let i = 0; i < a.length; ++i) {
        for (let j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
};

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
            if (clone["Analytics and Tracking"]["CRM"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "CRM": clone["Analytics and Tracking"]["CRM"],
                }
                delete clone["Analytics and Tracking"]["CRM"]
            }

            if (clone["Analytics and Tracking"]["Lead Generation"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Lead Generation": clone["Analytics and Tracking"]["Lead Generation"],
                }
                delete clone["Analytics and Tracking"]["Lead Generation"]
            }

            if (clone["Analytics and Tracking"]["Product Recommendations"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Product Recommendations": clone["Analytics and Tracking"]["Product Recommendations"],
                }
                delete clone["Analytics and Tracking"]["Product Recommendations"]
            }

            if (clone["Analytics and Tracking"]["Feedback Forms and Surveys"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Feedback Forms and Surveys": clone["Analytics and Tracking"]["Feedback Forms and Surveys"],
                }
                delete clone["Analytics and Tracking"]["Feedback Forms and Surveys"]
            }
        }

        if (clone["Email Hosting Providers"]) {
            if (clone["Email Hosting Providers"]["Campaign Management"]) {
                clone.Productivity = {
                    ...clone.Productivity,
                    "Campaign Management": clone["Email Hosting Providers"]["Campaign Management"],
                }
                delete clone["Email Hosting Providers"]["Campaign Management"]
            }
            if (clone["Email Hosting Providers"]["Business Email Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Business Email Hosting": clone["Email Hosting Providers"]["Business Email Hosting"],
                }
                delete clone["Email Hosting Providers"]["Business Email Hosting"]
            }
            if (clone["Email Hosting Providers"]["Web Hosting Provider Email"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Web Hosting Provider Email": clone["Email Hosting Providers"]["Web Hosting Provider Email"],
                }
                delete clone["Email Hosting Providers"]["Web Hosting Provider Email"]
            }
            if (clone["Email Hosting Providers"]["Marketing Platform"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Marketing Platform": clone["Email Hosting Providers"]["Marketing Platform"],
                }
                delete clone["Email Hosting Providers"]["Marketing Platform"]
            }
        }

        if (clone["Web Hosting Providers"]) {
            if (clone["Web Hosting Providers"]["Cloud PaaS"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud PaaS": clone["Web Hosting Providers"]["Cloud PaaS"],
                }
                delete clone["Web Hosting Providers"]["Cloud PaaS"]
            }
            if (clone["Web Hosting Providers"]["Cloud Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Cloud Hosting": clone["Web Hosting Providers"]["Cloud Hosting"],
                }
                delete clone["Web Hosting Providers"]["Cloud Hosting"]
            }
            if (clone["Web Hosting Providers"]["Dedicated Hosting"]) {
                clone.Hosting = {
                    ...clone.Hosting,
                    "Dedicated Hosting": clone["Web Hosting Providers"]["Dedicated Hosting"],
                }
                delete clone["Web Hosting Providers"]["Dedicated Hosting"]
            }
        }


        if (clone["Widgets"] && clone["Widgets"]["Marketing Automation"]) {
            clone.Productivity = {
                ...clone.Productivity,
                "Marketing Automation": clone["Widgets"]["Marketing Automation"],
            }
            delete clone["Widgets"]["Marketing Automation"]
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
        if (assets)
            for (let [categoryKey, categoryValue] of Object.entries(assets)) {

                if (!keyValues[categoryKey]) continue;
                for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                    if (!keyValues[categoryKey].includes(typeKey)) continue;
                    let brands = [...new Set(typeValue)];
                    // for (let j = 0; j < brands.length; j++) {
                    //     var brand = brands[j];

                    //     total[categoryKey] = total[categoryKey] ? total[categoryKey] : {};

                    //     var total_type = total[categoryKey];
                    //     total_type[typeKey] = total_type[typeKey] ? total_type[typeKey] : [];

                    //     total[categoryKey][typeKey].push(brand)
                    // }
                    !total[categoryKey] && (total[categoryKey] = {});
                    !total[categoryKey][typeKey] && (total[categoryKey][typeKey] = []);
                    total[categoryKey][typeKey] = brands;
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

exports.getAll = async (req, res) => {
    const page = req.query.page || 1;
    const sortFilter = req.body.sortFilter

    const pageSize = req.query.pageSize || 10;

    const file_name = req.body.file_name;
    const industryType = req.body.industryType;
    const digitalType = req.body.digitalType;
    const frimographicFilter = req.body.frimographicFilter
    const digitalPresenceFilter = req.body.digitalPresenceFilter
    // const technologyFilter = req.body.searchedBrandsFilter ? req.body.searchedBrandsFilter : req.body.technologyFilter
    const technologyFilter = req.body.technologyFilter
    const restrictTechnologyFilter = req.body.restrictTechnologyFilter
    const companyIds = req.body.companyIds
    // const otherCompanyIds = req.body.searchedBrandsFilter ? null : req.body.otherCompanyIds
    const otherCompanyIds = req.body.otherCompanyIds
    let maxValue, minValue, selectorValue
    const { expertiseCompanyFilter, categoryFilter, empSizeFilter, yearIOFilter, user_id } = req.body;

    const dataset = req.body.dataset;

    let whereFilter = [{ dataset }];

    if (expertiseCompanyFilter && expertiseCompanyFilter.length) whereFilter.push({ company_name: expertiseCompanyFilter });

    if (categoryFilter && categoryFilter.length) whereFilter.push({ category: categoryFilter });

    if (empSizeFilter && empSizeFilter.length) {
        if (typeof empSizeFilter[0] === "object") {
            let whereMinFilter = [], whereMaxFilter = []
            empSizeFilter.map(({ min, max, selectValue }) => {
                let intMin = parseInt(min)
                let intMax = parseInt(max)
                minValue = intMin
                maxValue = intMax
                selectorValue = selectValue
                if (selectValue === '-') {
                    // whereMultiFilter.push({  [Op.and]:{ "min_emp": { [Op.gte]: intMin }, "max_emp": { [Op.lte]: intMax } }  })
                    // whereFilter.push({ "max_emp": { [Op.lte]: intMax } })
                    whereMinFilter.push({ [Op.gte]: intMin })
                    whereMaxFilter.push({ [Op.lte]: intMax })
                }

                if (selectValue === '<') {
                    // whereMultiFilter.push({ "max_emp": { [Op.lt]: intMax } })
                    whereMaxFilter.push({ [Op.lt]: intMax })
                }

                if (selectValue === '>') {
                    // whereMultiFilter.push({ "min_emp": { [Op.gt]: intMin } })
                    whereMinFilter.push({ [Op.gt]: intMin })
                }
            })
            // whereFilter.push({ "min_emp": { [Op.or]: whereMinFilter } })
            // whereFilter.push({ "max_emp": { [Op.or]: whereMaxFilter } })

            whereFilter.push({
                [Op.or]: [
                    { "min_emp": { [Op.or]: whereMinFilter } },
                    { "max_emp": { [Op.or]: whereMaxFilter } }
                ]
            })

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

    let testing = [], otherCompanies = [], mainData = [], idArr = []
    if (companyIds) idArr = [...idArr, ...companyIds]
    if (otherCompanyIds) idArr = [...idArr, ...otherCompanyIds]

    let orderFilter = []

    if (sortFilter) {
        if (sortFilter === "Alphabetical Order: A-Z") orderFilter.push(['company_name', 'ASC'])
        else if (sortFilter === "Alphabetical Order: Z-A") orderFilter.push(['company_name', 'DESC'])
        else if (sortFilter === "Ads Exp: Highest first") orderFilter.push(['overall_knapshot_score', 'DESC'])
        else if (sortFilter === "Digital Engagement: Highest first") orderFilter.push(['overall_knapshot_score', 'DESC'])
        else orderFilter.push(['id', 'ASC'])
    }
    if (industryType) whereFilter.push({ industry: industryType })
    if (!technologyFilter && (companyIds || otherCompanyIds)) whereFilter.push({ id: { [Op.or]: idArr } })
    if (digitalType) {
        if (digitalType === 'Basic')
            whereFilter.push({ overall_knapshot_score: { [Op.lt]: 2 } })
        else if (digitalType === 'High')
            whereFilter.push(
                { overall_knapshot_score: { [Op.gte]: 5 } },
                { overall_knapshot_score: { [Op.lt]: 8 } },
            )
        else if (digitalType === 'Intermediate')
            whereFilter.push(
                { overall_knapshot_score: { [Op.gte]: 2 } },
                { overall_knapshot_score: { [Op.lt]: 5 } }
            )
        else whereFilter.push({ overall_knapshot_score: { [Op.gte]: 8 } })
    }

    frimographicFilter && frimographicFilter.industry && whereFilter.push({ industry: { [Op.or]: frimographicFilter.industry } })
    frimographicFilter && frimographicFilter.main_hq_location && whereFilter.push({ main_hq_location: { [Op.or]: frimographicFilter.main_hq_location } })
    frimographicFilter && frimographicFilter.emp_size && whereFilter.push({ total_personnel: { [Op.or]: frimographicFilter.emp_size } })
    frimographicFilter && frimographicFilter.total_personnel && whereFilter.push({ company_name: { [Op.or]: frimographicFilter.total_personnel } })

    // if (frimographicFilter.total_personnel) whereFilter.push(frimographicFilter.main_hq_location)

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
    if (digitalPresenceFilter && digitalPresenceFilter.youtube) {
        if (digitalPresenceFilter.youtube.indexOf('Has') > -1) digitalPresenceFilter.youtube.push({ [Op.ne]: null })
        whereFilter.push({ youtube: { [Op.or]: digitalPresenceFilter.youtube } })
    }
    if (digitalPresenceFilter && digitalPresenceFilter.address) {
        if (digitalPresenceFilter.address.indexOf('Has') > -1) digitalPresenceFilter.address.push({ [Op.ne]: null })
        whereFilter.push({ address: { [Op.or]: digitalPresenceFilter.address } })
    }
    // if (digitalPresenceFilter && digitalPresenceFilter.directory) {
    //     console.log("filter arr", digitalPresenceFilter.directory)
    //     if (digitalPresenceFilter.directory.indexOf('0 Presence') > -1) digitalPresenceFilter.directory.push({ [Op.eq]: -1 })
    //     if (digitalPresenceFilter.directory.indexOf('1 - 2') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
    //     if (digitalPresenceFilter.directory.indexOf('3 - 5') > -1) digitalPresenceFilter.directory.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
    //     if (digitalPresenceFilter.directory.indexOf('>6') > -1) digitalPresenceFilter.directory.push({ [Op.gte]: 8 })
    //     whereFilter.push({ no_of_directory_presence: { [Op.or]: digitalPresenceFilter.directory } })
    // }
    if (digitalPresenceFilter && digitalPresenceFilter.digital) {
        if (digitalPresenceFilter.digital.indexOf('Basic') > -1) digitalPresenceFilter.digital.push({ [Op.lt]: 2 })
        if (digitalPresenceFilter.digital.indexOf('Intermediate') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 2 }, { [Op.lt]: 5 }] })
        if (digitalPresenceFilter.digital.indexOf('High') > -1) digitalPresenceFilter.digital.push({ [Op.and]: [{ [Op.gte]: 5 }, { [Op.lt]: 8 }] })
        if (digitalPresenceFilter.digital.indexOf('Advance') > -1) digitalPresenceFilter.digital.push({ [Op.gte]: 8 })
        whereFilter.push({ overall_knapshot_score: { [Op.or]: digitalPresenceFilter.digital } })
    }

    //if (file_name !== "Master DB (Golden Source)") whereFilter.push({ file_name });
    // if (file_name !== "Viet/Thai/Indo Agency List") whereFilter.push({ file_name });
    if (file_name) whereFilter.push({ file_name });

    const options = {
        page: page,
        paginate: pageSize,

    }

    try {

        await CompanyItem.findAll({
            where: {
                [Op.and]: whereFilter,
            },
            include: [
                { model: Directory },
                {
                    model: FavouriteCompanyList,
                    // where: { user_id: user_id }
                }
            ],
            order: orderFilter
        }).then(COMP => filterFunction(COMP, technologyFilter, restrictTechnologyFilter, digitalPresenceFilter))
            .then(resp => {
                if (resp) {
                    resp.forEach(data => {
                        let temp = data
                        temp.dataValues.fav_company_lists = temp.dataValues.fav_company_lists.filter(fav => fav.user_id === user_id)
                        testing.push(temp)
                    })
                }

            })

        if (technologyFilter && otherCompanyIds) {
            otherCompanies = await Company.findAll({
                where: { id: { [Op.or]: idArr } },
                include: [
                    { model: Directory },
                    {
                        model: FavouriteCompanyList,
                        // where: { user_id: user_id }
                    }
                ],
                order: orderFilter
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
                    // checkingTotal.push(totalMaxDir)
                    // console.log("totalMaxDirhere", totalMaxDir)
                    if (digitalPresenceFilter && digitalPresenceFilter.directory) {
                        let arr = digitalPresenceFilter.directory
                        let numberArr = []
                        for (let index in arr) {
                            if (!arr.hasOwnProperty(index)) continue;
                            // console.log(arr[index])


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
            })

            mainData = [...testing, ...otherCompanies]

            // for(let i in mainData){
            //     if(!mainData.hasOwnProperty(i)) continue;
            //     mainData[i].id
            // }
        }
        // Author KST unique obj arr
        mainData = mainData.filter((data, index, self) => index === self.findIndex((t) => (t.id === data.id)))


        // let abc = {}
        // checkingTotal.map(v => {
        //     abc[v] = abc[v] ? abc[v] + 1 : 1
        // })
        // console.log(abc)

        // const response = await Company.paginate(options);

        // function paginate(array, page_size, page_number) {
        //     --page_number; // because pages logically start with 1, but technically with 0
        //     return array.slice(page_number * page_size, (page_number + 1) * page_size);
        // }
        // let notID = []

        // console.log("check", mainData.length, testing.length, otherCompanies.length)
        // let compID = []
        // for (let i in mainData) {
        //     compID.push(mainData[i].id)
        // }
        // for (let i = 0; i <= 2480; i++) {
        //     if (!compID.sort(function (a, b) { return a - b }).includes(i)) notID.push(i)
        // }

        if (technologyFilter && Array.isArray(otherCompanyIds)) {
            return res.status(200).json({
                message: "Successful",
                count: mainData.length,
                companies: mainData.splice((page - 1) * pageSize, pageSize),
                // notID: notID
            });
        }

        if (testing) {
            return res.status(200).json({
                message: "Successful",
                count: testing.length,
                companies: testing.splice((page - 1) * pageSize, pageSize),
                // totalArr: totalArr
                // idArr: notID
            });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.getCompanyByName = (req, res) => {

    const company_name = req.params.id;

    Company
        .findOne({
            where: {
                company_name: company_name,
            },
            include: [
                { model: Personnel },
                { model: Directory }
            ]
        })
        .then(response => {
            if (response) return res.status(200).json({
                message: "Successful",
                company: response
            });
            else return res.status(204).json({
                message: "Company not found"
            });
        })
        .catch(error => {
            return res.status(500).json({
                message: error.message
            });
        })
}

exports.getAllDatasets = async (req, res) => {
    let results = [];
    try {
        const datasets = await db.query(
            `SELECT dataset, COUNT(1) as count FROM company GROUP BY dataset ORDER BY count DESC`,
            {
                type: db.QueryTypes.SELECT
            }
        );

        if (datasets) {
            datasets.forEach(dataset => {
                if (dataset.dataset) {
                    results.push(dataset.dataset);
                }
            })
            return res.status(200).json({
                message: "Successful",
                datasets: results
            });
        }

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
}

exports.search = async (req, res) => {

    let keyword = req.query.keyword;
    let dataset = req.query.dataset;
    let limit = req.query.limit || 20;

    try {
        let company = await Company.findAll({
            where: {
                [Op.and]: [
                    {
                        company_name: {
                            [Op.like]: keyword + "%",
                        }
                    },
                    {
                        dataset: {
                            [Op.like]: "%" + dataset + "%",
                        }
                    }
                ]
            },
            include: [{ model: Personnel }],
            limit: limit
        });

        if (company) return res.status(200).json({
            message: "Successful",
            companies: company
        });
        else return res.status(404).json({
            message: "Company not found"
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    };
};


function StoreCompany(data) {
    return new Promise(function (resolve, reject) {
        var values = {};
        data.forEach(function (row) {
            if (row.length >= 2) {
                var co_name = row[0];
                var attr = row[1];
                var val = row[2] ? row[2] : null;
                if (values[co_name] === undefined) {
                    values[co_name] = {
                        name: co_name,
                        attr: {
                            industry: [],
                            industry_second_level: [],
                            industry_third_level: [],
                            partner: {},
                            asset: {},
                            social: {},
                        },
                    };
                }
                if (attr === 'industry') {
                    var industry = row[2] !== undefined ? row[2] : null;
                    if (industry) {
                        values[co_name].attr.industry.push(industry);
                    }
                } else if (attr === 'partner') {
                    var partner_name = row[2] !== undefined ? row[2] : null;
                    var partnership_type = row[3] !== undefined ? row[3] : null;
                    if (partner_name && partnership_type && values[co_name].attr.partner[partner_name] === undefined) {
                        values[co_name].attr.partner[partner_name] = {
                            partner_name: partner_name,
                            partnership_type: partnership_type,
                        }
                    }
                } else if (attr === 'asset') {
                } else if (attr === 'social') {
                    var social_name = row[2] !== undefined ? row[2] : null;
                    var social_url = row[3] !== undefined ? row[3] : null;
                    if (social_name && social_url && values[co_name].attr.social[social_name] === undefined) {
                        values[co_name].attr.social[social_name] = {
                            social_name: social_name,
                            social_url: social_url,
                        }
                    }
                } else {
                    if (values[co_name].attr[attr] === undefined) {
                        values[co_name].attr[attr] = [];
                    }
                    if (val) {
                        values[co_name].attr[attr].push(val);
                    }
                }
            }
        });

        var companies = Object.values(values);

        var items = companies.map(function (item) {
            var company = {};
            company.company_name = item.name;
            var attr = item.attr;
            company.searchable = null;
            if (attr.searchable && attr.searchable.length > 0) {
                company.searchable = attr.searchable.unique().join(',');
            }
            company.overall_knapshot_score = -1;
            if (attr.overallKnapshotScore && attr.overallKnapshotScore.length > 0) {
                company.overall_knapshot_score = parseFloat(attr.overallKnapshotScore.unique().join('-'));
            }
            company.searchability_score = -1;
            if (attr.searchabilityScore && attr.searchabilityScore.length > 0) {
                company.searchability_score = parseFloat(attr.searchabilityScore.unique().join('-'));
            }
            company.activity_score = -1;
            if (attr.activityScore && attr.activityScore.length > 0) {
                company.activity_score = parseFloat(attr.activityScore.unique().join('-'));
            }
            company.consistency_score = -1;
            if (attr.consistencyScore && attr.consistencyScore.length > 0) {
                company.consistency_score = parseFloat(attr.consistencyScore.unique().join('-'));
            }
            company.dataset = null;
            if (attr.dataset && attr.dataset.length > 0) {
                company.dataset = attr.dataset.unique().join(',');
            }
            company.description = null;
            if (attr.description && attr.description.length > 0) {
                company.description = attr.description.join(',');
            }
            company.company_status = null;
            if (attr.companyStatus && attr.companyStatus.length > 0) {
                company.company_status = attr.companyStatus.unique().join(',');
            }
            company.has_funding = null;
            if (attr.hasFunding && attr.hasFunding.length > 0) {
                company.has_funding = attr.hasFunding.unique().join(',');
            }
            company.business_type = 'cannot verify';
            if (attr.businessType && attr.businessType.length > 0) {
                company.business_type = attr.businessType.unique().join(',');
            }
            company.address = 'cannot verify';
            if (attr.address && attr.address.length > 0) {
                company.address = attr.address.unique().join(',');
            }
            company.industry = 'cannot verify';
            if (attr.industry && attr.industry.length > 0) {
                company.industry = '"' + attr.industry.unique().join('","') + '"';
            }
            company.industry_second_level = 'cannot verify';
            if (attr.industry_second_level && attr.industry_second_level.length > 0) {
                company.industry_second_level = '"' + attr.industry_second_level.unique().join('","') + '"';
            }
            company.industry_third_level = 'cannot verify';
            if (attr.industry_third_level && attr.industry_third_level.length > 0) {
                company.industry_third_level = '"' + attr.industry_third_level.unique().join('","') + '"';
            }
            company.company_email_address = 'cannot verify';
            if (attr.companyEmailAddress && attr.companyEmailAddress.length > 0) {
                company.company_email_address = attr.companyEmailAddress.unique().join(',');
            }
            company.main_line_number = 'cannot verify';
            if (attr.mainLineNumber && attr.mainLineNumber.length > 0) {
                company.main_line_number = attr.mainLineNumber.unique().join(',');
            }
            company.organization_type = 'cannot verify';
            if (attr.organizationType && attr.organizationType.length > 0) {
                company.organization_type = attr.organizationType.unique().join(',');
            }
            company.year_in_operation = null;
            if (attr.yearInOperation && attr.yearInOperation.length > 0) {
                company.year_in_operation = attr.yearInOperation.unique().join(',');
            }
            company.year_of_operation = 'cannot verify';
            if (attr.yearOfOperation && attr.yearOfOperation.length > 0) {
                company.year_of_operation = attr.yearOfOperation.unique().join(',');
            }
            company.total_offices_region = -1;
            if (attr.totalOfficesByCountryOfPresence && attr.totalOfficesByCountryOfPresence.length > 0) {
                company.total_offices_region = parseInt(attr.totalOfficesByCountryOfPresence.unique().join(','), 10);
            }
            company.total_offices_cop = -1;
            if (attr.totalOfficesByAllRegions && attr.totalOfficesByAllRegions.length > 0) {
                company.total_offices_cop = parseInt(attr.totalOfficesByAllRegions.unique().join(','), 10);
            }
            company.main_hq_location = 'cannot verify';
            if (attr.mainHqLocation && attr.mainHqLocation.length > 0) {
                company.main_hq_location = attr.mainHqLocation.unique().join(',');
            }
            company.total_personnel = -1;
            if (attr.totalPersonnel && attr.totalPersonnel.length > 0) {
                company.total_personnel = parseInt(attr.totalPersonnel.unique().join(','), 10);
            }
            company.management = -1;
            if (attr.management && attr.management.length > 0) {
                company.management = parseInt(attr.management.unique().join(','), 10);
            }
            company.staff = -1;
            if (attr.staff && attr.staff.length > 0) {
                company.staff = parseInt(attr.staff.unique().join(','), 10);
            }
            company.website = 'cannot verify';
            if (attr.website && attr.website.length > 0) {
                company.website = attr.website.unique().join(',');
            }
            company.no_of_directory_presence = -1;
            if (attr.noOfDirectoryPresence && attr.noOfDirectoryPresence.length > 0) {
                company.no_of_directory_presence = parseInt(attr.noOfDirectoryPresence.unique().join(','), 10);
            }
            company.digital_presence_analysis = null;
            if (attr.digitalPresenceAnalysis && attr.digitalPresenceAnalysis.length > 0) {
                company.digital_presence_analysis = attr.digitalPresenceAnalysis.unique().join(',');
            }
            company.fax = null;
            if (attr.fax && attr.fax.length > 0) {
                company.fax = attr.fax.join(',');
            }
            company.speciality = null;
            if (attr.speciality && attr.speciality.length > 0) {
                company.speciality = attr.speciality.unique().join(',');
            }
            company.agency_status = null;
            if (attr.agencyStatus && attr.agencyStatus.length > 0) {
                company.agency_status = attr.agencyStatus.unique().join(',');
            }
            company.facebook = null;
            if (attr.social && attr.social.facebook && attr.social.facebook.social_url && attr.social.facebook.social_url.length > 0) {
                company.facebook = attr.social.facebook.social_url;
            }
            company.twitter = null;
            if (attr.social && attr.social.twitter && attr.social.twitter.social_url && attr.social.twitter.social_url.length > 0) {
                company.twitter = attr.social.twitter.social_url;
            }
            company.linkedIn = null;
            if (attr.social && attr.social.linkedin && attr.social.linkedin.social_url && attr.social.linkedin.social_url.length > 0) {
                company.linkedIn = attr.social.linkedin.social_url;
            }
            company.instagram = null;
            if (attr.social && attr.social.instagram && attr.social.instagram.social_url && attr.social.instagram.social_url.length > 0) {
                company.instagram = attr.social.instagram.social_url;
            }
            company.youtube = null;
            if (attr.social && attr.social.youtube && attr.social.youtube.social_url && attr.social.youtube.social_url.length > 0) {
                company.youtube = attr.social.youtube.social_url;
            }
            company.product_service = null;
            if (attr.productService && attr.productService.length > 0) {
                company.product_service = attr.productService.unique().join(',');
            }
            company.data_quality = null;
            if (attr.dataQuality && attr.dataQuality.length > 0) {
                company.data_quality = attr.dataQuality.unique().join(',');
            }
            company.partners = null;
            var partners = Object.values(attr.partner);
            if (partners.length > 0) {
                company.partners = JSON.stringify(partners);
            }
            company.asset = null;
            if (attr.asset) {
                company.asset = JSON.stringify(attr.asset);
            }
            company.client_industries = null;
            if (attr.clientIndustry && attr.clientIndustry.length > 0) {
                company.client_industries = attr.clientIndustry.join(',');
            }
            return company;
        });
        Company.bulkCreate(items).then((response) => {
            resolve(response);
        }).catch(function (err) {
            reject(err);
        });
    });
}

function StorePersonnel(data) {
    return new Promise(function (resolve, reject) {
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
        Personnel.bulkCreate(items).then(function (response) {
            resolve(response);
        }).catch(function (e) {
            reject(e);
        });
    });
}

const fillPersonnelForCompany = async function (company, list_info) {
    var no_of_mgmt = 0;
    var no_of_staff = 0;
    list_info.forEach(function (item) {
        if (item.fields.role && item.fields.role.toLowerCase() === 'management') {
            no_of_mgmt++;
        } else {
            no_of_staff++;
        }
        PersonnelItem.create({
            company_id: company.id,
            name: item.name,
            role: item.fields.role ? item.fields.role : '',
            title: item.fields.title ? item.fields.title : '',
            email: item.fields.email ? item.fields.email : '',
            seniority: item.fields.seniority ? item.fields.seniority : '',
            phone: item.fields.phone ? item.fields.phone : '',
        });
    });

    company.no_of_mgmt = no_of_mgmt;
    company.no_of_staff = no_of_staff;
    company.save();
};

const fillPersonnelInfo = async function (info) {
    var company = await CompanyItem.findOne({
        where: {
            name: {
                [Op.like]: "%" + info.name + "%",
            },
        }
    });
    if (company) {
        return fillPersonnelForCompany(company, info.info);
    } else {
        console.log("Company was not found ", info.name)
    }
};

function processPersonnels(data) {
    return new Promise(function (resolve, reject) {
        try {
            var values = {};
            data.forEach(function (i) {
                if (values[i[0]] === undefined) {
                    values[i[0]] = {
                        name: i[0],
                        info: {},
                    };
                }
                if (values[i[0]]['info'][i[1]] === undefined) {
                    values[i[0]]['info'][i[1]] = {
                        name: i[1],
                        fields: {},
                    };
                }
                values[i[0]]['info'][i[1]]['fields'][i[2]] = i[3];
            });

            var list_items = [];
            for (var i in values) {
                var company = values[i];
                var personnels = [];
                for (var j in company['info']) {
                    var personnel = company['info'][j];
                    personnels.push(personnel);
                }
                company['info'] = personnels;
                list_items.push(company);
            }
            resolve(list_items);
        } catch (e) {
            reject(e);
        }

    })
}

exports.uploadPersonnelInfo = function (req, res) {
    var form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.parse(req, function (err, fields, files) {
        if (files.file) {
            fs.readFile(files.file.path, {
                encoding: 'utf8',
            }, async function (err, content) {
                if (err) {
                    res.json({
                        meta: {
                            code: 0,
                            success: false,
                            message: err.message,
                        },
                    })
                }
                const wb = XLSX.read(content, {
                    type: 'string',
                });
                /* Get first worksheet */
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                /* Convert array of arrays */
                const data = XLSX.utils.sheet_to_json(ws, {
                    header: 1,
                });

                if (data.length > 0) {
                    var list_items = await processPersonnels(data);
                    PersonnelItem.truncate()
                        .then(function () {
                            var start = 0;
                            var total = 200;
                            var pid = setInterval(function () {
                                if (total > list_items.length) {
                                    clearInterval(pid);
                                }
                                var items = list_items.slice(start, total);
                                var count = items.map(function (item) {
                                    return item.info.length;
                                }).reduce(function (a, b) {
                                    return a + b
                                }, 0);

                                fs.appendFile("checking_personnels_" + start + '_' + total + '_' + count + ".txt", JSON.stringify(items));
                                items.forEach(fillPersonnelInfo);
                                start = total;
                                total = start + 200;
                            }, 10000);
                        })
                        .catch(function (err) {
                            console.log(err);
                        });

                    res.json({
                        meta: {
                            code: 200,
                            success: true,
                            message: "Requested",
                        },
                        data: {
                            list_items: list_items.length,
                        },
                    });
                } else {
                    res.json({
                        meta: {
                            code: 0,
                            success: false,
                            message: 'File empty',
                        },
                    })
                }
            });
        } else {
            res.json({
                meta: {
                    code: 0,
                    success: false,
                    message: 'Please select a file',
                },
            })
        }
    });
};

exports.searchEngine = (req, res) => {

    let keyword = req.query.keyword;
    let dataset = req.query.dataset;

    axios.get(
        config.engine_api.search_company,
        {
            params: {
                companyName: keyword,
                country: dataset,
            }
        })
        .then(response => response.data)
        .then(resJson => {
            return res.status(200).json({ message: "Successful", status: resJson["status"] });
        })
        .catch(error => {
            return res.status(500).json({ message: error.message });
        });
};

exports.searchEngineStatus = (req, res) => {

    let keyword = req.query.keyword;
    let dataset = req.query.dataset;

    axios.get(
        config.engine_api.check_company_status,
        {
            params: {
                companyName: keyword,
                country: dataset,
            }
        }
    )
        .then(response => response.data)
        .then(resJson => {
            return res.status(200).json({
                message: "Successful",
                status: resJson["status"],
                detailedStatus: resJson["detailedStatus"]
            });
        })
        .catch(error => {
            return res.status(500).json({ message: error.message });
        });
};

exports.searchEngineResult = (req, res) => {

    let keyword = req.query.keyword;
    let dataset = req.query.dataset;

    axios
        .get(
            config.engine_api.get_company_results,
            {
                params: {
                    companyName: keyword,
                    country: dataset,
                }
            })
        .then(response => response.data)
        .then(async response => {
            try {

                let content = response.split('------------------------------------------------');

                if (content.length === 2) {

                    let company_info = content[0].trim();

                    const wb = XLSX.read(company_info, {
                        type: 'string',
                        raw: true,
                    });

                    /* Get first worksheet */
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];

                    /* Convert array of arrays */
                    const data_c = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    let companies = await StoreCompany(data_c);

                    let personnels_info = content[1].trim();
                    const wb_p = XLSX.read(personnels_info, {
                        type: 'string',
                        raw: true,
                    });

                    /* Get first worksheet */
                    const wsname_p = wb_p.SheetNames[0];
                    const ws_p = wb_p.Sheets[wsname_p];

                    /* Convert array of arrays */
                    const data_p = XLSX.utils.sheet_to_json(ws_p, { header: 1 });
                    let personnels = await StorePersonnel(data_p);
                    return res.json({
                        meta: {
                            code: 200,
                            success: true,
                            message: 'Stored successfully',
                        },
                        data: {
                            companies,
                            personnels,
                            response,
                            data_c
                        }
                    })
                } else {
                    return res.json({
                        meta: {
                            code: 0,
                            success: false,
                            message: "Response data didn't correct format",
                        },
                        data: {
                            response: response,
                        }
                    });
                }
            } catch (e) {
                return res.json({
                    meta: {
                        code: 0,
                        success: false,
                        message: e.message,
                    },
                    data: {
                        response: response,
                    }
                })
            }
        })
        .catch(error => {
            return res.status(500).json({
                message: error.message
            });
        });
}

exports.deleteByName = (req, res) => {

    let keyword = req.query.keyword;

    Company
        .findOne({
            where: { company_name: keyword },
            include: [{ model: Personnel }]
        })
        .then(async response => {
            if (response) {
                const result = await response.destroy();
                if (result) return res.status(200).json({ message: "Company deleted successfully" });
            }
            else return res.status(404).json({ message: "Company not found" });
        })
        .catch(error => {
            return res.status(500).json({ message: error.message });
        });
};

exports.deleteAllCompanies = (req, res) => {

    Company
        .destroy({ where: {}, truncate: true })
        .then(response => {
            return res.status(200).json({ message: "Successfully deleted" });
        })
        .catch(error => {
            return res.status(500).json({ message: error.message });
        });
}

exports.getAllLocations = (req, res) => {

    const dataset = req.body.dataset;

    const file_name = req.body.file_name;

    let whereFiler = [
        { dataset: dataset },
        { latitude: { [Op.ne]: null } },
        { longitude: { [Op.ne]: null } },
    ];

    if (file_name !== "Master DB (Golden Source)") whereFiler.push({ file_name });

    Company.findAll({
        where: {
            [Op.and]: whereFiler
        },
        attributes: ["company_name", "industry", "total_personnel", "address", "main_line_number", "website", "company_email_address", "facebook", "linkedIn", "twitter", "instagram", "youtube", "overall_knapshot_score", "latitude", "longitude", "id", "dataset"]
    })
        .then(response => {
            return res.status(200).json({ message: "Successful", companies: response });
        })
        .catch(error => {
            return res.status(500).json({ message: error.message });
        })
}

exports.getGeoData = (req, res) => {
    let dataset = req.query.dataset;
    try {
        let path = `./files/geoData/${dataset}.geojson`;
        return res.download(path);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}

exports.getFileNames = async (req, res) => {

    let results = [];
    // let results = ["Viet/Thai/Indo Agency List"];
    // let results = ["Master DB (Golden Source)"];

    try {
        const filenames = await db.query(
            `SELECT file_name, COUNT(1) as count FROM company GROUP BY file_name ORDER BY count DESC`,
            {
                type: db.QueryTypes.SELECT
            }
        );

        // const filenames = await Company.update(
        //     { file_name: "" },
        //     {
        //         where: {
        //             file_name: null
        //         }
        //     }
        // )

        if (filenames) {

            filenames.forEach(filename => {
                if (filename.file_name) results.push(filename.file_name);
            });

            return res.status(200).json({
                message: "Successful",
                filenames: results
            });
        }


    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
}

exports.checkEnv = (req, res) => {
    return res.status(200).json({
        message: "SUCCESS",
        env: JSON.stringify(process.env)
    })
}

const updateScoreFunc = async (obj, id) => {
    return await Company.update(obj,
        {
            where: {
                id: id
            }
        }
    );
}

exports.updateScore = async function (req, res) {

    try {
        const companies = await CompanyItem.findAll({
            where: {
                overall_knapshot_score: {
                    [Op.lt]: 10
                }
                // company_name : "2359 MEDIA (INDO)"
            },
            include: [
                { model: Directory }
            ]
        });

        if (companies) {

            for (let i = 0; i < companies.length; i++) {

                let digital_presence_score = 0.0, technology_asset_score = 0.0

                if (companies[i].website && companies[i].website !== "cannot verify") {
                    digital_presence_score += 1.2;
                }
                if (companies[i].linkedIn && companies[i].linkedIn !== "cannot verify") {
                    digital_presence_score += 0.2;
                }
                if (companies[i].facebook && companies[i].facebook !== "cannot verify") {
                    digital_presence_score += 0.2;
                }
                if (companies[i].twitter && companies[i].twitter !== "cannot verify") {
                    digital_presence_score += 0.1;
                }
                if (companies[i].instagram !== "" && companies[i].instagram !== null && companies[i].instagram !== "cannot verify") {
                    digital_presence_score += 0.1;
                }
                // if (companies[i].youtube !== "" && companies[i].youtube !== null && companies[i].youtube !== "cannot verify") {
                //     total += 0.1;
                // }
                if (companies[i].company_email_address && companies[i].company_email_address !== "cannot verify") {
                    let mail = companies[i].company_email_address.split('@')[1];
                    if (mail === 'gmail.com' || mail === 'yahoo.com') {
                        digital_presence_score += 0.2;
                    } else {
                        digital_presence_score += 0.4;
                    }
                }
                if (companies[i].no_of_directory_presence && companies[i].no_of_directory_presence !== "cannot verify") {
                    if (companies[i].no_of_directory_presence <= 2) digital_presence_score += 0.2;
                    if (companies[i].no_of_directory_presence >= 3) digital_presence_score += 0.4;
                }
                if (companies[i].address && companies[i].address !== "cannot verify") {
                    digital_presence_score += 0.2;
                }
                if (companies[i].main_line_number && companies[i].main_line_number !== "cannot verify" && companies[i].main_line_number !== "+normal") {
                    digital_presence_score += 0.2;
                }
                let assets = JSON.parse(companies[i].asset)
                if (assets) {
                    let clone, totalTotal = {}
                    for (let [categoryKey, categoryValue] of Object.entries(assets)) {

                        if (!keyValues[categoryKey]) continue;
                        for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                            if (!keyValues[categoryKey].includes(typeKey)) continue;
                            let brands = [...new Set(typeValue)];
                            !totalTotal[categoryKey] && (totalTotal[categoryKey] = {});
                            !totalTotal[categoryKey][typeKey] && (totalTotal[categoryKey][typeKey] = []);
                            totalTotal[categoryKey][typeKey] = brands;
                        }
                    }

                    // Object.entries(obj).length === 0 && obj.constructor === Object
                    // if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("before", totalTotal)

                    clone = assetDataProcess(totalTotal)
                    // if (companies[i].company_name === "2359 MEDIA (INDO)") console.log("after", clone)
                    if (clone["Advertising"] && Object.entries(clone["Advertising"]).length !== 0 && clone["Advertising"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Advertising"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len", len)
                        technology_asset_score += len;
                    }

                    if (clone["Analytics and Tracking"] && Object.entries(clone["Analytics and Tracking"]).length !== 0 && clone["Analytics and Tracking"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Analytics and Tracking"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len", len)
                        technology_asset_score += len;
                    }

                    if (clone["Ecommerce"] && Object.entries(clone["Ecommerce"]).length !== 0 && clone["Ecommerce"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Ecommerce"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len", len)
                        technology_asset_score += len;
                    }
                    if (clone["Productivity"] && Object.entries(clone["Productivity"]).length !== 0 && clone["Productivity"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Productivity"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len pro", len)
                        technology_asset_score += len;
                    }
                    if (clone["Widgets"] && Object.entries(clone["Widgets"]).length !== 0 && clone["Widgets"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Widgets"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 0.7) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len", len)
                        technology_asset_score += len;
                    }
                    if (clone["Hosting"] && Object.entries(clone["Hosting"]).length !== 0 && clone["Hosting"].constructor === Object) {
                        let len = 0;
                        Object.values(clone["Hosting"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("b", b)
                                    if (len < 0.7) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        if (companies[i].company_name === "Mahagiri Villas Sanur") console.log("len", len)
                        technology_asset_score += len;
                    }
                }



                await updateScoreFunc(
                    {
                        overall_knapshot_score: technology_asset_score + digital_presence_score,
                        digital_presence_score: digital_presence_score,
                        technology_asset_score: technology_asset_score
                    },
                    companies[i].id
                )
            }
        }
        return res.status(200).json({ message: "Updated" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// exports.updateScore = async function (req, res) {
//     try {
//         const companies = await CompanyItem.findAll({ where: { company_name: "Amfora" } });

//         if (companies) {
//             for (let i = 0; i < companies.length; i++) {

//                 let total = 0.0;

//                 if (companies[i].website !== "" && companies[i].website !== null && companies[i].website !== "cannot verify") {
//                     total += 1.2;
//                 }
//                 if (companies[i].linkedIn !== "" && companies[i].linkedIn !== null && companies[i].linkedIn !== "cannot verify") {
//                     total += 0.2;
//                 }
//                 if (companies[i].facebook !== "" && companies[i].facebook !== null && companies[i].facebook !== "cannot verify") {
//                     total += 0.2;
//                 }
//                 if (companies[i].twitter !== "" && companies[i].twitter !== null && companies[i].twitter !== "cannot verify") {
//                     total += 0.1;
//                 }
//                 if (companies[i].instagram !== "" && companies[i].instagram !== null && companies[i].instagram !== "cannot verify") {
//                     total += 0.1;
//                 }
//                 if (companies[i].company_email_address !== "" && companies[i].company_email_address !== null && companies[i].company_email_address !== "cannot verify") {
//                     let mail = companies[i].company_email_address.split('@')[1];
//                     if (mail === 'gmail.com' || mail === 'yahoo.com') {
//                         total += 0.2;
//                     } else {
//                         total += 0.4;
//                     }
//                 }
//                 if (companies[i].no_of_directory_presence !== "" && companies[i].no_of_directory_presence !== null && companies[i].no_of_directory_presence !== "cannot verify") {
//                     if (companies[i].no_of_directory_presence <= 2) total += 0.2;
//                     if (companies[i].no_of_directory_presence >= 3) total += 0.4;
//                 }
//                 if (companies[i].address !== "" && companies[i].address !== null && companies[i].address !== "cannot verify") {
//                     total += 0.2;
//                 }
//                 if (companies[i].main_line_number !== "" && companies[i].main_line_number !== null && companies[i].main_line_number !== "cannot verify" && companies[i].main_line_number !== "+normal") {
//                     total += 0.2;
//                 }
//                 if (companies[i].asset !== null) {
//                     let assets = JSON.parse(companies[i].asset);
//                     if (assets["Advertising"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Advertising"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 1.4) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }
//                     if (assets["Analytics and Tracking"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Analytics and Tracking"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 1.4) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }
//                     if (assets["Ecommerce"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Ecommerce"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 1.4) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }
//                     if (assets["Payment"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Payment"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 1.4) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }
//                     if (assets["Widgets"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Widgets"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 0.6) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }
//                     if (assets["Content Management System"] !== undefined) {
//                         let len = 0;
//                         Object.values(assets["Content Management System"]).map(a => {
//                             if (a && typeof a === "object" && a.length > 0) {
//                                 a.map(b => {
//                                     if (len < 0.4) {
//                                         len += 0.1
//                                     }
//                                 })
//                             }
//                         })
//                         total += len;
//                     }

//                 }

//                 await CompanyItem.update(
//                     {
//                         overall_knapshot_score: total
//                     },
//                     {
//                         where: {
//                             id: companies[i].id
//                         }
//                     }
//                 );
//             }
//         }
//         return res.status(200).json({ message: "OK" });
//     } catch (error) {
//         return res.status(500).json({ message: error.message });
//     }
// }


exports.setLatLng = async function (req, res) {

    let file_name = req.query.file_name;
    let counter = 10
    let Updated = [], not_updated = []

    try {
        const companies = await Company.findAll({
            attributes: ["company_name", "dataset", "latitude"],
            where: {
                [Op.and]: [{ latitude: { [Op.eq]: null } }, { file_name }],
            }
        });

        for (let company of companies) {
            if (!counter) break;
            let company_name = encodeURIComponent(company.company_name)
            // + "%20" + company.dataset;
            let latLng = await getLatLng(company_name, company.dataset);
            if (latLng && latLng.lat && latLng.lng) {
                let update = await updateLatLng(company.company_name, latLng.lat, latLng.lng);
                Updated.push(company.company_name)
                counter--
            }
            else {
                updateLatLng(company.company_name, "", "")
                not_updated.push(company.company_name)
            }
        }
        return res.status(200).json({ message: "Successful", updated_companies: Updated, not_updated: not_updated });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

function getLatLng(company_name, dataset) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            axios
                .get(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${company_name}&inputtype=textquery&fields=geometry&locationbias=circle:200000@${countries[dataset.toLowerCase()].coordinate}&key=AIzaSyCky-XTmcfdn-CP-WbipcusiZPQvmtnMh8`)
                .then(response => {
                    if (response.data.status === 'OK') {
                        resolve(response.data.candidates[0].geometry.location);
                    }
                    resolve({ lat: "", lng: "" });
                }).catch(function (error) {
                    resolve({ lat: "", lng: "" });
                })

        }, 5000);
    });
}

async function updateLatLng(company_name, latitude, longitude) {
    try {
        const company = await Company.update(
            {
                latitude,
                longitude
            },
            {
                where: {
                    company_name
                }
            }
        );
        return true;
    } catch (error) {
        return false;
    }
}

exports.getCompanyByMultiIDs = async function (req, res) {
    const { id } = req.body
    const testing = await Company.findAll({
        where: {
            id: id
        },
    }).then(resp => {
        return resp.map(x => x.dataValues)
    })
    return res.status(200).json({
        message: "Successful",
        data: testing,
        count: testing.length
    });
}

exports.getFileNamesFromDB = async function (req, res) {
    let fileNameArr = []
    try {
        await Company.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('file_name')), 'file_name'],
            ],
            where: {
                [Op.and]: [
                    {
                        file_name: {
                            [Op.ne]: '',
                        }
                    },
                    {
                        file_name: {
                            [Op.ne]: null
                        }
                    }
                ]
            }
        }).then(
            resp => {
                resp.map(x => fileNameArr.push(x.dataValues.file_name))
            }
        )
    } catch (error) {
        console.log("errror", error)
    }
    return res.status(200).json({
        message: "Successful",
        data: fileNameArr,
    });
}

exports.updateFileNamesFromDB = async function (req, res) {
    const { companyList, fileNameToUpdate } = req.body
    try {
        await Company.update(
            {
                file_name: fileNameToUpdate
            },
            {
                where: {
                    company_name: companyList
                }
            }
        ).then(
            resp => {
                return res.status(200).json({
                    message: "Updated",
                });
            }
        )
    } catch (error) {
        console.log('error', error)
    }
}