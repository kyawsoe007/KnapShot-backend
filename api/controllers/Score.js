'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const axios = require('axios');
const XLSX = require('xlsx');
const formidable = require('formidable');

//models
const db = require('../models/db');
const CompanyItem = require('../models/CompanyItem');
const PersonnelItem = require('../models/Personnel');
const Expertise = require('../models/Expertise')
const FavouriteCompanyList = require("../models/FavouriteCompanyList");
const Directory = require("../models/Directory");
const ScoreList = require('../models/ScoreList');
const ScoreConfig = require('../models/ScoreConfig');
const ScoreConfigCalculate = require('../models/ScoreConfigCalculate');


//config
const config = require('../../config');

const path = require('path');

async function calculateCustomScore(response) {

    if (response) {
        // let configSetting = response.dataValues
        let { id, list_name, fileName } = response.dataValues
        let score_percent = JSON.parse(response.dataValues.score_percent)
        let { Firmographic, Technographic, ...rest } = JSON.parse(response.dataValues.selected_value)
        let companyContact = rest['Company Contact']
        let technoScoreObj = score_percent['Technographic'].child


        let companies = await CompanyItem.findAll({
            include: [
                PersonnelItem, FavouriteCompanyList,
                {
                    model: Expertise,
                    required: false,
                    on: {
                        'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                        'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                    }
                },
            ],
            where: {
                [Op.and]: {
                    file_name: fileName,
                }
            },
            order: [
                ['company_name', 'ASC'],
            ],
        })

        if (companies) {

            for (let i = 0; i < companies.length; i++) {
                let total_score = 0.0, f = 0.0, t = 0.0

                //Company Contact
                if (companyContact.includes('Company Name') && companies[i].company_name) {
                    total_score += parseFloat(score_percent['Company Contacts']['Company Name'].split('+')[0])
                }
                if (companyContact.includes('Country') && companies[i].dataset) {
                    total_score += parseFloat(score_percent['Company Contacts']['Country'].split('+')[0])
                }
                if (companyContact.includes('Website') && companies[i].website) {
                    total_score += parseFloat(score_percent['Company Contacts']['Website'].split('+')[0])
                }
                if (companyContact.includes('LinkedIn') && companies[i].linkedIn && companies[i].linkedIn != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['LinkedIn'].split('+')[0])
                }
                if (companyContact.includes('Facebook') && companies[i].facebook && companies[i].facebook != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Facebook'].split('+')[0])
                }
                if (companyContact.includes('Twitter') && companies[i].twitter && companies[i].twitter != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Twitter'].split('+')[0])
                }
                if (companyContact.includes('Instagram') && companies[i].instagram && companies[i].instagram != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Instagram'].split('+')[0])
                }
                if (companyContact.includes('Youtube') && companies[i].youtube && companies[i].youtube != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Youtube'].split('+')[0])
                }
                if (companyContact.includes('Email Address') && companies[i].company_email_address && companies[i].company_email_address != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Email Address'].split('+')[0])
                }
                if (companyContact.includes('Main Line Number') && companies[i].main_line_number && companies[i].main_line_number != '-') {
                    total_score += parseFloat(score_percent['Company Contacts']['Main Line Number'].split('+')[0])
                }

                // if (companies[i].company_name == "24/7 CREATING") {
                //     console.log(companies[i].company_name, total_score)
                // }


                //Frimo
                if (Firmographic.includes('Industry') && companies[i].industry) {
                    f += parseFloat(score_percent['Firmographic']['Industry'].split('+')[0])
                }
                if (Firmographic.includes('Category') && companies[i].category) {
                    f += parseFloat(score_percent['Firmographic']['Category'].split('+')[0])
                }
                if (Firmographic.includes('Products/Services') && companies[i].product_service) {
                    f += parseFloat(score_percent['Firmographic']['Products/Services'].split('+')[0])
                }
                if (Firmographic.includes('Years in Operation') && companies[i].year_in_operation) {
                    f += parseFloat(score_percent['Firmographic']['Years in Operation'].split('+')[0])
                }
                if (Firmographic.includes('Employee Size') && (companies[i].total_personnel != -1) && (companies[i].total_personnel != 0)) {
                    f += parseFloat(score_percent['Firmographic']['Employee Size'].split('+')[0])
                }
                if (Firmographic.includes('HQ Location') && (companies[i].main_hq_location != null) && (companies[i].main_hq_location != '-')) {
                    f += parseFloat(score_percent['Firmographic']['HQ Location'].split('+')[0])
                }

                if (Firmographic.includes('Partners') && companies[i].expertises.length) {
                    let expertises = companies[i].expertises

                    for (let j = 0; j < expertises.length; j++) {
                        let expertise = expertises[j].dataValues
                        if (expertise.type == 'Partners' && expertise.list != '-') {
                            f += parseFloat(score_percent['Firmographic']['Partners'].split('+')[0])
                        }
                    }
                }

                if (Firmographic.includes('Awards') && companies[i].expertises.length) {
                    let expertises = companies[i].expertises
                    for (let j = 0; j < expertises.length; j++) {
                        let expertise = expertises[j].dataValues
                        if (expertise.type == 'Awards & Accolades' && expertise.list != '-') {
                            f += parseFloat(score_percent['Firmographic']['Awards'].split('+')[0])
                        }
                    }
                }

                total_score += f

                // if (companies[i].company_name == "24/7 CREATING") {
                //     console.log(companies[i].company_name, f)
                // }

                //techno
                let assets = JSON.parse(companies[i].asset)
                if (assets) {
                    for (let [categoryKey, categoryValue] of Object.entries(assets)) {
                        for (let [typeKey, typeValue] of Object.entries(categoryValue)) {

                            if (Technographic.includes(typeKey) && technoScoreObj[categoryKey] && technoScoreObj[categoryKey][typeKey]
                                && typeValue.length) {
                                // if (companies[i].company_name == "24/7 CREATING") console.log(typeKey)
                                // total_score += parseFloat(technoScoreObj[categoryKey][typeKey].split('+')[0])
                                t += parseFloat(technoScoreObj[categoryKey][typeKey].split('+')[0])
                            }
                        }

                    }
                }
                // if (companies[i].company_name == "24/7 CREATING") {
                //     console.log(companies[i].company_name, t)
                // }
                total_score += t

                ScoreConfigCalculate.findOne({
                    where: {
                        [Op.and]: {
                            score_config_id: id,
                            score_config_name: list_name,
                            company_name: companies[i].company_name,
                        }
                    }
                }).then(async response => {
                    if (response) {
                        response.update(
                            {
                                score: total_score.toFixed(1)
                            }
                        );
                    } else {
                        await ScoreConfigCalculate.create(
                            {
                                score_config_id: id,
                                score_config_name: list_name,
                                company_name: companies[i].company_name,
                                score: total_score.toFixed(1)
                            }
                        );
                    }
                });
            }
            return true
        }
    }
}


exports.createScoreList = async function (req, res) {

    let { name, created_by, updated_by } = req.body;
    // console.log("name", name)
    // console.log("created_by", name)
    let saveObj = {
        user_id: created_by,
        upper_range: 10,
        lower_range: 0,
        percent: '{"Company Contact":70,"Firmographic":20,"Technographic":10}',
        score: '{"Basic": "-", "Intermediate": "-", "High": "-", "Advance": "-"}',
        score_percent: '{"Technographic":{"percent":{"Advertising":"0.17+default","Analystics":"0.17+default","Ecommerce":"0.17+default","Widgets":"0.17+default","Hosting":"0.17+default","Productivity":"0.17+default"},"child":{"Productivity":{"CRM":"0.03+default","Campaign Management":"0.03+default","Lead Generation":"0.03+default","Product Recommendations":"0.03+default","Feedback Forms and Surveys":"0.03+default","Marketing Automation":"0.03+default"},"Hosting":{"Cloud Hosting":"0.03+default","Cloud PaaS":"0.03+default","Dedicated Hosting":"0.03+default","Business Email Hosting":"0.03+default","Web Hosting Provider Email":"0.03+default","Marketing Platform":"0.03+default"},"Widgets":{"Live Chat":"0.03+default","Login":"0.03+default","Ticketing System":"0.03+default","Bookings":"0.03+default","Social Sharing":"0.03+default","Schedule Management":"0.03+default"},"Ecommerce":{"Non Platform":"0.03+default","Hosted Solution":"0.03+default","Open Source":"0.03+default","Checkout Buttons":"0.03+default","Payments Processor":"0.03+default","Payment Currency":"0.03+default"},"Analystics":{"Application Performance":"0.03+default","Conversion Optimization":"0.03+default","Advertiser Tracking":"0.03+default","Tag Management":"0.03+default","Audience Measurement":"0.03+default","Visitor Count Tracking":"0.03+default"},"Advertising":{"ads txt":"0.03+default","Audience Targeting":"0.03+default","Contextual Advertising":"0.03+default","Dynamic Creative Optimization":"0.03+default","Digital Video Ads":"0.03+default","Retargeting / Remarketing":"0.03+default"}}},"Firmographic":{"Industry":"0.25+default","Category":"0.25+default","Products/Services":"0.25+default","Years in Operation":"0.25+default","Employee Size":"0.25+default","HQ Location":"0.25+default","Partners":"0.25+default","Awards":"0.25+default"},"Company Contacts":{"Company Name":"0.70+default","Country":"0.70+default","Website":"0.70+default","LinkedIn":"0.70+default","Facebook":"0.70+default","Instagram":"0.70+default","Twitter":"0.70+default","Youtube":"0.70+default","Main Line Number":"0.70+default","Email Address":"0.70+default"}}',
        selected_value: '{"Company Contact":["Company Name","Country","Website","LinkedIn","Facebook","Instagram","Twitter","Youtube","Main Line Number","Email Address"],"Firmographic":["Industry","Category","Products/Services","Years in Operation","Employee Size","HQ Location","Partners","Awards"],"Technographic":["Retargeting / Remarketing","Digital Video Ads","Dynamic Creative Optimization","Contextual Advertising","Audience Targeting","ads txt","Visitor Count Tracking","Audience Measurement","Tag Management","Advertiser Tracking","Conversion Optimization","Application Performance","Non Platform","Hosted Solution","Open Source","Checkout Buttons","Payments Processor","Payment Currency","Schedule Management","Social Sharing","Bookings","Ticketing System","Login","Live Chat","Cloud Hosting","Cloud PaaS","Dedicated Hosting","Business Email Hosting","Web Hosting Provider Email","Marketing Platform","Marketing Automation","Feedback Forms and Surveys","Product Recommendations","Lead Generation","Campaign Management","CRM"]}',
        fileName: 'Viet/Thai/Indo Agency List'
    }

    try {
        ScoreList.findOne({
            where: {
                [Op.and]: {
                    score_name: name,
                    created_by: created_by,
                    updated_by: updated_by
                }
            }
        }).then(response => {
            if (response) {
                return res.status(200).json({
                    message: "List was already created!"
                }).catch(error => {
                    console.log("error", error)
                    return res.status(500).json({
                        message: "Fail to create list"
                    });
                });
            } else {
                return ScoreList.create({
                    score_name: name,
                    created_by: created_by,
                    updated_by: updated_by
                }).then(response => {
                    console.log("id", response.id)
                    ScoreConfig.create({
                        list_id: response.id,
                        list_name: response.score_name,
                        ...saveObj
                    }) // setDefaultValue
                    return res.status(200).json({
                        message: "List Created",
                        data: response
                    });
                }).catch(error => {
                    return res.status(500).json({
                        message: "Fail to create list"
                    });
                });
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.calculateScore = async function (req, res) {

    let { config_id } = req.body;
    console.log("config_id", config_id)

    try {
        ScoreConfig.findOne({
            where: {
                [Op.and]: {
                    id: config_id
                }
            }
        }).then(async response => {
            if (response) {
                // let configSetting = response.dataValues
                let { id, list_name, fileName } = response.dataValues
                let score_percent = JSON.parse(response.dataValues.score_percent)
                let { Firmographic, Technographic, ...rest } = JSON.parse(response.dataValues.selected_value)
                let companyContact = rest['Company Contact']
                let technoScoreObj = score_percent['Technographic'].child


                let companies = await CompanyItem.findAll({
                    include: [
                        PersonnelItem, FavouriteCompanyList,
                        {
                            model: Expertise,
                            required: false,
                            on: {
                                'company_name': { [Op.eq]: Sequelize.col('company.company_name') },
                                'dataset': { [Op.eq]: Sequelize.col('company.dataset') }
                            }
                        },
                    ],
                    where: {
                        [Op.and]: {
                            file_name: fileName,
                        }
                    },
                    order: [
                        ['company_name', 'ASC'],
                    ],
                })

                if (companies) {

                    for (let i = 0; i < companies.length; i++) {
                        let total_score = 0.0

                        //Company Contact
                        if (companyContact.includes('Company Name') && companies[i].company_name) {
                            total_score += parseFloat(score_percent['Company Contacts']['Company Name'].split('+')[0])
                        }
                        if (companyContact.includes('Country') && companies[i].dataset) {
                            total_score += parseFloat(score_percent['Company Contacts']['Country'].split('+')[0])
                        }
                        if (companyContact.includes('Website') && companies[i].website) {
                            total_score += parseFloat(score_percent['Company Contacts']['Website'].split('+')[0])
                        }
                        if (companyContact.includes('LinkedIn') && companies[i].linkedIn) {
                            total_score += parseFloat(score_percent['Company Contacts']['LinkedIn'].split('+')[0])
                        }
                        if (companyContact.includes('Facebook') && companies[i].facebook) {
                            total_score += parseFloat(score_percent['Company Contacts']['Facebook'].split('+')[0])
                        }
                        if (companyContact.includes('Twitter') && companies[i].twitter) {
                            total_score += parseFloat(score_percent['Company Contacts']['Twitter'].split('+')[0])
                        }
                        if (companyContact.includes('Instagram') && companies[i].instagram) {
                            total_score += parseFloat(score_percent['Company Contacts']['Instagram'].split('+')[0])
                        }
                        if (companyContact.includes('Youtube') && companies[i].youtube) {
                            total_score += parseFloat(score_percent['Company Contacts']['Youtube'].split('+')[0])
                        }
                        if (companyContact.includes('Email Address') && companies[i].company_email_address) {
                            total_score += parseFloat(score_percent['Company Contacts']['Email Address'].split('+')[0])
                        }
                        if (companyContact.includes('Main Line Number') && companies[i].main_line_number) {
                            total_score += parseFloat(score_percent['Company Contacts']['Main Line Number'].split('+')[0])
                        }

                        console.log(companies[i].company_name, total_score)


                        //Frimo
                        if (Firmographic.includes('Industry') && companies[i].industry) {
                            total_score += parseFloat(score_percent['Firmographic']['Industry'].split('+')[0])
                        }
                        if (Firmographic.includes('Category') && companies[i].category) {
                            total_score += parseFloat(score_percent['Firmographic']['Category'].split('+')[0])
                        }
                        if (Firmographic.includes('Products/Services') && companies[i].product_service) {
                            total_score += parseFloat(score_percent['Firmographic']['Products/Services'].split('+')[0])
                        }
                        if (Firmographic.includes('Years in Operation') && companies[i].year_in_operation) {
                            total_score += parseFloat(score_percent['Firmographic']['Years in Operation'].split('+')[0])
                        }
                        if (Firmographic.includes('Employee Size') && companies[i].total_personnel) {
                            total_score += parseFloat(score_percent['Firmographic']['Employee Size'].split('+')[0])
                        }
                        if (Firmographic.includes('HQ Location') && companies[i].main_hq_location) {
                            total_score += parseFloat(score_percent['Firmographic']['HQ Location'].split('+')[0])
                        }

                        if (Firmographic.includes('Partners') && companies[i].expertises.length) {
                            let expertises = companies[i].expertises

                            for (let j = 0; j < expertises.length; j++) {
                                let expertise = expertises[j].dataValues
                                if (expertise.type == 'Partners' && expertise.list != '-')
                                    total_score += parseFloat(score_percent['Firmographic']['Partners'].split('+')[0])
                            }
                        }

                        if (Firmographic.includes('Awards') && companies[i].expertises.length) {
                            let expertises = companies[i].expertises

                            for (let j = 0; j < expertises.length; j++) {
                                let expertise = expertises[j].dataValues
                                if (expertise.type == 'Awards & Accolades' && expertise.list != '-')
                                    total_score += parseFloat(score_percent['Firmographic']['Awards'].split('+')[0])
                            }
                        }

                        console.log(companies[i].company_name, total_score)

                        //techno
                        let assets = JSON.parse(companies[i].asset)
                        if (assets) {
                            for (let [categoryKey, categoryValue] of Object.entries(assets)) {
                                for (let [typeKey, typeValue] of Object.entries(categoryValue)) {
                                    if (Technographic.includes(typeKey) && technoScoreObj[categoryKey] && technoScoreObj[categoryKey][typeKey]
                                        && typeValue.length) total_score += parseFloat(technoScoreObj[categoryKey][typeKey].split('+')[0])
                                }

                            }
                        }

                        console.log(companies[i].company_name, total_score)

                        ScoreConfigCalculate.findOne({
                            where: {
                                [Op.and]: {
                                    score_config_id: id,
                                    score_config_name: list_name,
                                    company_name: companies[i].company_name,
                                }
                            }
                        }).then(async response => {
                            if (response) {
                                response.update(
                                    {
                                        score: total_score.toFixed(1)
                                    }
                                );
                            } else {
                                await ScoreConfigCalculate.create(
                                    {
                                        score_config_id: id,
                                        score_config_name: list_name,
                                        company_name: companies[i].company_name,
                                        score: total_score.toFixed(1)
                                    }
                                );
                            }
                        });
                    }
                    return res.status(200).json({
                        data: response
                    })
                }
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.setDefaultScoreList = async function (req, res) {

    let { list_id, user_id } = req.body;

    try {

        ScoreList.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        created_by: user_id
                    }
                ]
            }
        }).then(
            response => {
                if (response) response.update({ default: false })
            });

        ScoreList.findOne({
            where: {
                id: list_id
            }
        }).then(response => {
            if (response) {
                response.update({ default: true })
                    .then(response => {

                        return res.status(200).json({
                            message: "Marked as default list"
                        });

                    })
                    .catch(error => {
                        return res.status(500).json({
                            message: "Fail to mark as default list"
                        });
                    });
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.removeDefaultScoreList = async function (req, res) {

    let { user_id } = req.body;

    try {
        ScoreList.findOne({
            where:
            {
                [Op.and]: [
                    {
                        default: true,
                        created_by: user_id
                    }
                ]
            }
        }).then(response => {
            if (response) {
                response.update({ default: false })
                // .then(response => {

                //     return res.status(200).json({
                //         message: "Default list removed"
                //     });

                // })
                // .catch(error => {
                //     console.log("err", error)
                //     return res.status(500).json({
                //         message: "Fail to remove default list"
                //     });
                // });
            }
        });
        return res.status(200).json({
            message: "Default list removed"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getDefaultScoreList = async function (req, res) {

    let { file_name } = req.body;

    try {
        let response = await ScoreList.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        file_name: file_name
                    }
                ]

            }
        })

        return res.status(200).json({
            message: "Default List",
            data: response
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getLatestScoreListId = async function (req, res) {

    try {
        let response = await ScoreList.findAll({
            order: [
                ['id', 'DESC'],
            ],
            attributes: ['id']
        })

        return res.status(200).json({
            message: "Latest id of the list",
            data: response && response.length && response[0].id
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.setDefaultScoreListByLastId = async function (req, res) {

    let { user_id } = req.body;

    try {
        ScoreList.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        created_by: user_id
                    }
                ]
            }
        }).then(
            response => {
                if (response) response.update({ default: false })
            });

        let responseData = await ScoreList.findAll({
            order: [
                ['id', 'DESC'],
            ],
            attributes: ['id']
        }).then(favResp => {
            if (favResp)
                ScoreList.findOne({
                    where: {
                        id: favResp[0].id
                    }
                }).then(record => {
                    if (record) {
                        record.update({ default: true }).then(
                            recordRes => recordRes
                        )
                        // .then(response => {
                        //     console.log("response", response)

                        //     return res.status(200).json({
                        //         message: "Marked as default list",
                        //         data: response
                        //     });

                        // })
                        // .catch(error => {
                        //     console.log("err", error)
                        //     return res.status(500).json({
                        //         message: "Fail to mark as default list"
                        //     });
                        // });
                    }
                });
        })

        return res.status(200).json({
            message: "Marked as default list",
            data: responseData
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getScoreListCount = async function (req, res) {

    let { user_id } = req.params;

    try {
        let totalScoreList = await ScoreList.findAll({
            where: { created_by: user_id },
            order: [
                ['default', 'DESC'],
            ],
        })
        for (let i in totalScoreList) {
            if (!totalScoreList.hasOwnProperty(i)) continue;
            let record = totalScoreList[i].dataValues
            let scoreConfigList = await ScoreConfig.findAll({
                where: {
                    [Op.and]: [
                        {
                            list_id: record.id,
                            list_name: record.score_name,
                            user_id: record.created_by
                        }
                    ]
                },

                // attributes: ["company_name"]
            })
            // let count = await ScoreConfig.count({
            //     where: {
            //         [Op.and]: [
            //             {
            //                 list_id: record.id,
            //                 list_name: record.name,
            //                 user_id: record.created_by
            //             }
            //         ]
            //     }
            // })
            // if (scoreConfigList[0] && scoreConfigList[0].upper_range) { scoreConfigList[0].upper_range = scoreConfigList[0].upper_range && Number.parseFloat(scoreConfigList[0].upper_range).toFixed(1) }
            // if (scoreConfigList[0] && (scoreConfigList[0].lower_range || scoreConfigList[0].lower_range == 0)) scoreConfigList[0].lower_range = scoreConfigList[0].lower_range && Number.parseFloat(scoreConfigList[0].lower_range).toFixed(1)
            totalScoreList[i].dataValues.scoreConfigList = scoreConfigList[0]

        }

        return res.status(200).json({
            message: "List Count",
            mainData: totalScoreList
        });
    }

    catch (error) {
        console.log("error", error)
        return res.status(500).json({ message: error.message });
    }
}

exports.getConfigToScoreListId = async function (req, res) {

    let { id } = req.params.id;

    try {
        let response = await ScoreConfig.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        created_by: id
                    }
                ]

            }
        })

        return res.status(200).json({
            message: "Default List",
            data: response
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.getConfigDataById = async function (req, res) {

    let { configId } = req.params;

    try {
        let scoreConfig = await ScoreConfig.findOne({
            where: { id: configId }
        })

        return res.status(200).json({
            message: "Score Config",
            mainData: scoreConfig
        });
    }

    catch (error) {
        console.log("error", error)
        return res.status(500).json({ message: error.message });
    }
}

exports.addConfigToScoreList = async function (req, res) {
    let saveObj = req.body
    let { user_id, list_name, list_id, fileName } = req.body;
    let { selected_value, upper_range, ...rest } = saveObj

    try {

        ScoreConfig.findOne({
            where: {
                [Op.and]: {
                    user_id: user_id,
                    list_id: list_id,
                }
                // list_name: list_name,
                // list_id: list_id,
            }
        }).then(response => {
            if (response) {
                response.update({ ...saveObj }).then(response => {
                    ScoreList.update({ default: false }, { where: { file_name: fileName, default: true } })
                    ScoreList.update({ file_name: fileName, default: true }, { where: { id: list_id } })
                    // console.log("update response", response)
                    if (calculateCustomScore(response))
                        return res.status(200).json({
                            message: "ScoreList Updated",
                            data: response
                        });
                }).catch(error => {
                    return res.status(500).json({
                        message: "Fail to update"
                    });
                });
            } else {
                return ScoreConfig.create({ ...saveObj }).then(response => {
                    return res.status(200).json({
                        message: "Added to ScoreList",
                        data: response
                    });
                }).catch(error => {
                    console.log("err", error)
                    return res.status(500).json({
                        message: "Fail to add"
                    });
                });
            }
        });



    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.deleteScoreListById = async function (req, res) {

    let { list_id } = req.body;

    try {

        ScoreList.findOne({
            where: {
                [Op.and]: [
                    {
                        id: list_id
                    }
                ]
            }
        }).then(
            response => {
                if (response) response.update({ default: false })
            });

        ScoreList.findOne({
            where: {
                id: list_id
            }
        }).then(response => {
            if (response) {
                response.destroy({ truncate: true })
                    .then(response => {
                        ScoreConfig.findAll({
                            where: {
                                list_id: list_id
                            }
                        }).then(instances => {
                            if (instances) {
                                instances.forEach(function (instance) {
                                    instance.destroy({ truncate: true })
                                        .then(response => {
                                            ScoreConfigCalculate.findAll({
                                                where: {
                                                    score_config_id: list_id
                                                }
                                            }).then(instances => {
                                                if (instances) {
                                                    instances.forEach(function (instance) {
                                                        instance.destroy({ truncate: true })
                                                    });

                                                }
                                            })
                                        });
                                });

                            }
                        })
                        return res.status(200).json({ message: "Successfully delete list" });
                    }).catch(error => {
                        return res.status(500).json({
                            message: "Fail to delete list"
                        });
                    });
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}