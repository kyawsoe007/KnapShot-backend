"use strict";
const sequelize = require("sequelize");
const Op = sequelize.Op;
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");
const Excel = require("exceljs");
const CompanyItem = require("../models/CompanyItem");
const Expertise = require("../models/Expertise");
const { SurveyResponse, Joint } = require("../models/SurveyResponse");
const Survey = require("../models/Survey");
const Client = require("../models/Client");
const Directory = require("../models/Directory");
const PersonnelItem = require("../models/PersonnelItem");
const db = require("../models/db");

const queryInterface = db.getQueryInterface();

//constants
const keyValues = require("../constants/keyValuesPair");
const typeToCate = require("../constants/typeToCate");
const {
  companyFieldMapping,
  companyContact,
  companyInfo,
  sector,
  tableColumnMap,
  arrDataType,
  biz_type,
} = require("../constants/companyUploadMapping");

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
    diff.push(k);
  }

  return diff;
}

const addColumn = function (tableName, columnName) {
  queryInterface.addColumn(tableName, columnName, { type: sequelize.STRING });
  // .then(res => console.log("column added", res));
};

const addColumnIfNotExist = async function (tableName, columnName) {
  await queryInterface
    .describeTable(tableName)
    .then(async (tableDefinition) => {
      if (!tableDefinition[columnName]) {
        console.log(columnName, "created");
        return await queryInterface.addColumn(tableName, columnName, {
          type: sequelize.STRING,
        });
      }
      console.log(columnName, "already exist");
      return Promise.resolve(true);
    });
};

const checkFieldInDB = async function (tableName, field) {
  let tempField;
  if (Array.isArray(field)) {
    let a = await queryInterface
      .describeTable(tableName)
      .then(async (tableDefinition) => {
        return Object.keys(tableDefinition);
      });
    // console.log("a", a)
    return arr_diff(a, field);
  } else
    await queryInterface
      .describeTable(tableName)
      .then(async (tableDefinition) => {
        if (!tableDefinition[field]) {
          // console.log(field, "false")
          return Promise.resolve(true);
        }
        // console.log(field, "in db")
        tempField = field;
        return Promise.resolve(true);
      });
  return tempField;
};

const camel_to_snake = (str) =>
  str.replace(/\s/gm, "")[0].toLowerCase() +
  str
    .replace(/\s/gm, "")
    .slice(1, str.length)
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

let myString = function (arr) {
  let str = "";
  for (let letter of arr) str += `"${letter}",`;
  return str.slice(0, -1);
};

const { fromPairs } = require("lodash");

const StoreCompany = function (company) {
  return new Promise(function (resolve, reject) {
    try {
      if (
        company["company_name"] !== null &&
        company["company_name"] !== undefined &&
        company["source"] !== undefined &&
        company["source"] !== null
      ) {
        let companyObj = {};
        for (let key in company) {
          if (company[key] !== undefined && company[key] !== null) {
            companyObj[key] = company[key];
          }
        }

        // CompanyItem.findOne(
        //     {
        //         where: {
        //             [Op.and]: [
        //                 { company_name: company["company_name"] },
        //                 { website: company["website"] }
        //             ]
        //         }
        //     }
        // ).then(response => {
        //     if (response) {
        //         return response.updateAttributes(companyObj);
        //     }
        // });
        CompanyItem.findOne({
          where: {
            [Op.and]: [
              { company_name: companyObj["company_name"] },
              { source: companyObj["source"] },
              { dataset: companyObj["dataset"] },
            ],
          },
        }).then((response) => {
          console.log("response", response);
          // if (response) {
          //     return response.update(companyObj);
          // } else {
          //     return CompanyItem.create(companyObj);
          // }
        });
      }
    } catch (error) {
      console.log("efr", error);
      resolve(true);
    }
  });
};

exports.importCompanies = async function (req, res) {
  try {
    const formData = new formidable.IncomingForm();
    formData.parse(req, async (err, fields, files) => {
      if (err || !files.file) {
        return res.status(500).json({
          meta: {
            success: false,
            message: err.message,
          },
        });
      }

      let wb = XLSX.read(files.file.path, {
        type: "file",
      });

      /* Get first worksheet */
      let wsname = wb.SheetNames[0];
      let ws = wb.Sheets[wsname];
      /* Convert array of arrays */
      let data = XLSX.utils.sheet_to_json(ws, { header: "1", defval: "" });
      res.json({
        meta: {
          success: true,
          message: "Data is processing",
        },
      });
      //let datas = [data[0]]
      await Promise.all([...data.map(StoreCompany)]);
    });
  } catch (error) {
    return res.status(500).json({
      meta: {
        success: false,
        message: error.message,
      },
    });
  }
};

exports.downloadSampleCompany = async function (req, res) {
  try {
    let path = `./analyze_files/sample_company.xlsx`;
    return res.download(path);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.downloadSamplePersonnel = async function (req, res) {
  try {
    let path = `./analyze_files/sample_company.xlsx`;
    return res.download(path);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function getBrandData(data, category, type) {
  if (data[category] && data[category][type]) return data[category][type];
  return "-";
}

exports.uploadTechno = function (req, res) {
  var form = new formidable.IncomingForm();
  // console.log("form", form)
  form.parse(req, function (err, fields, files) {
    try {
      const filename = files.file.name;
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }

          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws, {
            header: 1,
          });
          if (data.length === 0) {
            throw "No Data";
          }

          let obj = {};

          data.forEach(function (row) {
            if (row.length >= 4) {
              let website = row[0];
              let company_name = row[1];

              if (obj[website] === undefined) {
                obj[website] = {
                  company_name,
                  website,
                  asset: {},
                  technology_spending: 0,
                };
              }

              if (row[2] === "TechnologySpending") {
                obj[website].technology_spending = row[3];
              }

              if (row[2] === "asset") {
                let asset_name = row[3] ? row[3] : null;
                let asset_category = row[4] ? row[4] : null;
                let asset_value = row[5] ? row[5] : null;

                if (
                  asset_name &&
                  obj[website]["asset"][asset_name] === undefined
                ) {
                  obj[website]["asset"][asset_name] = {
                    [asset_category]: [asset_value],
                  };
                } else {
                  if (
                    asset_name &&
                    obj[website]["asset"][asset_name][asset_category] ===
                      undefined
                  ) {
                    obj[website]["asset"][asset_name][asset_category] = [
                      asset_value,
                    ];
                  } else {
                    obj[website]["asset"][asset_name][asset_category].push(
                      asset_value
                    );
                  }
                }
              }
            }
          });

          let technoData = [];
          Object.values(obj).map((x) => {
            let total = {};

            let assets = x.asset;

            if (assets)
              for (var category in assets) {
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

                    total[category][type].push(brand);
                  }
                }
              }

            let assetTechno = {}; //, assetInfo = {}
            Object.keys(keyValues).forEach(function (category) {
              let typeObj = {};
              keyValues[category].forEach((type) => {
                // console.log(x.company_name,category,"->",type,"-",getBrandData(total, category, type).length)
                assetTechno["company_name"] = x.company_name;
                assetTechno["website"] = x.website;
                if (!assetTechno[category]) assetTechno[category] = [];
                if (!typeObj[type]) typeObj[type];
                typeObj[type] = getBrandData(total, category, type).length;
                // if (!assetTechno[category]) assetTechno[category] = []
                // assetTechno[category].push({ [type] :getBrandData(total, category, type).length})
              });
              assetTechno[category].push(typeObj);
            });

            technoData.push(assetTechno);
          });

          let technoCount = {};
          technoData.map((x) => {
            for (let [key, value] of Object.entries(x)) {
              if (key === "company_name" || key === "website") {
                if (!technoCount[key]) technoCount[key] = 0;
                technoCount[key]++;
              } else {
                if (!technoCount[key]) technoCount[key];
                technoCount[key] = "";
                for (let [k, v] of Object.entries(value)) {
                  for (let [k1, v1] of Object.entries(v)) {
                    // console.log(key)
                    if (!technoCount[k1]) technoCount[k1] = 0;
                    technoCount[k1] += v1;
                  }
                }
              }
            }
          });

          return res.json({
            meta: {
              code: 200,
              success: true,
              message: "Successfully read technology data",
            },
            technoCount: technoCount,
            obj: obj,
            filename: filename,
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.uploadTechnoExcel = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        ExpertiseData = [],
        ClientData = [];
      let filename = files.file.name;

      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        // console.log("worksheet", worksheet)
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values.map((val) => RichTextRemover(val)));
        });
      });

      // for (let i = 3; i < readData[0].length; i++) {
      //     let a = readData[0][i].toLowerCase()
      //     console.log(readData[0][i], " => ", typeToCate[readData[0][i]])
      //     // console.log(readData[0][i], " => ",  typeToCate[readData[0][i]].toLowerCase() )
      // }

      let obj = {};
      for (let row = 1; row < readData.length; row++) {
        let company_name = readData[row][1];
        let website = readData[row][2];
        // let technology_spending = readData[row][3]

        if (obj[website] === undefined) {
          obj[website] = {
            company_name,
            website,
            asset: {},
            // technology_spending
          };
        }

        let tempAssetObj = {};

        for (let i = 3; i < readData[row].length; i++) {
          let categoryVal = typeToCate[readData[0][i]]
            ? typeToCate[readData[0][i]]
            : null;
          let typeVal = readData[0][i] ? readData[0][i] : null;
          let brandVal = readData[row][i] ? readData[row][i] : null;

          // if (company_name == "2359 MEDIA (INDO)") {
          //     console.log(categoryVal, typeVal, brandVal)
          // }

          // if (brandVal) {
          //     if (categoryVal && obj[website]["asset"][categoryVal] === undefined) {
          //         obj[website]["asset"][categoryVal] = {
          //             [typeVal]: [brandVal]
          //         }
          //     } else if (categoryVal) {
          //         if (obj[website]["asset"][categoryVal][typeVal] === undefined) {
          //             obj[website]["asset"][categoryVal][typeVal] = [brandVal];
          //         } else {
          //             obj[website]["asset"][categoryVal][typeVal].push(brandVal);
          //         }
          //     }
          // }

          if (categoryVal && typeVal && brandVal) {
            if (!tempAssetObj[categoryVal]) tempAssetObj[categoryVal] = {};
            if (!tempAssetObj[categoryVal][typeVal])
              tempAssetObj[categoryVal][typeVal] = [];
            let tempBrandArr = brandVal.split(",");
            tempAssetObj[categoryVal][typeVal] = tempBrandArr;
          }
        }

        // if (company_name == "2359 MEDIA (INDO)") {
        //     console.log("tempAssetObj", tempAssetObj)
        // }

        obj[website].asset = tempAssetObj;

        // let asset_name = RichTextRemover(readData[row][4]) ? RichTextRemover(readData[row][4]) : null;
        // let asset_category = RichTextRemover(readData[row][5]) ? RichTextRemover(readData[row][5]) : null;
        // let asset_value = RichTextRemover(readData[row][6]) ? RichTextRemover(readData[row][6]) : null;

        // if (asset_name && obj[website]["asset"][asset_name] === undefined) {
        //     obj[website]["asset"][asset_name] = {
        //         [asset_category]: [asset_value]
        //     }
        // } else {
        //     if (asset_name && obj[website]["asset"][asset_name][asset_category] === undefined) {
        //         obj[website]["asset"][asset_name][asset_category] = [asset_value];
        //     } else {
        //         obj[website]["asset"][asset_name][asset_category].push(asset_value);
        //     }
        // }
      }

      let technoData = [];
      // console.log("obj", obj)
      Object.values(obj).map((x) => {
        let total = {};

        let assets = x.asset;

        if (assets)
          for (var category in assets) {
            // console.log(assets)
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

                total[category][type].push(brand);
              }
            }
          }

        let assetTechno = {}; //, assetInfo = {}
        Object.keys(keyValues).forEach(function (category) {
          let typeObj = {};
          keyValues[category].forEach((type) => {
            // console.log(type)
            // console.log(x.company_name,category,"->",type,"-",getBrandData(total, category, type).length)
            assetTechno["company_name"] = x.company_name;
            assetTechno["website"] = x.website;
            if (!assetTechno[category]) assetTechno[category] = [];
            if (!typeObj[type]) typeObj[type];
            typeObj[type] = getBrandData(total, category, type).length;
            // console.log(typeObj[type])
            // if (!assetTechno[category]) assetTechno[category] = []
            // assetTechno[category].push({ [type] :getBrandData(total, category, type).length})
          });
          assetTechno[category].push(typeObj);
        });

        technoData.push(assetTechno);
      });

      let technoCount = {};
      technoData.map((x) => {
        // console.log(technoData)
        for (let [key, value] of Object.entries(x)) {
          if (key === "company_name" || key === "website") {
            if (!technoCount[key]) technoCount[key] = 0;
            technoCount[key]++;
          } else {
            if (!technoCount[key]) technoCount[key];
            technoCount[key] = "";
            for (let [k, v] of Object.entries(value)) {
              for (let [k1, v1] of Object.entries(v)) {
                // console.log(key)
                if (!technoCount[k1]) technoCount[k1] = 0;
                technoCount[k1] += v1;
              }
            }
          }
        }
      });

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read techno excel file",
        },
        technoData: technoData,
        technoCount: technoCount,
        obj: obj,
        filename: filename,
      });
    } catch (error) {
      console.log("error", error);
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: error.message,
        },
      });
    }
  });
};

exports.importTechnology = async function (req, res) {
  let obj = req.body.technoData;
  try {
    // Object.values(obj).map(async (a) => {
    for (let a of Object.values(obj)) {
      await CompanyItem.update(
        {
          asset: JSON.stringify(a.asset),
          spending: a.technology_spending,
        },
        {
          where: {
            // company_name: {
            //     [Op.like]: a.company_name
            // }
            [Op.or]: [
              {
                // company_name: {
                //     [Op.like]: a.company_name
                // }
                company_name: a.company_name,
              },
              {
                // website: {
                //     [Op.like]: a.website
                // }
                website: a.website,
              },
            ],
          },
        }
      );
    }
    // });

    return res.json({
      meta: {
        code: 200,
        success: true,
        message: "Technology uploaded successfully",
        obj: obj,
      },
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadGoogleIndonesiaCompanies = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    try {
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }
          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws, {
            header: 1,
          });
          if (data.length === 0) {
            throw "No Data";
          }

          let results = [];

          data.forEach(function (row) {
            let company = {};
            company.company_name = row[0];
            company.description = row[1];
            company.dataset = row[2];
            company.address = row[3];
            company.industry = row[4];
            company.company_email_address = row[5];
            company.main_line_number = row[6];
            company.organization_type = row[7];
            company.year_of_operation = row[8];
            company.main_hq_location = row[9];
            company.total_personnel = row[10];
            company.website = row[11];
            company.facebook = row[12];
            company.twitter = row[13];
            company.linkedIn = row[14];
            company.product_service = row[15];
            //    company.revenue_size = row[16];
            company.file_name = row[17];
            company.searchable = null;
            company.overall_knapshot_score = -1;
            company.searchability_score = -1;
            company.activity_score = -1;
            company.consistency_score = -1;
            company.company_status = null;
            company.has_funding = null;
            company.business_type = "cannot verify";
            company.industry_second_level = "cannot verify";
            company.industry_third_level = "cannot verify";
            company.year_in_operation = null;
            company.total_offices_region = -1;
            company.total_offices_cop = -1;
            company.management = -1;
            company.staff = -1;
            company.no_of_directory_presence = -1;
            company.digital_presence_analysis = null;
            company.fax = null;
            company.agency_status = null;
            company.instagram = null;
            company.data_quality = null;
            company.partners = null;
            company.asset = "{}";
            company.client_industries = null;
            company.spending = null;
            results.push(company);
          });

          results.map((data) => {
            //   CompanyItem.create(data);
          });

          return res.json({
            meta: {
              code: 200,
              success: true,
              message: "Uploaded successfully",
            },
            data: results,
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.uploadCompanies = function (req, res) {
  var form = new formidable.IncomingForm();
  let updatedCompanies = [];
  form.parse(req, function (err, fields, files) {
    try {
      var filename = files.file.name;
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }
          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws, {
            header: 1,
          });
          if (data.length === 0) {
            throw "No Data";
          }

          let companyObj = {},
            dataCount = {};

          for (let i = 0; i < data.length; i++) {
            let company_name = data[i][0];
            let key = convertCamelToSnakeCase(data[i][1]);
            let value = data[i][2];

            if (companyObj[company_name] === undefined)
              companyObj[company_name] = {};

            if (key === "social") {
              let socialKey = convertCamelToSnakeCase(data[i][2]);
              let socialValue = data[i][3];
              if (socialKey === "linkedin") socialKey = "linkedIn";
              companyObj[company_name][socialKey] = socialValue;

              if (!dataCount[socialKey]) dataCount[socialKey] = 0;
              dataCount[socialKey]++;
            } else {
              companyObj[company_name]["company_name"] = company_name;
              companyObj[company_name][key] = value;

              if (!dataCount[key]) dataCount[key] = 0;
              dataCount[key]++;
            }
          }

          let results = Object.values(companyObj);
          results.map((x) => updatedCompanies.push(x.company_name));

          // for (let j = 0; j < results.length; j++) {
          //     CompanyItem.findOne({
          //         where: {
          //             [Op.and]: [
          //                 { company_name: results[j]["company_name"] },
          //                 { source: results[j]["source"] ? results[j]["source"] : null }
          //             ]
          //         }
          //     }).then(response => {
          //         if (response) {
          //             return response.updateAttributes(results[j]);
          //         } else {
          //             return CompanyItem.create(results[j]);
          //         }
          //     });
          // }

          return res.json({
            meta: {
              code: 200,
              success: true,
              message: "Uploaded successfully",
            },
            updatedCompanies: updatedCompanies,
            data: Object.values(companyObj),
            dataCount: dataCount,
            filename: filename,
            fields: Object.keys(dataCount).length,
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

function convertCamelToSnakeCase(text) {
  return text
    .replace(/(?:^|\.?)([A-Z])/g, function (x, y) {
      return "_" + y.toLowerCase();
    })
    .replace(/^_/, "");
}

function SurveyResponseCreateOrUpdate(key, data, subKeys) {
  let responseData = [];
  for (let j = 3; j < data.length; j++) {
    if (!key.includes("R")) {
      responseData.push({
        response_identifier: null,
        question_identifier: key,
        value: data[j][key],
        unique_identifier: data[j]["Questions Numbering"],
        label: data[2][key],
      });
    } else {
      for (let [qi, riArr] of Object.entries(subKeys)) {
        if (riArr.includes(key))
          responseData.push({
            response_identifier: key,
            question_identifier: qi,
            value: data[j][key],
            label: data[2][key],
            unique_identifier: data[j]["Questions Numbering"],
          });
      }
    }
  }

  return responseData;
}

exports.uploadQuestionResp = async function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        async function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }
          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          // /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws);
          if (data.length === 0) {
            throw "No Data";
          }

          let keys = Object.keys(data[0]);
          let type = Object.values(data[1]);
          delete data[0]["Selection"];
          delete data[1]["Multiple Choice Given"];
          delete data[2]["Questions Numbering"];

          let question = Object.values(data[2]);
          let count = [];
          let typeArr = {};
          let test = {};
          for (let [key, value] of Object.entries(data[2])) {
            test[key] = value.toString();
          }

          for (let [key, value] of Object.entries(data[1])) {
            typeArr[key] = value.toString().split("\n");
          }

          for (let key of Object.keys(typeArr)) {
            let total = {};
            for (let j = 3; j < data.length; j++) {
              if (!total[key]) total[key] = {};
              if (!total[key][data[j][key]]) total[key][data[j][key]] = 0;
              // if(data[j][key]) console.log("total[key][data[j][key]]",[data[j][key]])
              if (data[j][key]) total[key][data[j][key]]++;
            }
            if (!count[key]) count[key] = [];
            count.push(total);
          }

          let categorized = {};
          for (let [key, value] of Object.entries(data[0])) {
            // if(value === "Choose multiple")
            if (!categorized[value]) categorized[value] = [];
            categorized[value].push(key);
          }

          let subKeys = {};
          let totalSubKeys = {};
          for (let ques of categorized["Choose multiple"]) {
            for (let key of Object.keys(data[2])) {
              if (key.includes(ques.replace("Q", "R").replace("S", "R-S"))) {
                if (!subKeys[ques]) subKeys[ques] = [];
                subKeys[ques].push(key);
              }
            }
          }
          for (let [key, value] of Object.entries(categorized)) {
            if (key === "Selection" || key === "Choose one") continue;
            for (let ques of value) {
              for (let key of Object.keys(data[2])) {
                if (key.includes(ques.replace("Q", "R").replace("S", "R-S"))) {
                  if (!totalSubKeys[ques]) totalSubKeys[ques] = [];
                  totalSubKeys[ques].push(key);
                }
              }
            }
          }

          let QI = [],
            insert = [];
          // let created_id

          let responseData = [];

          let promiseChain = Promise.resolve();
          for (let key of Object.keys(data[2])) {
            const makeNextPromise = (key) => async () => {
              await Survey.findOne({
                where: {
                  [Op.and]: [
                    { excel_file_name: fields.name },
                    { question_identifier: key },
                  ],
                },
                include: [
                  {
                    model: SurveyResponse,
                    as: "survey_responses",
                  },
                ],
              }).then((response) => {
                if (response) {
                  // console.log("Update function",JSON.stringify(SurveyResponseCreateOrUpdate(key, data, totalSubKeys)))
                  // var surveyResponseIds = response.survey_responses.map((x)=>x.dataValues.id);
                  Survey.destroy({ where: { id: response.dataValues.id } });

                  Survey.create(
                    {
                      excel_file_name: fields.name,
                      question_identifier: key,
                      question_type: key.charAt(0),
                      question: data[2][key],
                      selection_type: data[0][key],
                      responses: JSON.stringify(typeArr[key]),
                      survey_responses: SurveyResponseCreateOrUpdate(
                        key,
                        data,
                        totalSubKeys
                      ),
                    },

                    {
                      include: [
                        {
                          association: Joint,
                          as: "survey_responses",
                        },
                      ],
                    }
                  );
                } else {
                  Survey.create(
                    {
                      excel_file_name: fields.name,
                      question_identifier: key,
                      question_type: key.charAt(0),
                      question: data[2][key],
                      selection_type: data[0][key],
                      responses: JSON.stringify(typeArr[key]),
                      survey_responses: SurveyResponseCreateOrUpdate(
                        key,
                        data,
                        totalSubKeys
                      ),
                    },

                    {
                      include: [
                        {
                          association: Joint,
                          as: "survey_responses",
                        },
                      ],
                    }
                  );
                }
              });
            };
            promiseChain = promiseChain.then(makeNextPromise(key));
          }

          Promise.all([promiseChain]).then(() => {
            return res.json({
              meta: {
                code: 200,
                success: true,
                message: "Uploaded successfully",
              },
              results: data,
              count: count,
              keys: keys,
              typeArr: typeArr,
              question: data[2],
              type: type,
              categorized: categorized,
              kst: Object.values(data[0]),
              subKeys: subKeys,
              QI: QI,
              data: insert,
              responseData: responseData,
              totalSubKeys: totalSubKeys,
            });
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.uploadExpertise = function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    try {
      const filename = files.file.name;
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }

          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws, {
            header: 1,
          });
          if (data.length === 0) {
            throw "No Data";
          }
          let expertiseArr = []; //, ClientArr = []

          data.forEach(function (row) {
            let obj = {};
            obj["company_name"] = row[0];
            obj["type"] = row[1];
            let preExpertiseLists = "";
            for (let i in row) {
              if (i >= 2) {
                preExpertiseLists += "," + row[i];
              }
            }

            obj["list"] = preExpertiseLists.substr(1);
            expertiseArr.push(obj);

            let egArr = [];
            // if (row[1] === 'Clients') {
            //     for (let i in row) {
            //         if (i >= 2) {
            //             egArr.push(row[i])
            //         }
            //     }

            //     egArr.map(x => {
            //         let obj = {}
            //         obj['company_name'] = row[0]
            //         obj['client_name'] = x
            //         ClientArr.push(obj)
            //     })
            // }
          });

          return res.json({
            expertise: expertiseArr,
            // client: ClientArr,
            filename: filename,
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.uploadClient = function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let filename = files.file.name;
      let ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
      let clientObj = {};

      if (ext === "csv") {
        let readData = [];

        await workbook.csv.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 0; i < readData.length; i++) {
          let company_name = RichTextRemover(readData[i][1]);
          for (let j = 3; j < readData[i].length; j += 2) {
            let client_website, client_name;
            client_name = RichTextRemover(readData[i][j]);
            if (
              RichTextRemover(readData[i][j + 1]) === undefined ||
              RichTextRemover(readData[i][j + 1]) === "-"
            )
              client_website = "-";
            else client_website = RichTextRemover(readData[i][j + 1]);
            let checkValue = company_name + client_website + client_name;

            if (clientObj[checkValue] === undefined) {
              clientObj[checkValue] = {
                company_name,
                client_name,
                client_website,
              };
            }
          }
        }
      }

      if (ext === "xlsx") {
        let readData = [];

        await workbook.xlsx.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 1; i < readData.length; i++) {
          let col, datasetCol;

          //need to check here

          for (let j = 1; j < readData[i].length; j++) {
            if (readData[0][j].toLowerCase().includes("client")) col = j;
            if (readData[0][j].toLowerCase().includes("dataset"))
              datasetCol = j;
          }

          // console.log(readData[i][1], col)

          let company_name = RichTextRemover(readData[i][1]);
          let clientList = RichTextRemover(readData[i][col]).split(",");
          let dataset = RichTextRemover(readData[i][datasetCol]);

          // if(clientList === "-") continue;

          clientList.map((client) => {
            let checkValue = company_name + client;

            if (clientObj[checkValue] === undefined) {
              clientObj[checkValue] = {
                company_name,
                client_name: client,
                dataset,
              };
            }
          });

          // for (let z = 0; z < clientList.length; z += 2) {
          //     let client_name = RichTextRemover(clientList[z])
          //     let client_website

          //     if (!RichTextRemover(clientList[z + 1]) || RichTextRemover(clientList[z + 1]) === '-')
          //         client_website = '-'
          //     else
          //         client_website = clientList[z + 1]

          //     let checkValue = company_name + client_website + client_name

          //     if (clientObj[checkValue] === undefined) {
          //         clientObj[checkValue] = {
          //             company_name,
          //             client_name,
          //             client_website
          //         }
          //     }
          // }
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        data: clientObj,
        filename: filename,
      });
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.importClient = function (req, res) {
  let obj = req.body.clientObj;
  try {
    let promise = Promise.resolve();
    Object.values(obj).map((a) => {
      const makeNextPromise = (a) => async () => {
        await Client.findOne({
          where: {
            [Op.and]: [
              { company_name: a.company_name },
              { client_name: a.client_name },
              { client_website: a.client_website },
              { dataset: a.dataset },
            ],
          },
        }).then((resp) => {
          if (!resp) {
            Client.create({
              company_name: a.company_name,
              client_name: a.client_name,
              client_website: a.client_website,
              dataset: a.dataset,
            });
          }
        });
      };
      promise = promise.then(makeNextPromise(a));
    });

    Promise.all([promise]).then(() => {
      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Client list successfully imported to DB",
        },
      });
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

function RichTextRemover(value) {
  if (typeof value === "object") {
    if (value.text && value.text.richText) {
      const entries = Object.entries(value.text.richText);
      for (const [key, value] of entries) {
        return value.text;
      }
    } else if (value.text && !value.text.richText) {
      return value.text;
    } else if (!value.text && value.richText) {
      const entries = Object.entries(value.richText);
      for (const [key, value] of entries) {
        return value.text;
      }
    }
  } else {
    return value;
  }
}

function isOdd(num) {
  return num % 2;
}

exports.uploadPartnerExcel = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        ExpertiseData = []; //, ClientData = []
      let filename = files.file.name;

      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values.map((val) => RichTextRemover(val)));
        });
      });

      for (let row = 1; row < readData.length; row++) {
        let company_name = readData[row][1];
        let dataset = readData[row][2];
        let list = {};
        for (let col = 3; col < readData[row].length - 1; col++) {
          if (
            readData[row][col] &&
            readData[row][col].includes("Google") &&
            isOdd(col)
          ) {
            list["Google"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Youtube") &&
            isOdd(col)
          ) {
            list["Youtube"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Facebook") &&
            isOdd(col)
          ) {
            list["Facebook"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Instagram") &&
            isOdd(col)
          ) {
            list["Instagram"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Bing") &&
            isOdd(col)
          ) {
            list["Bing"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Twitter") &&
            isOdd(col)
          ) {
            list["Twitter"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Linkedin") &&
            isOdd(col)
          ) {
            list["Linkedin"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          if (
            readData[row][col] &&
            readData[row][col].includes("Snap Chat") &&
            isOdd(col)
          ) {
            list["Snap Chat"] =
              readData[row][col + 1] && readData[row][col + 1].split(",");
          }

          // let Google = RichTextRemover(readData[row][3])
          // let Youtube = RichTextRemover(readData[row][5])
          // let Facebook = RichTextRemover(readData[row][7])
          // let Instagram = RichTextRemover(readData[row][9])
          // let Bing = RichTextRemover(readData[row][11])
          // let Twitter = RichTextRemover(readData[row][13])
          // let Linkedin = RichTextRemover(readData[row][15])
          // let SnapChat = RichTextRemover(readData[row][17])
        }
        let expArr = {};

        expArr["company_name"] = company_name;
        expArr["type"] = "Partners";
        expArr["list"] = list;
        expArr["dataset"] = dataset;

        if (Object.keys(list).length === 0) expArr["list"] = "-";
        ExpertiseData.push(expArr);
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        expertise: ExpertiseData,
        // client: ClientData,
        filename: filename,
        // readData: readData
      });
    } catch (error) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: error.message,
        },
      });
    }
  });
};

exports.importPartner = function (req, res) {
  const expertiseArr = req.body.expertiseArr;
  // const ClientArr = req.body.ClientArr
  let updated = [],
    inserted = [];

  try {
    let promiseExpertise = Promise.resolve();

    expertiseArr.forEach(async (kw) => {
      console.log(kw);
      const makeNextPromise = (kw) => async () => {
        await Expertise.findOne({
          where: {
            [Op.and]: [
              { company_name: kw.company_name },
              { type: kw.type },
              { dataset: kw.dataset },
            ],
          },
        }).then((response) => {
          if (response) {
            response
              .update({
                list: JSON.stringify(kw.list),
              })
              .then((updateRow) => updated.push(updateRow.company_name));
          } else {
            Expertise.create({
              company_name: kw.company_name,
              type: kw.type,
              list: JSON.stringify(kw.list),
              dataset: kw.dataset,
            }).then((created) => inserted.push(created.company_name));
          }
        });
      };
      promiseExpertise = promiseExpertise.then(makeNextPromise(kw));
    });

    Promise.all([promiseExpertise]).then(() => {
      return res.json({
        // expertise: expertiseArr,
        updated: updated,
        inserted: inserted,
      });
    });
    // }
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadProductService = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        ExpertiseData = []; //, ClientData = []
      let filename = files.file.name;

      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values.map((val) => RichTextRemover(val)));
        });
      });

      for (let row = 1; row < readData.length; row++) {
        let company_name = readData[row][2];
        let dataset = readData[row][1];
        let allData = [];
        for (let col = 3; col < readData[row].length; col++) {
          if (readData[row][col] && readData[row][col] != "-") {
            readData[row][col]
              .split("|")
              .map((str) => allData.push(str.toUpperCase().trim()));
          }
        }
        let expArr = {};

        expArr["company_name"] = company_name;
        expArr["dataset"] = dataset;
        expArr["product_service"] = allData.length ? allData.toString() : null;

        ExpertiseData.push(expArr);
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        expertise: ExpertiseData,
        // client: ClientData,
        filename: filename,
        // readData: readData
      });
    } catch (error) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: error.message,
        },
      });
    }
  });
};

exports.importProductService = function (req, res) {
  const expertiseArr = req.body.expertiseArr;
  // const ClientArr = req.body.ClientArr
  let updated = [],
    inserted = [];

  try {
    let promiseExpertise = Promise.resolve();

    expertiseArr.forEach(async (kw) => {
      const makeNextPromise = (kw) => async () => {
        await CompanyItem.findOne({
          where: {
            [Op.and]: [
              { company_name: kw.company_name },
              { dataset: kw.dataset },
              // { product_service: kw.product_service }
            ],
          },
        }).then((response) => {
          if (response) {
            response
              .update({
                product_service: kw.product_service,
              })
              .then((updateRow) => updated.push(updateRow.company_name));
          } else {
            inserted.push(kw.company_name);
            // Expertise.create({
            //     company_name: kw.company_name,
            //     type: kw.type,
            //     list: JSON.stringify(kw.list),
            //     dataset: kw.dataset
            // }).then(created => inserted.push(created.company_name))
          }
        });
      };
      promiseExpertise = promiseExpertise.then(makeNextPromise(kw));
    });

    Promise.all([promiseExpertise]).then(() => {
      return res.json({
        // expertise: expertiseArr,
        updated: updated,
        inserted: inserted,
      });
    });
    // }
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadExpertiseExcel = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        ExpertiseData = []; //, ClientData = []
      let filename = files.file.name;

      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values);
        });
      });

      for (let row = 1; row < readData.length; row++) {
        for (let col = 2; col < readData[row].length - 1; col++) {
          let company_name = RichTextRemover(readData[row][1]);
          let type = RichTextRemover(readData[0][col]);
          let list = RichTextRemover(readData[row][col]);
          let dataset = RichTextRemover(
            readData[row][readData[row].length - 1]
          );

          let expArr = {};

          expArr["company_name"] = company_name;
          expArr["type"] = type.includes("Award") ? "Awards & Accolades" : type;
          expArr["list"] = list;
          expArr["dataset"] = dataset;

          // if (RichTextRemover(readData[0][col]) === 'Clients') {
          //     let cliArr = list.split(',')
          //     cliArr.map(x => {
          //         let obj = {}
          //         obj['company_name'] = company_name
          //         obj['client_name'] = x
          //         ClientData.push(obj)
          //     })
          // }
          ExpertiseData.push(expArr);
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        expertise: ExpertiseData,
        // client: ClientData,
        filename: filename,
      });
    } catch (error) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: error.message,
        },
      });
    }
  });
};

exports.importExpertise = function (req, res) {
  const expertiseArr = req.body.expertiseArr;
  // const ClientArr = req.body.ClientArr

  try {
    let promiseExpertise = Promise.resolve();

    expertiseArr.forEach(async (kw) => {
      console.log(kw);
      const makeNextPromise = (kw) => async () => {
        await Expertise.findOne({
          where: {
            [Op.and]: [
              { company_name: kw.company_name },
              { type: kw.type },
              { dataset: kw.dataset },
            ],
          },
        }).then((response) => {
          if (response) {
            response.update({
              list: kw.list,
            });
          } else {
            Expertise.create({
              company_name: kw.company_name,
              type: kw.type,
              list: kw.list,
              dataset: kw.dataset,
            });
          }
        });
      };
      promiseExpertise = promiseExpertise.then(makeNextPromise(kw));
    });

    // if (ClientArr) {
    //     let promiseClient = Promise.resolve()
    //     ClientArr.forEach(async (kw) => {
    //         const makeClientPromise = (kw) => async () => {
    //             await Client.findOne({
    //                 where: {
    //                     [Op.and]: [
    //                         { company_name: kw.company_name },
    //                         { client_name: kw.client_name }
    //                     ]
    //                 }
    //             }).then(response => {
    //                 if (!response) {
    //                     Client.create({
    //                         company_name: kw.company_name,
    //                         client_name: kw.client_name
    //                     })
    //                 }
    //             })
    //         }
    //         promiseClient = promiseClient.then(makeClientPromise(kw))
    //     })
    //     Promise.all([promiseExpertise, promiseClient]).then(() => {
    //         return res.json({
    //             expertise: expertiseArr,
    //             client: ClientArr
    //         })
    //     })
    // } else {
    Promise.all([promiseExpertise]).then(() => {
      return res.json({
        expertise: expertiseArr,
      });
    });
    // }
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadClientTechno = function (req, res) {
  var form = new formidable.IncomingForm();
  // console.log("form", form)
  form.parse(req, function (err, fields, files) {
    try {
      const filename = files.file.name;
      fs.readFile(
        files.file.path,
        {
          encoding: "utf8",
        },
        function (err, content) {
          if (err) {
            return res.json({
              meta: {
                code: 0,
                success: false,
                message: err.message,
              },
            });
          }

          const wb = XLSX.read(content, {
            type: "string",
            raw: true,
          });

          /* Get first worksheet */
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          /* Convert array of arrays */
          const data = XLSX.utils.sheet_to_json(ws, {
            header: 1,
          });
          if (data.length === 0) {
            throw "No Data";
          }

          let obj = {};

          data.forEach(function (row) {
            if (row.length >= 4) {
              let website = row[0];
              let company_name = row[1];
              let test = website + company_name;

              if (obj[test] === undefined) {
                obj[test] = {
                  company_name,
                  website,
                  asset: {},
                  technology_spending: 0,
                };
              }

              if (row[2] === "TechnologySpending") {
                obj[test].technology_spending = row[3];
              }

              if (row[2] === "asset") {
                let asset_name = row[3] ? row[3] : null;
                let asset_category = row[4] ? row[4] : null;
                let asset_value = row[5] ? row[5] : null;

                if (
                  asset_name &&
                  obj[test]["asset"][asset_name] === undefined
                ) {
                  obj[test]["asset"][asset_name] = {
                    [asset_category]: [asset_value],
                  };
                } else {
                  if (
                    asset_name &&
                    obj[test]["asset"][asset_name][asset_category] === undefined
                  ) {
                    obj[test]["asset"][asset_name][asset_category] = [
                      asset_value,
                    ];
                  } else {
                    obj[test]["asset"][asset_name][asset_category].push(
                      asset_value
                    );
                  }
                }
              }
            }
          });

          let technoData = [];
          Object.values(obj).map((x) => {
            let total = {};

            let assets = x.asset;

            if (assets)
              for (var category in assets) {
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

                    total[category][type].push(brand);
                  }
                }
              }

            let assetTechno = {}; //, assetInfo = {}
            Object.keys(keyValues).forEach(function (category) {
              let typeObj = {};
              keyValues[category].forEach((type) => {
                // console.log(x.company_name,category,"->",type,"-",getBrandData(total, category, type).length)
                assetTechno["company_name"] = x.company_name;
                assetTechno["website"] = x.website;
                if (!assetTechno[category]) assetTechno[category] = [];
                if (!typeObj[type]) typeObj[type];
                typeObj[type] = getBrandData(total, category, type).length;
                // if (!assetTechno[category]) assetTechno[category] = []
                // assetTechno[category].push({ [type] :getBrandData(total, category, type).length})
              });
              assetTechno[category].push(typeObj);
            });

            technoData.push(assetTechno);
          });

          let technoCount = {};
          technoData.map((x) => {
            for (let [key, value] of Object.entries(x)) {
              if (key === "company_name" || key === "website") {
                if (!technoCount[key]) technoCount[key] = 0;
                technoCount[key]++;
              } else {
                if (!technoCount[key]) technoCount[key];
                technoCount[key] = "";
                for (let [k, v] of Object.entries(value)) {
                  for (let [k1, v1] of Object.entries(v)) {
                    // console.log(key)
                    if (!technoCount[k1]) technoCount[k1] = 0;
                    technoCount[k1] += v1;
                  }
                }
              }
            }
          });

          return res.json({
            meta: {
              code: 200,
              success: true,
              message: "Successfully read technology data",
            },
            technoCount: technoCount,
            obj: obj,
            filename: filename,
          });
        }
      );
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.uploadClientTechnoExcel = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        ExpertiseData = [],
        ClientData = [];
      let filename = files.file.name;

      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values);
        });
      });

      let obj = {};
      for (let row = 1; row < readData.length; row++) {
        let company_name = RichTextRemover(readData[row][1]);
        let website = RichTextRemover(readData[row][2]);
        let technology_spending = RichTextRemover(readData[row][3]);

        if (obj[website] === undefined) {
          obj[website] = {
            company_name,
            website,
            asset: {},
            technology_spending,
          };
        }

        let asset_name = RichTextRemover(readData[row][4])
          ? RichTextRemover(readData[row][4])
          : null;
        let asset_category = RichTextRemover(readData[row][5])
          ? RichTextRemover(readData[row][5])
          : null;
        let asset_value = RichTextRemover(readData[row][6])
          ? RichTextRemover(readData[row][6])
          : null;

        if (asset_name && obj[website]["asset"][asset_name] === undefined) {
          obj[website]["asset"][asset_name] = {
            [asset_category]: [asset_value],
          };
        } else {
          if (
            asset_name &&
            obj[website]["asset"][asset_name][asset_category] === undefined
          ) {
            obj[website]["asset"][asset_name][asset_category] = [asset_value];
          } else {
            obj[website]["asset"][asset_name][asset_category].push(asset_value);
          }
        }
      }

      let technoData = [];
      Object.values(obj).map((x) => {
        let total = {};

        let assets = x.asset;

        if (assets)
          for (var category in assets) {
            // console.log(assets)
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

                total[category][type].push(brand);
              }
            }
          }

        let assetTechno = {}; //, assetInfo = {}
        Object.keys(keyValues).forEach(function (category) {
          let typeObj = {};
          keyValues[category].forEach((type) => {
            // console.log(type)
            // console.log(x.company_name,category,"->",type,"-",getBrandData(total, category, type).length)
            assetTechno["company_name"] = x.company_name;
            assetTechno["website"] = x.website;
            if (!assetTechno[category]) assetTechno[category] = [];
            if (!typeObj[type]) typeObj[type];
            typeObj[type] = getBrandData(total, category, type).length;
            // console.log(typeObj[type])
            // if (!assetTechno[category]) assetTechno[category] = []
            // assetTechno[category].push({ [type] :getBrandData(total, category, type).length})
          });
          assetTechno[category].push(typeObj);
        });

        technoData.push(assetTechno);
      });

      let technoCount = {};
      technoData.map((x) => {
        // console.log(technoData)
        for (let [key, value] of Object.entries(x)) {
          if (key === "company_name" || key === "website") {
            if (!technoCount[key]) technoCount[key] = 0;
            technoCount[key]++;
          } else {
            if (!technoCount[key]) technoCount[key];
            technoCount[key] = "";
            for (let [k, v] of Object.entries(value)) {
              for (let [k1, v1] of Object.entries(v)) {
                // console.log(key)
                if (!technoCount[k1]) technoCount[k1] = 0;
                technoCount[k1] += v1;
              }
            }
          }
        }
      });

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read techno excel file",
        },
        technoData: technoData,
        technoCount: technoCount,
        obj: obj,
        filename: filename,
      });
    } catch (error) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: error.message,
        },
      });
    }
  });
};

exports.importClientTechno = function (req, res) {
  let obj = req.body.clientTechnoData;
  try {
    let promise = Promise.resolve();

    Object.values(obj).map(async (a) => {
      const makeNextPromise = (a) => async () => {
        await Client.findAll({
          where: {
            [Op.and]: [
              { client_name: a.company_name },
              { client_website: a.website },
              // { directory: a.directory }
            ],
            // client_name: a.company_name
          },
        }).then(async (resp) => {
          if (resp) {
            // resp.update(
            //     {
            //         // client_website: a.website,
            //         asset: JSON.stringify(a.asset),
            //         spending: a.technology_spending
            //     }
            // );
            // let idArr = []
            resp.forEach(async function (arrayItem) {
              // idArr.push(arrayItem.dataValues.id)
              await Client.findOne({
                where: {
                  id: arrayItem.dataValues.id,
                },
              }).then((resp) => {
                if (resp)
                  resp.update({
                    // client_website: a.website,
                    asset: JSON.stringify(a.asset),
                    spending: a.technology_spending,
                  });
              });
            });
            // for (let i = 0; i < idArr.length; i++) {
            //     await Client.findOne(
            //         {
            //             where: {
            //                 id: idArr[i],
            //             },
            //         }
            //     ).then(resp => {
            //         if (resp)
            //             resp.update(
            //                 {
            //                     // client_website: a.website,
            //                     asset: JSON.stringify(a.asset),
            //                     spending: a.technology_spending
            //                 }
            //             );
            //     })
            // }
          }
        });
      };
      promise = promise.then(makeNextPromise(a));
    });

    Promise.all([promise]).then(() => {
      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Uploaded successfully",
        },
        obj: obj,
      });
    });
  } catch (e) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: e.message,
      },
    });
  }
};

exports.uploadCompanyExcel = function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        finedData = [],
        modifiedData = [],
        realDataObj = {},
        contactObj = {},
        infoObj = {},
        sectorObj = {},
        columnsNotInMapping = [],
        columnsInMapping = [];
      let filename = files.file.name;
      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(
            row.values.map((val) => {
              if (val == "() -" || val == "-" || !val) return null;
              return RichTextRemover(val);
            })
          );
        });
      });

      let obj = {};

      for (let i = 1; i < readData.length; i++) {
        let resArr = {},
          modified = {};

        for (let j = 1; j < readData[i].length; j++) {
          if (!readData[0][j]) continue;
          resArr[readData[0][j]] = readData[i][j]
            ? readData[i][j]
                .toString()
                .replace(/ *\([^)]*\) */g, "")
                .trim()
            : "";
        }

        let sector_temp = {},
          biz_type_temp = {};
        for (let [key, value] of Object.entries(resArr)) {
          if (!obj[key]) obj[key] = 0;
          if (value) obj[key] += 1;

          if (biz_type.includes(key)) {
            if (value) biz_type_temp[key] = value.split("|");
          } else if (sector.includes(key)) {
            if (value) sector_temp[key] = value.split("|");
          }
          //  else modified[key] = value;
          modified[key] = value;
        }
        modified.sector = sector_temp;
        modified.biz_type = biz_type_temp;

        finedData.push(resArr);
        modifiedData.push(modified);
      }

      for (let [field, count] of Object.entries(obj)) {
        // console.log("field", field, field.toUpperCase(), companyFieldMapping[field.toUpperCase()])
        // console.log(field, " => ", tableColumnMap[companyFieldMapping[field.toUpperCase()] || field])

        let tempFieldValue = await checkFieldInDB(
          "company",
          tableColumnMap[companyFieldMapping[field.toUpperCase()] || field]
        );

        if (tempFieldValue) columnsInMapping.push(tempFieldValue);

        // if (companyFieldMapping[field]) {
        //     if (!realDataObj[companyFieldMapping[field]]) realDataObj[companyFielrealDataObjfield]] = {
        //  realDataObjst: [],
        //         count: 0
        //     }
        //     realDataObj[companyFieldMapping[field]].list.push(kerealDataObj     realDataObj[companyFieldMapping[field]].count += courealDataObj }
        // else {
        // if (!realDataObj[field]) realDataObj[field] = {
        //   realDataObj/     count: 0
        // }
        // realDataObj[field].list.push(field)
        // realDataOrealDataObj.count += count
        //realDataObj/ if (!realDataObj[companyFieldMapping[field] || field]) realDataObj[corealDataObjdMapping[field] || field] = {realDataObj   list: [],
        //     count: 0
        // }
        // realDataObj[companyFieldMapping[field] || field].list.push(realDataObj         // realDataObj[companyFieldMapping[field] || field].count += realDataObj        //without Capitilized

        // if (companyContact.includes(companyFieldMapping[field] || field)) {
        //     if (!contactObj[companyFieldMapping[field] || field]) contactObj[companyFieldMapping[field] || field] = {
        //         list: [],
        //         count: 0
        //     }
        //     contactObj[companyFieldMapping[field] || field].list.push(field)
        //     contactObj[companyFieldMapping[field] || field].count += count
        // }

        // else if (companyInfo.includes(companyFieldMapping[field] || field)) {
        //     if (!infoObj[companyFieldMapping[field] || field]) infoObj[companyFieldMapping[field] || field] = {
        //         list: [],
        //         count: 0
        //     }
        //     infoObj[companyFieldMapping[field] || field].list.push(field)
        //     infoObj[companyFieldMapping[field] || field].count += count
        // }

        // else {
        //     // else if (sector.includes(companyFieldMapping[field] || field)) {
        //     if (!sectorObj[companyFieldMapping[field] || field]) sectorObj[companyFieldMapping[field] || field] = {
        //         list: [],
        //         count: 0
        //     }
        //     sectorObj[companyFieldMapping[field] || field].list.push(field)
        //     sectorObj[companyFieldMapping[field] || field].count += count
        // }

        //with Capitilzed

        if (
          companyContact.includes(
            companyFieldMapping[field.toUpperCase()] || field
          )
        ) {
          if (!contactObj[companyFieldMapping[field.toUpperCase()] || field])
            contactObj[companyFieldMapping[field.toUpperCase()] || field] = {
              list: [],
              count: 0,
            };
          contactObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].list.push(field);
          contactObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].count += count;
        } else if (
          companyInfo.includes(
            companyFieldMapping[field.toUpperCase()] || field
          )
        ) {
          if (!infoObj[companyFieldMapping[field.toUpperCase()] || field])
            infoObj[companyFieldMapping[field.toUpperCase()] || field] = {
              list: [],
              count: 0,
            };
          infoObj[companyFieldMapping[field.toUpperCase()] || field].list.push(
            field
          );
          infoObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].count += count;
        }

        // else {
        else if (
          sector.includes(companyFieldMapping[field.toUpperCase()] || field)
        ) {
          if (!sectorObj[companyFieldMapping[field.toUpperCase()] || field])
            sectorObj[companyFieldMapping[field.toUpperCase()] || field] = {
              list: [],
              count: 0,
            };
          sectorObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].list.push(field);
          sectorObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].count += count;
        } else {
          columnsNotInMapping.push(field);
          if (!realDataObj[companyFieldMapping[field.toUpperCase()] || field])
            realDataObj[companyFieldMapping[field.toUpperCase()] || field] = {
              list: [],
              count: 0,
            };
          realDataObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].list.push(field);
          realDataObj[
            companyFieldMapping[field.toUpperCase()] || field
          ].count += count;
        }
      }

      let filterList = [
        "id",
        "min_emp",
        "max_emp",
        "unique",
        "qc",
        "choose_db",
        "qc_date",
        "file_name",
        "overall_knapshot_score",
      ];

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        data: finedData,
        dataToFilter: modifiedData,
        dataCount: obj,
        fields: Object.keys(obj).length,
        filename: filename,
        realDataObj,
        contactObj,
        infoObj,
        sectorObj,
        columnsNotInMapping,
        columnsInMapping,
        availibleColumnFromDB: (
          await checkFieldInDB("company", columnsInMapping)
        ).filter((x) => !filterList.includes(x)),
      });
    } catch (e) {
      console.log("err", e);
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.companyColumnCreate = async function (req, res) {
  try {
    let { newColumnArr } = req.body;

    let rawdata = fs.readFileSync(
      path.join(__dirname, "../models/companyItem.json")
    );
    let companyJson = JSON.parse(rawdata);

    for (let col of newColumnArr) {
      await addColumnIfNotExist("company", col);
      companyJson[col] = "Sequelize.STRING";
    }

    let data = JSON.stringify(companyJson);
    fs.writeFileSync(path.join(__dirname, "../models/companyItem.json"), data);

    // sync
    const { closeSync, openSync, utimesSync } = require("fs");

    const touch = (path) => {
      const time = new Date();
      try {
        utimesSync(path, time, time);
      } catch (err) {
        closeSync(openSync(path, "w"));
      }
    };

    // usage
    const filename = path.join(__dirname, "../../tmp/restart.txt");
    touch(filename);

    console.log(`touch ${filename}`);

    return res.json({
      meta: {
        code: 200,
        success: true,
        message: "Columns created Successfully",
      },
      data,
    });
  } catch (e) {
    console.log("err", e);
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: e.message,
      },
    });
  }
};

exports.importUploadedCompanyExcel = async function (req, res) {
  let {
    data,
    fileNameToUpdate,
    qc,
    chooseDB,
    saveSelect,
    filteredData,
    saveUnAssignedSelect,
  } = req.body;
  let responseData = [],
    failedData = [],
    allFields = {};
  // console.log("filteredData", filteredData.length);
  // for (const [key, value] of Object.entries(saveSelect)) {
  //     if (!((companyFieldMapping[key.toUpperCase()] && tableColumnMap[companyFieldMapping[key.toUpperCase()]]) || (tableColumnMap[key]))) {
  //         await addColumnIfNotExist('company', camel_to_snake(key))
  //     }
  // }

  let allowed = Object.values(saveSelect);

  const filterObj = (raw) =>
    Object.keys(raw)
      .filter((key) => allowed.includes(key))
      .reduce((obj, key) => {
        obj[key] = raw[key];
        return obj;
      }, {});

  // console.log("req", fileNameToUpdate, qc, chooseDB, saveSelect, saveUnAssignedSelect)

  // console.log("allowed", allowed);
  // console.log("test", filterObj(data[0]));
  let i = 0;
  try {
    for (let row of filteredData) {
      let dataItem = {};

      for (const [key, value] of Object.entries(row)) {
        let strValue = value ? value.toString() : null;
        if (
          !(
            (companyFieldMapping[key.toUpperCase()] &&
              tableColumnMap[companyFieldMapping[key.toUpperCase()]]) ||
            tableColumnMap[key]
          )
        )
          continue;

        // console.log("value", key, strValue)
        if (tableColumnMap[key]) {
          if (strValue && strValue.includes("|"))
            dataItem[tableColumnMap[key]] = JSON.stringify(strValue.split("|"));
          else if (arrDataType.includes(tableColumnMap[key]))
            dataItem[tableColumnMap[key]] = JSON.stringify([strValue]);
          else dataItem[tableColumnMap[key]] = strValue;
        } else if (
          companyFieldMapping[key.toUpperCase()] &&
          tableColumnMap[companyFieldMapping[key.toUpperCase()]]
        ) {
          if (strValue && strValue.includes("|"))
            dataItem[
              tableColumnMap[companyFieldMapping[key.toUpperCase()]]
            ] = JSON.stringify(strValue.split("|"));
          else if (
            arrDataType.includes(
              dataItem[tableColumnMap[companyFieldMapping[key.toUpperCase()]]]
            )
          )
            dataItem[
              tableColumnMap[companyFieldMapping[key.toUpperCase()]]
            ] = JSON.stringify([strValue]);
          else
            dataItem[
              tableColumnMap[companyFieldMapping[key.toUpperCase()]]
            ] = strValue;
        }
        // else dataItem[camel_to_snake(key)] = strValue

        for (const [key, value] of Object.entries(saveUnAssignedSelect)) {
          if (row[key] && row[key].includes("|"))
            dataItem[value] = JSON.stringify(row[key].split("|"));
          else dataItem[value] = row[key];
        }

        let sectorArray = saveSelect["sector"];
        let secObj = {};
        // console.log("sectorArray", sectorArray);
        if (sectorArray)
          for (let sect of sectorArray) {
            if (sect && row[sect]) secObj[sect] = row[sect];
          }
        dataItem.sector = JSON.stringify(secObj);

        // if (row["sector"]) {
        //   let sectorArray = saveSelect['sector']
        //   let obj = {}
        //   if(sectorArray)
        //   for(let sect of sectorArray){
        //     obj[sect] = row["sector"][sect]
        //   }
        //   dataItem.sector = JSON.stringify(obj);
        //   // dataItem.sector = JSON.stringify(row["sector"]);
        //   // console.log("datase", dataItem.sector);
        // }
        if (row["biz_type"]) {
          let bizType = row[saveSelect["Business Type"]];
          // console.log("check", bizType);
          let obj = {};
          if (bizType != "REJECTED") {
            obj[bizType] = row["biz_type"][bizType];
            console.log("check2", JSON.stringify(obj));
          }
          dataItem.business_type = JSON.stringify(obj);
          // dataItem.business_type = JSON.stringify(row["biz_type"]);
          // console.log("datase", dataItem.sector);
        }
      }
      dataItem["file_name"] = fileNameToUpdate;
      dataItem["qc"] = qc;
      dataItem["choose_db"] = chooseDB;
      // console.log("dataItem", dataItem.dataset);
      await CompanyItem.findOne({
        where: {
          [Op.and]: [
            { company_name: dataItem.company_name },
            // { source: dataItem.source ? dataItem.source : null },
            {
              dataset: dataItem.dataset,
            },
          ],
        },
      }).then(async (response) => {
        if (response && response !== "") {
          // console.log("update", dataItem.company_name)
          responseData.push(dataItem);
          return await response.update(dataItem);
        } else {
          // console.log("create", dataItem.company_name)
          responseData.push(dataItem);
          // return await db.query(
          //     // `INSERT INTO company (${Object.keys(dataItem).toString()}) VALUES ${Object.keys(dataItem).map(a => '(?)').join(',')};`,
          //     `INSERT INTO company (${Object.keys(dataItem).toString()}) VALUES (${myString(Object.values(dataItem))});`,
          //     {
          //         // replacements: Object.values(dataItem),
          //         type: db.QueryTypes.INSERT
          //     }
          // );
          return await CompanyItem.create(dataItem);
        }
      });
    }

    // for (let row of data) {
    //   let tempObj = filterObj(row);
    //   let dataItem = {};
    //   // if (i == 0) console.log("tempObj", tempObj)
    //   // i++
    //   for (const [key, value] of Object.entries(tempObj)) {
    //     let strValue = value ? value.toString() : null;
    //     if (
    //       !(
    //         (companyFieldMapping[key.toUpperCase()] &&
    //           tableColumnMap[companyFieldMapping[key.toUpperCase()]]) ||
    //         tableColumnMap[key]
    //       )
    //     )
    //       continue;

    //     // console.log("value", key, strValue)
    //     if (tableColumnMap[key]) {
    //       if (strValue && strValue.includes("|"))
    //         dataItem[tableColumnMap[key]] = JSON.stringify(strValue.split("|"));
    //       else if (arrDataType.includes(tableColumnMap[key]))
    //         dataItem[tableColumnMap[key]] = JSON.stringify([strValue]);
    //       else dataItem[tableColumnMap[key]] = strValue;
    //     } else if (
    //       companyFieldMapping[key.toUpperCase()] &&
    //       tableColumnMap[companyFieldMapping[key.toUpperCase()]]
    //     ) {
    //       if (strValue && strValue.includes("|"))
    //         dataItem[
    //           tableColumnMap[companyFieldMapping[key.toUpperCase()]]
    //         ] = JSON.stringify(strValue.split("|"));
    //       else if (
    //         arrDataType.includes(
    //           dataItem[tableColumnMap[companyFieldMapping[key.toUpperCase()]]]
    //         )
    //       )
    //         dataItem[
    //           tableColumnMap[companyFieldMapping[key.toUpperCase()]]
    //         ] = JSON.stringify([strValue]);
    //       else
    //         dataItem[
    //           tableColumnMap[companyFieldMapping[key.toUpperCase()]]
    //         ] = strValue;
    //     }
    //     // else dataItem[camel_to_snake(key)] = strValue

    //     for (const [key, value] of Object.entries(saveUnAssignedSelect)) {
    //       if (row[key] && row[key].includes("|"))
    //         dataItem[value] = JSON.stringify(row[key].split("|"));
    //       else dataItem[value] = row[key];
    //     }
    //     for (let row of filteredData) {
    //       if (row["sector"]) {
    //         dataItem.sector = JSON.stringify(row["sector"]);
    //         // console.log("datase", dataItem.sector);
    //       }
    //       if (row["biz_type"]) {
    //         dataItem.business_type = JSON.stringify(row["biz_type"]);
    //         // console.log("datase", dataItem.sector);
    //       }
    //     }
    //   }

    //   if (!Object.keys(dataItem).length) continue;

    //   // console.log("record", dataItem)

    //   dataItem["file_name"] = fileNameToUpdate;
    //   dataItem["qc"] = qc;
    //   dataItem["choose_db"] = chooseDB;

    //   await CompanyItem.findOne({
    //     where: {
    //       [Op.and]: [
    //         { company_name: dataItem.company_name },
    //         // { source: dataItem.source ? dataItem.source : null },
    //         { dataset: dataItem.dataset },
    //       ],
    //     },
    //   }).then(async (response) => {
    //     if (response && response !== "") {
    //       // console.log("update", dataItem.company_name)
    //       responseData.push(dataItem);
    //       return await response.updateAttributes(dataItem);
    //     } else {
    //       // console.log("create", dataItem.company_name)
    //       responseData.push(dataItem);
    //       // return await db.query(
    //       //     // `INSERT INTO company (${Object.keys(dataItem).toString()}) VALUES ${Object.keys(dataItem).map(a => '(?)').join(',')};`,
    //       //     `INSERT INTO company (${Object.keys(dataItem).toString()}) VALUES (${myString(Object.values(dataItem))});`,
    //       //     {
    //       //         // replacements: Object.values(dataItem),
    //       //         type: db.QueryTypes.INSERT
    //       //     }
    //       // );
    //       return await CompanyItem.create(dataItem);
    //     }
    //   });
    // }
  } catch (error) {
    console.log("error", error);
  }

  return res.json({
    data: responseData,
  });
};

exports.oldUploadCompanyExcel = function (req, res) {
  // old company upload excel
  var form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let readData = [],
        finedData = [];
      let filename = files.file.name;
      await workbook.xlsx.readFile(files.file.path).then(function () {
        var worksheet = workbook.getWorksheet(1);
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
          readData.push(row.values);
        });
      });
      for (let i = 1; i < readData.length; i++) {
        let resArr = {};
        for (let j = 1; j < readData[i].length; j++) {
          // if (typeof readData[i][j] === 'object') {
          //     for (var x = 0, l = readData[i][j].richText.length; x < l; x++) {
          //         resArr[convertCamelToSnakeCase(readData[0][j])] = readData[i][j].richText[x].text
          //     }
          // }

          if (typeof readData[i][j] === "object") {
            if (readData[i][j].text && readData[i][j].text.richText) {
              const entries = Object.entries(readData[i][j].text.richText);
              for (const [key, value] of entries) {
                if (readData[0][j] !== "linkedIn")
                  resArr[convertCamelToSnakeCase(readData[0][j])] = value.text;
                else resArr[readData[0][j]] = value.text;
              }
            } else if (readData[i][j].text && !readData[i][j].text.richText) {
              if (readData[0][j] !== "linkedIn")
                resArr[convertCamelToSnakeCase(readData[0][j])] =
                  readData[i][j].text;
              else resArr[readData[0][j]] = readData[i][j].text;
            } else if (!readData[i][j].text && readData[i][j].richText) {
              const entries = Object.entries(readData[i][j].richText);
              for (const [key, value] of entries) {
                if (readData[0][j] !== "linkedIn")
                  resArr[convertCamelToSnakeCase(readData[0][j])] = value.text;
                else resArr[readData[0][j]] = value.text;
              }
            }
          } else {
            if (readData[0][j] !== "linkedIn")
              resArr[convertCamelToSnakeCase(readData[0][j])] = readData[i][j];
            else resArr[readData[0][j]] = readData[i][j];
          }
        }
        finedData.push(resArr);
      }

      let obj = {};

      for (let [key, value] of Object.entries(finedData)) {
        for (let [k, v] of Object.entries(value)) {
          if (v && v != "-") {
            if (!obj[k]) obj[k] = 0;
            obj[k]++;
          }
          if (v && v == "-") {
            if (!obj[k]) obj[k] = 0;
            obj[k] += 0;
          }
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        // dataColumn: readData[0],
        dataColumn: readData,
        // data: finedData,
        // dataCount: obj,
        // fields: Object.keys(obj).length,
        // filename: filename
      });
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.oldImportUploadedCompanyExcel = function (req, res) {
  // old company import excel

  const data = req.body.data;
  const fileNameToUpdate = req.body.fileNameToUpdate;
  const qc = req.body.qc;
  const chooseDB = req.body.chooseDB;

  let someofArr = [];
  try {
    data.forEach(function (dataItem) {
      dataItem["file_name"] = fileNameToUpdate;
      dataItem["qc"] = qc;
      dataItem["choose_db"] = chooseDB;
      let eachData = "";

      console.log("dataItem Keys", Object.keys(dataItem));

      // console.log("type",typeof dataItem['product_service'])
      // if (dataItem['product_service'].indexOf('-') !== -1) console.log(" - here")
      // else console.log("no - here")

      // if (dataItem['product_service'].indexOf('-') !== -1) {
      //     dataItem['product_service'].split("\n").filter(x => x.trim() != '').map(line => eachData.push(line.split('-')[1]))
      //     dataItem['product_service'] = eachData.filter(some => some).toString()
      // }  // 1st method

      if (dataItem["product_service"]) {
        if (dataItem["product_service"].indexOf("-") !== -1) {
          dataItem["product_service"]
            .split("\n")
            .filter((x) => x.trim() != "")
            .map((line) => {
              if (!eachData && line.split("-")[1])
                eachData = line.split("-")[1];
              if (eachData && line.split("-")[1])
                eachData += `,${line.split("-")[1]}`;
            });
          dataItem["product_service"] = eachData;
        } else
          dataItem["product_service"] = dataItem["product_service"]
            .split("\n")
            .filter(Boolean)
            .toString();
      }

      // dataItem['product_service'] = dataItem['product_service'].split(',').filter(Boolean).toString()

      // console.log("PS", dataItem['product_service'])

      console.log("dataItem.dataset", dataItem.dataset);

      CompanyItem.findOne({
        where: {
          [Op.and]: [
            { company_name: dataItem.company_name },
            // { source: dataItem.source ? dataItem.source : null },
            { dataset: dataItem.dataset },
          ],
        },
      }).then((response) => {
        if (response && response !== "") {
          // console.log("update", dataItem.company_name)
          return response.updateAttributes(dataItem);
        } else {
          // console.log("create", dataItem.company_name)
          return CompanyItem.create(dataItem);
        }
      });
    });
  } catch (error) {}

  return res.json({
    data: data,
  });
};

exports.uploadDirectory = function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let filename = files.file.name;
      let ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
      let dirObj = {};

      if (ext === "csv") {
        let readData = [];

        await workbook.csv.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 0; i < readData.length; i++) {
          let company_name = readData[i][1];
          let directory = readData[i][3];
          let link = readData[i][4];
          let checkDir = company_name + link;
          if (dirObj[checkDir] === undefined) {
            dirObj[checkDir] = {
              company_name,
              directory,
              link,
            };
          }
        }
      }

      if (ext === "xlsx") {
        let readData = [];

        await workbook.xlsx.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 1; i < readData.length; i++) {
          let company_name = RichTextRemover(readData[i][1]);
          for (let j = 2; j < readData[i].length; j++) {
            let data = RichTextRemover(readData[i][j]);
            if (data && data !== undefined && data !== "-") {
              let directory = "";

              if (readData[0][j].toLowerCase().includes("info"))
                directory = "infoDirectory";
              if (readData[0][j].toLowerCase().includes("job"))
                directory = "jobDirectory";
              if (readData[0][j].toLowerCase().includes("location"))
                directory = "locationDirectory";
              if (readData[0][j].toLowerCase().includes("blogger"))
                directory = "bloggers";
              if (readData[0][j].toLowerCase().includes("business"))
                directory = "businessDirectory";
              if (readData[0][j].toLowerCase().includes("marketplace"))
                directory = "marketplace";
              if (readData[0][j].toLowerCase().includes("forum"))
                directory = "forum";

              let listArr = data.split(",");

              listArr.map((x) => {
                let link = x;
                let checkDir = company_name + link + directory;
                if (dirObj[checkDir] === undefined) {
                  dirObj[checkDir] = {
                    company_name,
                    directory,
                    link,
                  };
                }
              });
            }
          }
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        data: dirObj,
        filename: filename,
      });
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.importDirectory = function (req, res) {
  let obj = req.body.dirObj;
  try {
    let promise = Promise.resolve();
    Object.values(obj).map((a) => {
      const makeNextPromise = (a) => async () => {
        await Directory.findOne({
          where: {
            [Op.and]: [
              { company_name: a.company_name },
              { link: a.link },
              { directory: a.directory },
            ],
          },
        }).then((resp) => {
          if (!resp) {
            Directory.create({
              company_name: a.company_name,
              link: a.link,
              directory: a.directory,
            });
          }
        });
      };
      promise = promise.then(makeNextPromise(a));
    });

    Promise.all([promise]).then(() => {
      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Directory Imported Successfully",
        },
      });
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadPersonnel = function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let filename = files.file.name;
      let ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
      let dirObj = {};

      if (ext === "csv") {
        let readData = [];

        await workbook.csv.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 0; i < readData.length; i++) {
          let company_name = readData[i][1];
          let directory = readData[i][3];
          let link = readData[i][4];
          let checkDir = company_name + link;
          if (dirObj[checkDir] === undefined) {
            dirObj[checkDir] = {
              company_name,
              directory,
              link,
            };
          }
        }
      }

      if (ext === "xlsx") {
        let readData = [],
          allPersonnelData = {};

        await workbook.xlsx.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        console.log("readData", readData[0]);
        console.log("readData", readData[1]);

        for (let i = 1; i < readData.length; i++) {
          let company_name = RichTextRemover(readData[i][1]);
          let dataset = RichTextRemover(readData[i][readData[i].length - 1]);
          let nameArr = [],
            titleArr = [],
            linkedInArr = [];
          for (let j = 2; j < readData[i].length; j++) {
            let data = RichTextRemover(readData[i][j]);
            let column = readData[0][j];
            // if(column.includes("CEO/Founder")) column = "personnel_name"
            // if(column.includes("Title")) column = "title"
            // if(column.includes("Linkedin")) column = "linkedIn"
            // console.log(company_name, column, data)
            if (column.includes("CEO/Founder")) nameArr.push(data);
            if (column.includes("Title")) titleArr.push(data);
            if (column.includes("Linkedin")) linkedInArr.push(data);
            // if (data && data !== undefined && data !== '-') {
            //     let directory = ''

            //     if (readData[0][j].toLowerCase().includes("info")) directory = 'infoDirectory'
            //     if (readData[0][j].toLowerCase().includes("job")) directory = 'jobDirectory'
            //     if (readData[0][j].toLowerCase().includes("location")) directory = 'locationDirectory'
            //     if (readData[0][j].toLowerCase().includes("blogger")) directory = 'bloggers'
            //     if (readData[0][j].toLowerCase().includes("business")) directory = 'businessDirectory'
            //     if (readData[0][j].toLowerCase().includes("marketplace")) directory = 'marketplace'
            //     if (readData[0][j].toLowerCase().includes("forum")) directory = 'forum'

            //     let listArr = data.split(',')

            //     listArr.map(x => {
            //         let link = x
            // let checkData = company_name + column + data
            // if (!dirObj[checkData]) {
            //     dirObj[checkData] = {
            //         company_name,
            //         column,
            //         data
            //     }
            // }
            //     })

            // }
          }
          // nameArr.filter(function (x, i) {
          //     let title = titleArr[i], linkedIn = linkedInArr[i], personnel_name = x
          //     let checkData = company_name + personnel_name + title + linkedIn + dataset
          //     // if (company_name == "PURPLE ASIA") {
          //     //     console.log("company_name", company_name)
          //     //     console.log("personnel_name", personnel_name)
          //     //     console.log("title", title)
          //     //     console.log("linkedIn", linkedIn)
          //     //     console.log("dataset", dataset)
          //     // }
          //     if (checkData.includes("undefined")) {

          //         return false
          //     }
          //     return true;
          // }).map((x, i) => {
          //     let title = titleArr[i], linkedIn = linkedInArr[i], personnel_name = x
          //     let checkData2 = company_name + personnel_name + title + linkedIn + dataset
          //     if (!dirObj[checkData2]) {
          //         dirObj[checkData2] = {
          //             company_name,
          //             personnel_name,
          //             title,
          //             linkedIn,
          //             dataset
          //         }
          //     }
          // })
          nameArr.map((x, i) => {
            let title = titleArr[i],
              linkedIn = linkedInArr[i],
              personnel_name = x;
            let checkData =
              company_name + personnel_name + title + linkedIn + dataset;
            if (!dirObj[checkData] && !checkData.includes("undefined")) {
              dirObj[checkData] = {
                company_name,
                personnel_name,
                title,
                linkedIn,
                dataset,
              };
            }
          });
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        data: dirObj,
        filename: filename,
      });
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.importPersonnel = function (req, res) {
  let obj = req.body.pdata;
  // console.log(PersonnelItem.rawAttributes)
  try {
    let promise = Promise.resolve();
    Object.values(obj).map((a) => {
      if (a.company_name == "PURPLE ASIA") {
        console.log("company_name", a.company_name);
        console.log("personnel_name", a.personnel_name);
        console.log("title", a.title);
        console.log("linkedIn", a.linkedIn);
        console.log("dataset", a.dataset);
      }
      const makeNextPromise = (a) => async () => {
        await PersonnelItem.findOne({
          where: {
            [Op.and]: [
              { company_name: a.company_name },
              { personnel_name: a.personnel_name },
              { title: a.title },
              { linkedinUrl: a.linkedIn },
              { dataset: a.dataset },
            ],
          },
        }).then((resp) => {
          if (!resp) {
            PersonnelItem.create({
              company_name: a.company_name,
              personnel_name: a.personnel_name,
              title: a.title,
              linkedinUrl: a.linkedIn,
              dataset: a.dataset,
            });
          }
        });
      };
      promise = promise.then(makeNextPromise(a));
    });

    Promise.all([promise]).then(() => {
      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Personnel Imported Successfully",
        },
      });
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.uploadNameChanges = function (req, res) {
  var form = new formidable.IncomingForm();

  form.parse(req, async function (err, fields, files) {
    try {
      var workbook = new Excel.Workbook();
      let filename = files.file.name;
      let ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
      let compArr = [];

      if (ext === "csv") {
        let readData = [];

        await workbook.csv.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        for (let i = 0; i < readData.length; i++) {
          let company_name = readData[i][1];
          let directory = readData[i][3];
          let link = readData[i][4];
          let checkDir = company_name + link;
          if (dirObj[checkDir] === undefined) {
            dirObj[checkDir] = {
              company_name,
              directory,
              link,
            };
          }
        }
      }

      if (ext === "xlsx") {
        let readData = [],
          allPersonnelData = {};

        await workbook.xlsx.readFile(files.file.path).then(function () {
          var worksheet = workbook.getWorksheet(1);
          worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            readData.push(row.values);
          });
        });

        console.log("readData", readData[0]);
        console.log("readData", readData[1]);

        for (let i = 1; i < readData.length; i++) {
          let old_company_name = RichTextRemover(readData[i][1]);
          let dataset = RichTextRemover(readData[i][2]);
          let new_company_name = RichTextRemover(readData[i][3]);
          compArr.push({
            old_company_name,
            dataset,
            new_company_name,
          });
        }
      }

      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Successfully read excel file",
        },
        data: compArr,
        filename: filename,
      });
    } catch (e) {
      return res.json({
        meta: {
          code: 0,
          success: false,
          message: e.message,
        },
      });
    }
  });
};

exports.importNameChanges = function (req, res) {
  let arr = req.body.data;
  try {
    let changeArr = [],
      notWorking = [];
    let promise = Promise.resolve();
    arr.map((a, i) => {
      const makeNextPromise = (a) => async () => {
        // await CompanyItem.findOne({
        // await Expertise.findOne({
        // await Client.findOne({
        // await PersonnelItem.findOne({
        //     where: {
        //         [Op.and]: [
        //             { company_name: a.old_company_name },
        //             { dataset: a.dataset },
        //         ]
        //     },
        // }).then(resp => {
        //     if (resp) {

        //         resp.updateAttributes({
        //             company_name: a.new_company_name,
        //         }).then(updated => changeArr.push({
        //             id: updated.id,
        //             company_name: updated.company_name
        //         }))
        //     }
        //     else notWorking.push(arr[i].old_company_name)
        // })
        await PersonnelItem.findAll({
          where: {
            [Op.and]: [
              { company_name: a.old_company_name },
              { dataset: a.dataset },
            ],
          },
        }).then((instances) => {
          if (instances) {
            instances.forEach(function (instance) {
              instance
                .updateAttributes({
                  company_name: a.new_company_name,
                })
                .then((updated) =>
                  changeArr.push({
                    id: updated.id,
                    company_name: updated.company_name,
                  })
                );
            });
          } else notWorking.push(arr[i].old_company_name);
        });
      };
      promise = promise.then(makeNextPromise(a));
    });

    Promise.all([promise]).then(() => {
      return res.json({
        meta: {
          code: 200,
          success: true,
          message: "Names Changed Successfully",
          data: changeArr,
          notWorking: notWorking,
        },
      });
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.empSizeDataStandardize = async function (req, res) {
  let changeArr = [];
  try {
    await CompanyItem.findAll().then((resp) => {
      resp.forEach((data) => {
        let str = data.dataValues.total_personnel;
        let hasChanges;
        if (str == "-") hasChanges = 0;
        if (str == "-1") hasChanges = 0;
        if (str.includes("to")) hasChanges = str.replace(" to ", "-");
        if (str.includes(",")) hasChanges = str.replace(",", "");

        if (hasChanges == 0 || hasChanges)
          data
            .updateAttributes({
              total_personnel: hasChanges,
            })
            .then((updated) =>
              changeArr.push({
                id: updated.id,
                company_name: updated.company_name,
              })
            );
      });
    });

    return res.json({
      meta: {
        code: 200,
        success: true,
        message: "Successful",
        changeArr: changeArr,
      },
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};

exports.empSizeMinMaxSeparate = async function (req, res) {
  let changeArr = [];
  try {
    await CompanyItem.findAll().then((resp) => {
      resp.forEach((data) => {
        if (data.dataValues.id === 1) console.log(data.dataValues);
        let str = data.dataValues.total_personnel;
        let min = parseInt(str),
          max = parseInt(str);
        if (str.includes("-")) {
          let splitData = str.split("-");
          min = parseInt(splitData[0]);
          max = parseInt(splitData[1]);
        }
        if (str.includes("+")) {
          min = parseInt(str.replace("+", ""));
          max = parseInt(str.replace("+", ""));
        }

        data
          .update({
            min_emp: min,
            max_emp: max,
          })
          .then((updated) =>
            changeArr.push({
              id: updated.id,
              min: updated.min_emp,
              max: updated.max_emp,
            })
          );
      });
    });

    return res.json({
      meta: {
        code: 200,
        success: true,
        message: "Successful",
        updated: changeArr,
      },
    });
  } catch (error) {
    return res.json({
      meta: {
        code: 0,
        success: false,
        message: error.message,
      },
    });
  }
};
