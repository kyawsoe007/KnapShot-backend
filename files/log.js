'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const axios = require('axios');
const XLSX = require('xlsx');

//models
const db = require('../models/db');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');

//util
const paginate = require('../utils/pagination');

//config
const config = require('../../config');

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

exports.getAll = (req, res) => {

    const page = req.query.page || 1;

    const pageSize = req.query.pageSize || 10;

    const file_name = req.body.file_name;

    const dataset = req.body.dataset;

    let whereFiler = [{ dataset }];

    if (file_name !== "Master DB (Golden Source)") whereFiler.push({ file_name });

    return Promise
        .all([
            Company.count({
                where: {
                    [Op.and]: whereFiler
                }
            }),
            Company.findAll({
                where: {
                    [Op.and]: whereFiler
                },
                ...paginate(page, pageSize)
            })
        ])
        .then(response => {
            return res.status(200).json({
                message: "Successful",
                count: response[0],
                companies: response[1],
                nextPage: page + 1
            });
        })
        .catch(error => {
            return res.status(500).json({
                message: error.message
            });
        });
};

exports.getCompanyByName = (req, res) => {

    const company_name = req.params.id;

    Company
        .find({
            where: {
                company_name: company_name,
            },
            include: [{ model: Personnel }]
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
        CompanyItem.bulkCreate(items).then((response) => {
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
    Company.findAll({
        where: {
            [Op.and]: [
                {
                    latitude: {
                        [Op.ne]: null
                    }
                },
                {
                    longitude: {
                        [Op.ne]: null
                    }
                }
            ]
        },
        attributes: ["company_name", "industry", "total_personnel", "address", "main_line_number", "website", "company_email_address", "facebook", "linkedIn", "twitter", "instagram", "overall_knapshot_score", "latitude", "longitude", "id", "dataset"]
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

    let results = ["Master DB (Golden Source)"];

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

exports.updateScore = async function (req, res) {
    try {
        const companies = await Company.findAll();

        if (companies) {
            for (let i = 0; i < companies.length; i++) {

                let total = 0.0;

                if (companies[i].website !== "" && companies[i].website !== null && companies[i].website !== "cannot verify") {
                    total += 1.2;
                }
                if (companies[i].linkedIn !== "" && companies[i].linkedIn !== null && companies[i].linkedIn !== "cannot verify") {
                    total += 0.2;
                }
                if (companies[i].facebook !== "" && companies[i].facebook !== null && companies[i].facebook !== "cannot verify") {
                    total += 0.2;
                }
                if (companies[i].twitter !== "" && companies[i].twitter !== null && companies[i].twitter !== "cannot verify") {
                    total += 0.1;
                }
                if (companies[i].instagram !== "" && companies[i].instagram !== null && companies[i].instagram !== "cannot verify") {
                    total += 0.1;
                }
                if (companies[i].company_email_address !== "" && companies[i].company_email_address !== null && companies[i].company_email_address !== "cannot verify") {
                    let mail = companies[i].company_email_address.split('@')[1];
                    if (mail === 'gmail.com' || mail === 'yahoo.com') {
                        total += 0.2;
                    } else {
                        total += 0.4;
                    }
                }
                if (companies[i].no_of_directory_presence !== "" && companies[i].no_of_directory_presence !== null && companies[i].no_of_directory_presence !== "cannot verify") {
                    if (companies[i].no_of_directory_presence <= 2) total += 0.2;
                    if (companies[i].no_of_directory_presence >= 3) total += 0.4;
                }
                if (companies[i].address !== "" && companies[i].address !== null && companies[i].address !== "cannot verify") {
                    total += 0.2;
                }
                if (companies[i].main_line_number !== "" && companies[i].main_line_number !== null && companies[i].main_line_number !== "cannot verify" && companies[i].main_line_number !== "+normal") {
                    total += 0.2;
                }
                if (companies[i].asset && companies[i].asset !== null) {
                    let assets = JSON.parse(companies[i].asset);
                    if (assets["Advertising"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Advertising"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }
                    if (assets["Analytics and Tracking"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Analytics and Tracking"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }
                    if (assets["Ecommerce"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Ecommerce"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }
                    if (assets["Payment"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Payment"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 1.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }
                    if (assets["Widgets"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Widgets"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 0.6) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }
                    if (assets["Content Management System"] !== undefined) {
                        let len = 0;
                        Object.values(assets["Content Management System"]).map(a => {
                            if (a && typeof a === "object" && a.length > 0) {
                                a.map(b => {
                                    if (len < 0.4) {
                                        len += 0.1
                                    }
                                })
                            }
                        })
                        total += len;
                    }

                }

                await Company.update(
                    {
                        overall_knapshot_score: total
                    },
                    {
                        where: {
                            id: companies[i].id
                        }
                    }
                );
            }
        }
        return res.status(200).json({ message: "OK" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}