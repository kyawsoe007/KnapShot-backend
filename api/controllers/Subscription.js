'use strict';
const md5 = require('md5');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

//models
const Subscription = require('../models/Subscription');
const User = require('../models/User');


exports.Create = (req, res) => {

    Subscription.create(req, { include: [User] })
        .then(response => {
            return res.status(200).json({
                id: response.id,
                message: "Created"
            });
        })
        .catch(error => {
            return res.status(500).json({
                message: error
            });
        });
};

exports.GetAll = async (req, res) => {
    try {
        let data = await Subscription.findAll()
        if (data) {
            return res.status(200).json({
                message: 'Successful', data: data
            });
        }

    } catch (error) {
        return res.status(500).json({
            error: error.message
        });
    }
};

exports.FindById = async (id, res) => {
    try {
        let data = await Subscription.findOne(
            {
                where: {
                    user_id: id
                }
            }
        )
        // if (data) {
        //     return res.status(200).json({
        //         message: 'Successful', data: data
        //     });
        // }
        if (data) return data

    } catch (error) {
        return res.status(500).json({
            error: error.message
        });
    }
};
