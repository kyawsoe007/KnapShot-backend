"use strict";
const Sequelize = require("sequelize");
const endpoints = require("../constants/endpoints");
const key = require("../constants/key.json");
var path = require("path");
const Op = Sequelize.Op;

//models
const Checker = require("../models/Checker");
const Company = require("../models/Company");

// controller
var subscriptionController = require("./Subscription");
const moment = require("moment");
const CompanyItem = require("../models/CompanyItem");

async function getAllAvailableCount(obj) {
  let count = 0;
  for (let value of Object.values(obj)) {
    if (value && value != "-") count++;
  }
  return count;
}

async function getAllMissingField(obj) {
  let fields = [];
  for (const [key, value] of Object.entries(obj)) {
    if (!value || (Array.isArray(value) && value.length == 0)) fields.push(key);
  }
  return fields;
}

async function getTotalCompanyFieldCount(obj) {
  if (obj) return Object.keys(obj).length;
  return 0;
}

async function getTrueCountArr(arr) {
  let count = 0;
  for (let val of arr) if (val) count++;
  return count;
}

async function getTrueCountObj(obj) {
  let count = 0;
  for (let val of Object.values(obj)) if (val) count++;
  return count;
}

function arr_diff(a1, a2) {
  var a = [],
    diff = [];

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
    if (!a.hasOwnProperty(k)) continue;
    diff.push(k);
  }

  return diff;
}

async function getCompanyData(id) {
  let company = await CompanyItem.findOne({ where: { id } });
  let {
    company_name,
    website,
    company_email_address,
    main_line_number,
    facebook,
    twitter,
    linkedIn,
    youtube,
    instagram,
    facebook_follower,
    facebook_like,
    linkedin_follower,
    instagram_follower,
    instagram_post,
    business_type,
    sector,
    city_presence,
    country_presence,
    total_personnel,
    main_hq_location,
    dataset,
    youtube_subscriber,
  } = company;

  let biz_type_array = Object.keys(JSON.parse(business_type));
  let sector_array = sector != null ? Object.keys(JSON.parse(sector)) : [];
  return {
    name: company_name,
    website,
    phno: main_line_number,
    email: company_email_address,
    sector: "",
    biz_type: biz_type_array,
    founded: "",
    emp_size: total_personnel,
    hq_location: main_hq_location,
    facebook_link: facebook,
    facebook_follower,
    facebook_like,
    twitter_link: twitter,
    twitter_follower: "",
    // twitter_like: '',
    linkedin_link: linkedIn,
    linkedin_followers: linkedin_follower,
    instagram_link: instagram,
    instagram_follower,
    instagram_post,
    youtube_link: youtube,
    youlink_follower: youtube_subscriber,
    city: JSON.parse(city_presence),
    country: JSON.parse(country_presence),
  };
}

async function getCompanyDataUpdate(id) {
  let company = await CompanyItem.findOne({ where: { id } });
  let {
    company_name,
    website,
    company_email_address,
    main_line_number,
    facebook,
    twitter,
    linkedIn,
    youtube,
    instagram,
    facebook_follower,
    facebook_like,
    linkedin_follower,
    instagram_follower,
    instagram_post,
    business_type,
    city_presence,
    country_presence,
    total_personnel,
    main_hq_location,
    dataset,
  } = company;

  return {
    name: "",
    website: "",
    phno: "",
    email: "",
    sector: "",
    biz_type: [],
    founded: "",
    emp_size: "",
    hq_location: "",
    facebook_link: "",
    facebook_follower: "",
    facebook_like: "",
    twitter_link: "",
    twitter_follower: "",
    // twitter_like: '',
    linkedin_link: "",
    linkedin_followers: "",
    instagram_link: "",
    instagram_follower: "",
    instagram_post: "",
    youtube_link: "",
    youlink_follower: "",
    city: [],
    country: [],
  };

  return {
    name: company_name,
    website,
    phno: main_line_number,
    email: company_email_address,
    sector: "",
    biz_type: [],
    founded: "",
    emp_size: total_personnel,
    hq_location: main_hq_location,
    facebook_link: facebook,
    facebook_follower: "",
    facebook_like: "",
    twitter_link: twitter,
    twitter_follower: "",
    // twitter_like: '',
    linkedin_link: linkedIn,
    linkedin_followers: "",
    instagram_link: instagram,
    instagram_follower: "",
    instagram_post: "",
    youtube_link: youtube,
    youlink_follower: "",
    city: [],
    country: [],
  };
}

async function getVerifiedDefault(value) {
  if (value)
    return {
      name: 1,
      website: 1,
      phno: 1,
      email: 1,
      sector: 1,
      biz_type: 1,
      founded: 1,
      emp_size: 1,
      hq_location: 1,
      facebook_link: 1,
      facebook_follower: 1,
      facebook_like: 1,
      twitter_link: 1,
      twitter_follower: 1,
      linkedin_link: 1,
      linkedin_followers: 1,
      instagram_link: 1,
      instagram_follower: 1,
      instagram_post: 1,
      youtube_link: 1,
      youlink_follower: 1,
      city: 1,
      country: 1,
    };

  return {
    name: 0,
    website: 0,
    phno: 0,
    email: 0,
    sector: 0,
    biz_type: 0,
    founded: 0,
    emp_size: 0,
    hq_location: 0,
    facebook_link: 0,
    facebook_follower: 0,
    facebook_like: 0,
    twitter_link: 0,
    twitter_follower: 0,
    linkedin_link: 0,
    linkedin_followers: 0,
    instagram_link: 0,
    instagram_follower: 0,
    instagram_post: 0,
    youtube_link: 0,
    youlink_follower: 0,
    city: 0,
    country: 0,
  };
}

exports.Create = async (req, res) => {
  let { companyIds, start_date, end_date, checker_id } = req.body;

  let allDataArr = [],
    totalMissing = 0;

  for (let id of companyIds) {
    let company_data = await getCompanyData(id);
    let company_data_update = await getCompanyDataUpdate(id);
    let missing = await getAllMissingField(company_data);
    let availible = arr_diff(Object.keys(company_data), missing);
    allDataArr.push({
      company_id: id,
      company_data: JSON.stringify(company_data),
      company_data_update: JSON.stringify(company_data_update),
      start_date,
      end_date,
      assign_date: moment().format("YYYY-MM-DD"),
      checker_id,
      verified: JSON.stringify(await getVerifiedDefault()),
      // status: "Unverified",
      missing: JSON.stringify(missing),
      oldMissingCount: missing.length,
      availible: JSON.stringify(availible),
      oldAvailibleCount: availible.length,
      missing_found: JSON.stringify([]),
      missing_correct: JSON.stringify([]),
    });
  }

  return await Checker.bulkCreate(allDataArr)
    .then((response) => {
      return res.status(200).json({
        message: "Checker Created",
        data: response,
      });
    })
    .catch((error) => {
      console.log("fail", error);
      return res.status(500).json({
        message: "Fail to create checker",
      });
    });
};

// exports.GetCheckerByLastAssign = async (req, res) => {
//     let { id } = req.params
//     try {

//         let data = await Checker.findAll(
//             {
//                 where: {
//                     checker_id: id,
//                     assign_date: await Checker.max('assign_date')
//                 },
//             }
//         )

//         if (data) {
//             let { start_date, end_date } = data[0].dataValues
//             let company_data = [], verifiedArr = [], missing = 0, ids = []

//             for (let row of data) {
//                 company_data.push(JSON.parse(row.company_data))
//                 verifiedArr.push(JSON.parse(row.verified))
//                 missing += row.missing
//                 ids.push(row.id)
//             }

//             return res.status(200).json({
//                 message: 'Successful',
//                 // data: data.map(x => {
//                 //     return {
//                 //         company_data: JSON.parse(x.company_data),
//                 //         verified: JSON.parse(x.verified),
//                 //     }
//                 // }),
//                 company_data: data.map(x => JSON.parse(x.company_data)),
//                 verifiedArr,
//                 others: { start_date, end_date },
//                 missing,
//                 ids
//             });
//         }

//     } catch (error) {
//         return res.status(500).json({
//             error: error.message
//         });
//     }
// };

exports.GetCheckerCounts = async (req, res) => {
  let { id } = req.body;

  console.log("id", id);

  let whereFilter = [
    { checker_id: id },
    { assign_date: await Checker.max("assign_date") },
  ];

  try {
    let data = await Checker.findAll({
      where: {
        [Op.and]: whereFilter,
      },
      attributes: ["status"],
    });

    if (data.length) {
      let obj = {};
      for (let row of data) {
        if (!obj[row.status]) obj[row.status] = 0;
        obj[row.status] += 1;
      }

      return res.status(200).json({
        message: "Successful",
        count: obj,
      });
    }

    return res.status(200).json({
      message: "Successful",
      count: {},
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

exports.GetCheckerByLastAssign = async (req, res) => {
  let { id, status, sortFilter } = req.body;
  const page = req.query.page || 1;

  const pageSize = req.query.pageSize || 10;
  console.log("ps", pageSize);
  console.log("p", page);
  let citySelect = {},
    countrySelect = {};
  let orderFilter = [];
  let whereFilter = [
    { checker_id: id },
    { assign_date: await Checker.max("assign_date") },
  ];
  if (status) whereFilter.push({ status });
  if (sortFilter) {
    if (sortFilter === "Alphabetical Order: A-Z")
      orderFilter.push(["company_data", "ASC"]);
    else if (sortFilter === "Alphabetical Order: Z-A")
      orderFilter.push(["company_data", "DESC"]);
    else if (sortFilter === "Ads Exp: Highest first")
      orderFilter.push(["overall_knapshot_score", "DESC"]);
    else if (sortFilter === "Digital Engagement: Highest first")
      orderFilter.push(["overall_knapshot_score", "DESC"]);
    else orderFilter.push(["id", "ASC"]);
  }
  try {
    let data = await Checker.findAll({
      where: {
        [Op.and]: whereFilter,
      },
      order: orderFilter,
    });

    let totalMissing = 0,
      totalVerified = 0,
      totalFields = 0,
      verifiedCompany = 0;

    if (data.length) {
      let { start_date, end_date } = data[0].dataValues;

      for (let row of data) {
        row.company_data = JSON.parse(row.company_data);
        row.company_data_update = JSON.parse(row.company_data_update);
        row.verified = JSON.parse(row.verified);
        // row.verifiedCount = await getTrueCountObj(row.verified)
        row.missing = JSON.parse(row.missing);
        row.availible = JSON.parse(row.availible);
        // row.missingCount = row.missing.length
        totalMissing += row.missing.length;
        totalVerified += await getTrueCountObj(row.verified);
        totalFields += Object.keys(row.company_data).length;
        verifiedCompany += row.verify_status == "verified" ? 1 : 0;
        row.missing_found = JSON.parse(row.missing_found);
        row.missing_correct = JSON.parse(row.missing_correct);

        for (let city of row.company_data.city) {
          if (!citySelect[city]) citySelect[city] = 0;
          citySelect[city] += 1;
        }

        for (let country of row.company_data.country) {
          if (!countrySelect[country]) countrySelect[country] = 0;
          countrySelect[country] += 1;
        }
      }

      // console.log(countrySelect, citySelect)
      // console.log(verifiedCompany);
      // console.log("hi", orderFilter);
      // console.log("data", data);
      return res.status(200).json({
        message: "Successful",
        data: data,
        companies: data.splice((page - 1) * pageSize, pageSize),
        count: page * pageSize + data.length,
        // company_data: data.map(x => JSON.parse(x.company_data)),
        // verifiedArr,
        others: {
          start_date,
          end_date,
          totalMissing,
          totalVerified,
          totalFields,
          verifiedCompany,
          unVerifiedCompany: data.length - verifiedCompany,
          countrySelect: Object.keys(countrySelect),
          citySelect: Object.keys(citySelect),
        },
      });
    }
    return res.status(200).json({
      message: "Successful",
      data: [],
      others: {},
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

exports.Update = async (req, res) => {
  let {
    id,
    company_data,
    status,
    reason,
    verified,
    availible,
    missing,
    company_data_update,
    missing_found,
    missing_correct,
  } = req.body;
  try {
    Checker.findOne({
      where: { id },
    }).then((response) => {
      if (response) {
        response
          .update({
            company_data,
            availible,
            missing,
            verified,
            missing_correct,
            missing_found,
            status,
            reason,
            company_data_update,
          })
          .then((response) => {
            return res.status(200).json({
              message: "Checker Updated",
              data: response,
            });
          })
          .catch((error) => {
            return res.status(500).json({
              message: "Fail to update",
            });
          });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
