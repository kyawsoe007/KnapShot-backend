'use strict';
const md5 = require('md5');
var CryptoJS = require("crypto-js");
const Sequelize = require('sequelize');
const nodemailer = require('nodemailer');
const endpoints = require('../constants/endpoints');
const key = require('../constants/key.json');
var path = require('path');
const Op = Sequelize.Op;

//models
const User = require('../models/User');
const Company = require('../models/Company');

// controller 
var subscriptionController = require('./Subscription');
const moment = require('moment');


exports.SignIn = (req, res) => {


    let email = req.body.email;
    let password = req.body.password;
    let nowDate = moment().format()
    console.log('what', nowDate)
    return User
        .findOne({

            where: {
                email: email,
                password: md5(password),
                status: "ACTIVE"
            }
        })
        .then(response => {
            if (response) {
                if (response.expire_date > nowDate) return res.status(200).json({
                    message: "Successful",
                    user: response
                });
                else return res.status(200).json({
                    message: "Account has been expired",
                });
            }
            else return res.status(200).json({
                message: "Username and password do not match",
            });
        })
        .catch(error => {
            return res.status(500).json({
                message: "Failed To Login"
            });
        });
};

exports.reset = async (req, res) => {


    let email = req.body.email;

    let user = await User.findOne({
        where: {
            email: email
        }
    }).catch(error => {
        return res.status(500).json({
            message: JSON.stringify(error)
        });
    });


    if (user) {
        // const transporter = nodemailer.createTransport({
        //     service: 'gmail',
        //     auth: {
        //         user: 'khantsithu.testing@gmail.com',
        //         pass: 'auth_email_pass'
        //     }
        // })

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'Knapshot.portal@gmail.com',
                pass: '6829067h'
            }
        })

        // const transporter = nodemailer.createTransport({
        //     host: 'smtp.gmail.com',
        //     port: 465,
        //     secure: true,
        //     auth: {
        //         type: 'OAuth2',
        //         user: 'info@knapshot.co',
        //         serviceClient: key.client_id,
        //         privateKey: key.private_key
        //     }
        // })

        var imagePath = path.join(__dirname, '../assets/images/logo.jpg');

        // Encrypt
        var cipherEmailText = CryptoJS.AES.encrypt(email, 'KSEncrypt').toString().replace(/\+/g, 'p1L2u3S').replace(/\//g, 's1L2a3S4h').replace(/=/g, 'e1Q2u3A4l');

        const mailOptions = {
            from: 'Knapshot.portal@gmail.com',
            to: `${email}`,
            subject: `We received a password reset request​`,
            // text: `${data.message}`,
            // replyTo: 'khantsithu.testing@gmail.com',
            html: `<html>
    
            <head>
                <title>Forget Password Email</title>
                <style>
                .btn {
                border: none;
                background-color: orange;
                padding: 14px 28px;
                font-size: 16px;
                cursor: pointer;
                display: inline-block;
                }

                a {text-decoration: none;}

                .default {color: white;}

                .center {
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                  }
                </style>
            </head>
            
            <body>
                <div>
                <img src="cid:unique@kst.ee" class="center" width="60" height="60"/>
                 <h3>Hi ${user.firstname},</h3>
                    <p>Use this link below to set up a new password for your account, This link will expire in 4 hours.</p>
                    <br>
                    <a href="${endpoints.baseUrl}/resetPassword/${cipherEmailText}">
                    <button class="btn default center">Change Password</button>
                    </a>
                    <p>If you did not make this request, you do not need to do anything.</p>
                    <p>Thanks for your time</p>
                    <p>The Knapshot Team</p>
                </div>
               
            </body>
            
            </html>`,
            attachments: [{
                filename: 'logo.jpg',
                path: imagePath,
                cid: 'unique@kst.ee' //same cid value as in the html img src
            }]
        }
        // await transporter.verify()
        transporter.sendMail(mailOptions, function (err, result) {
            if (err) {
                console.error('there was an error: ', err);
                return res.status(400).json({
                    message: JSON.stringify(err)
                });
            } else {
                // console.log('here is the res: ', res)
                return res.status(200).json({
                    message: "Password Reset Link is sent to your email",
                });
            }
        })

    }
    else {
        return res.status(200).json({
            message: "No User is registered to this email"
        });
    }

};

exports.resetPassword = async (req, res) => {

    let emailEncrypted = req.body.email;
    let password = req.body.password;

    // Decrypt
    var bytes = CryptoJS.AES.decrypt(emailEncrypted.replace(/p1L2u3S/g, '+').replace(/s1L2a3S4h/g, '/').replace(/e1Q2u3A4l/g, '='), 'KSEncrypt');
    console.log("bytes", bytes)
    console.log("toString", bytes.toString(CryptoJS.enc.Utf8))
    var decryptedEmailData = bytes.toString(CryptoJS.enc.Utf8);

    console.log("emailPassowrd", decryptedEmailData, password)

    let user = await User.findOne({
        where: {
            email: decryptedEmailData
        }
    })
        .then(resp => {
            if (resp)
                resp.update(
                    {
                        password: md5(password),
                    }
                ).then(updated => {
                    if (updated.id)
                        return res.status(200).json({
                            message: "Password has been reset",
                            data: updated.email
                        });
                    else return res.status(400).json({
                        message: "Password reset failed"
                    });
                })
        })
        .catch(error => {
            return res.status(500).json({
                message: JSON.stringify(error)
            });
        });

};

exports.Create = (req, res) => {
    let { allCheckBox, allTextbox, role, plan, checkedData, filterID, date, ksUser } = req.body

    let password = allTextbox.company_name + "@KSportal123"

    allTextbox.plan_type = plan
    allTextbox.expire_date = date
    allTextbox.password = md5(password)
    // console.log("role",role)
    if (ksUser) {
        User.findOne({
            where: {
                id: filterID
            }
        }).then(response => {
            if (response) {
                return response.update({ ...allTextbox, date })
                    .then(response => {

                        return res.status(200).json({
                            message: "Updated"
                        });

                    })
                    .catch(error => {
                        // console.log('messa',error)
                        return res.status(500).json({
                            message: "Fail to create user",

                        });

                    });
            } else {
                return User.create({ ...allTextbox, role, date })
                    .then(response => {
                        return res.status(200).json({
                            message: "User Created",
                            data: response
                        });
                    })
                    .catch(error => {
                        // console.log('fail',error)
                        return res.status(500).json({
                            message: "Fail to create user"
                        });
                    });
            }
        });
    }

    else {

        allTextbox.coverage = checkedData.toString()

        User.findOne({
            where: {
                id: filterID
            }
        }).then(response => {
            if (response) {
                return response.update({ ...allTextbox, role, date })
                    .then(response => {
                        subscriptionController.FindById(response.id)
                            .then(response => {
                                if (response) {
                                    allCheckBox.user_id = filterID
                                    allCheckBox.plan_type = plan
                                    allCheckBox.expire_date = date
                                    response.update(allCheckBox, res)
                                        .then(response => {
                                            return res.status(200).json({
                                                message: "Updated"
                                            });
                                        }
                                        )
                                }
                            })
                    })
                    .catch(error => {
                        // console.log('hiii',error)
                        return res.status(500).json({
                            message: "Fail to create user"
                        });
                    });
            } else {
                return User.create({ ...allTextbox, role, date })
                    .then(response => {
                        // console.log('response',response)
                        allCheckBox.user_id = response.id
                        allCheckBox.plan_type = plan
                        allCheckBox.role = role
                        allCheckBox.expire_date = date
                        return subscriptionController.Create(allCheckBox, res)

                    })
                    .catch(error => {
                        console.log('war', error)
                        return res.status(500).json({
                            message: "Fail to create user"
                        });
                    });
            }
        });
    }


}

exports.GetAllUserWithCompany = async (req, res) => {
    try {
        let data = await User.findAll(
            {
                include: [
                    {
                        model: Company,
                        as: 'Company',
                    }
                ],
                order: [['id', 'DESC']]
            }
        )
        if (data) {
            // console.log("data",data)
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

exports.GetUserByID = async (req, res) => {
    let id = req.params.id
    try {
        let data = await User.findOne(
            {
                where: {
                    id: id
                }
            }
        )
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

exports.UserDelete = async (req, res) => {
    const { idArr } = req.body
    try {
        let data = User.findAll({
            where: {
                [Op.and]: [
                    { id: idArr }
                ]
            }
        }).then(response => {
            if (response) {
                response.map(x => x.update({ status: 'DELETE' }));
            }
        });
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
}

exports.UserConfirm = async (req, res) => {
    const { idArr } = req.body
    const { confirmArr } = req.body

    try {
        let data = User.findAll({
            where: {
                [Op.and]: [
                    { id: idArr }
                    // { id: confirmArr }
                ]
            }
        }).then(response => {
            if (response) {
                response.map(async x => {
                    if (x) {
                        let password = x.company_name + "@KSportal123"
                        // const transporter = nodemailer.createTransport({
                        //     service: 'gmail',
                        //     auth: {
                        //         user: 'khantsithu.testing@gmail.com',
                        //         pass: 'auth_email_pass'
                        //     }
                        // })

                        const transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: 'Knapshot.portal@gmail.com',
                                pass: '6829067h'
                            }
                        })



                        // const transporter = nodemailer.createTransport({
                        //     host: 'smtp.gmail.com',
                        //     port: 465,
                        //     secure: true,
                        //     auth: {
                        //         type: 'OAuth2',
                        //         user: 'wecare@knapshot.co',
                        //         serviceClient: key.client_id,
                        //         privateKey: key.private_key
                        //     }
                        // })

                        var imagePath = path.join(__dirname, '../assets/images/logo.jpg');

                        // Encrypt
                        // var cipherEmailText = CryptoJS.AES.encrypt(email, 'KSEncrypt').toString().replace(/\+/g, 'p1L2u3S').replace(/\//g, 's1L2a3S4h').replace(/=/g, 'e1Q2u3A4l');

                        const mailOptions = {
                            from: 'Knapshot.portal@gmail.com',
                            to: `${x.email}`,
                            subject: `KnapShot User Account Created`,
                            html: `<html>
                            expire_date\
                            <head>
                                <title>User Account Created</title>
                                <style>
                                .btn {
                                border: none;
                                background-color: orange;
                                padding: 14px 28px;
                                font-size: 16px;
                                cursor: pointer;
                                display: inline-block;
                                }
                
                                a {text-decoration: none;}
                
                                .default {color: white;}
                
                                .center {
                                    display: block;
                                    margin-left: auto;
                                    margin-right: auto;
                                  }
                                </style>
                            </head>
                            
                            <body>
                                <div>expire_date\
                                <img src="cid:unique@kst.ee" class="center" width="60" height="60"/>
                                 <h3>Hi ${x.firstname},</h3>
                                    <p>Use this link below to login your account</p>
                                    <br>
                                    <p>Password is ${password}</p>
                                    <a href="${endpoints.baseUrl}/login/${x.email}">
                                    <button class="btn default center">Login</button>
                                    </a>
                                    <p>The Knapshot Team</p>
                                </div>
                               
                            </body>
                            
                            </html>`,
                            attachments: [{
                                filename: 'logo.jpg',
                                path: imagePath,
                                cid: 'unique@kst.ee' //same cid value as in the html img src
                            }]
                        }
                        await transporter.verify()
                        transporter.sendMail(mailOptions, function (err, result) {
                            if (err) {
                                console.error('there was an error: ', err);
                                // return res.status(400).json({
                                //     message: JSON.stringify(err)
                                // });
                            } else {
                                // console.log('here is the res: ', res)
                                // return res.status(200).json({
                                //     message: "Password Reset Link is sent to your email",
                                // });
                            }
                        })

                    }
                    x.update({ confirmed: true })
                });
            }
        });
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
}

exports.GetUserEmail = async (req, res) => {
    try {

        let data = await User.findAll({
            where: {
                status: 'ACTIVE'
            },
            attributes: ['email']
        }).then(response => response.map(x => x.email))

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
}
