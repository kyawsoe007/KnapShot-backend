'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const axios = require('axios');
const XLSX = require('xlsx');
const formidable = require('formidable');

//models
const db = require('../models/db');
const CompanyItem = require('../models/CompanyItem');
const FavouriteList = require('../models/FavouriteList');
const FavouriteCompanyList = require('../models/FavouriteCompanyList');


//config
const config = require('../../config');

const path = require('path')


exports.createList = async function (req, res) {

    let { name, created_by } = req.body;

    try {
        FavouriteList.findOne({
            where: {
                [Op.and]: {
                    name: name,
                    created_by: created_by
                }
            }
        }).then(response => {
            if (response) {
                return res.status(200).json({
                    message: "List was already created!"
                }).catch(error => {
                    return res.status(500).json({
                        message: "Fail to create list"
                    });
                });
            } else {
                return FavouriteList.create({
                    name: name,
                    created_by: created_by,
                }).then(response => {
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

exports.setDefaultFavList = async function (req, res) {

    let { list_id, user_id } = req.body;

    try {

        FavouriteList.findOne({
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

        FavouriteList.findOne({
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

exports.removeDefaultFavList = async function (req, res) {

    let { user_id } = req.body;

    try {
        FavouriteList.findOne({
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

exports.getDefaultFavList = async function (req, res) {

    let { user_id } = req.params;

    try {
        let response = await FavouriteList.findOne({
            where: {
                [Op.and]: [
                    {
                        default: true,
                        created_by: user_id
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

exports.getLatestFavListId = async function (req, res) {

    try {
        let response = await FavouriteList.findAll({
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

exports.setDefaultFavListByLastId = async function (req, res) {

    let { user_id } = req.body;

    try {
        FavouriteList.findOne({
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

        let responseData = await FavouriteList.findAll({
            order: [
                ['id', 'DESC'],
            ],
            attributes: ['id']
        }).then(favResp => {
            if (favResp)
                FavouriteList.findOne({
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

exports.getListCount = async function (req, res) {

    let { user_id } = req.params;

    try {
        let totalResp = {}
        let totalFavList = await FavouriteList.findAll({
            where: { created_by: user_id }
        })
        for (let i in totalFavList) {
            if (!totalFavList.hasOwnProperty(i)) continue;
            let record = totalFavList[i].dataValues
            let favCompList = await FavouriteCompanyList.findAll({
                where: {
                    [Op.and]: [
                        {
                            list_id: record.id,
                            list_name: record.name,
                            user_id: record.created_by
                        }
                    ]
                },
                attributes: ["company_name"]
            })
            // let count = await FavouriteCompanyList.count({
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
            totalFavList[i].dataValues.count = favCompList.length
            totalFavList[i].dataValues.favCompList = favCompList.map(x => x.company_name)
            totalResp[record.name] = favCompList.length

        }

        return res.status(200).json({
            message: "List Count",
            data: totalResp,
            mainData: totalFavList
        });
    }

    catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

exports.addCompanyToFavouriteList = async function (req, res) {

    let { user_id, company_name, list_name, list_id } = req.body;

    try {

        FavouriteCompanyList.findOne({
            where: {
                [Op.and]: {
                    company_name: company_name,
                    user_id: user_id,
                }
                // list_name: list_name,
                // list_id: list_id,
            }
        }).then(response => {
            if (response) {
                response.destroy({ truncate: true })
                    .then(response => {
                        return res.status(200).json({ message: "Successfully Removed" });
                    }).catch(error => {
                        return res.status(500).json({
                            message: "Fail to add"
                        });
                    });
            } else {
                return FavouriteCompanyList.create({
                    company_name: company_name,
                    user_id: user_id,
                    list_name: list_name,
                    list_id: list_id,
                }).then(response => {
                    return res.status(200).json({
                        message: "Added to FavList",
                        data: response
                    });
                }).catch(error => {
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

exports.deleteListById = async function (req, res) {

    let { list_id } = req.body;

    try {

        FavouriteList.findOne({
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

        FavouriteList.findOne({
            where: {
                id: list_id
            }
        }).then(response => {
            if (response) {
                response.destroy({ truncate: true })
                    .then(response => {
                        FavouriteCompanyList.findAll({
                            where: {
                                list_id: list_id
                            }
                        }).then(instances =>{
                            if (instances) {
                                instances.forEach(function (instance) {
                                    instance.destroy({ truncate: true })
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

