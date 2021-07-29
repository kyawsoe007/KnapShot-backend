'use strict';
const Sequelize = require('sequelize');

//models
const db = require('./db');
const User = require('./User');

const Subscription = db.define('subscription',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        location_map: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        industry_chart: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        scoring_chart: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_asset: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        dir_presence: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        advertising: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        analytics: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ecommerce: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        widgets: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        hosting: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        productivity: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        people_tab: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        company_info_tab: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_presence_tab: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        technology_tab: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        activities_tab: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        countries_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        industry_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        emp_size_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        hq_location_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        company_staff_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        role_search_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        designation_search_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        contact_asset_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        social_acc_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        dir_presence_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_engagement_level_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        avertising_network_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ads_txt_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ad_exchange_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        audience_targeting_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        facebook_exchange_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ad_server_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        affiliate_program_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        contextual_advertising_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        dynamic_creative_optimiztion_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_video_ads_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        retargeting_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        header_bidding_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        app_performance_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ab_testing_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ad_analytics_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        conversion_optimization_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        advertiser_tracking_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        tag_mgmt_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        audience_measurement_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        visitor_count_tracking_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        non_platform_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        hosted_solution_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        open_source_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        checkout_button_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        payment_acceptance_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        payment_processor_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        payment_currency_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        live_chat_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        login_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        ticketing_sys_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        bookings_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        social_sharing_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        schedule_mgmt_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        cloud_hosting_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        cloud_paas_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        dedicated_hosting_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        business_email_hosting_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        web_hosting_provider_email_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        marketing_platform_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        crm_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        lead_generation_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        product_recommendation_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        'feedback_form_&_survey_filter': {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        campaign_mgmt_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        marketing_automation_filter: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        company_contact_downloadable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        presonal_contact_downloadable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        frimographic_data_downloadable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_presence_downloadable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        technographic_data_downloadable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        downloadable_count: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        plan_type: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "No Plan",
        },
        digital_engagement_industry_view: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        digital_engagement_provider_view: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        technology_industry_view: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
        technology_provider_view: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: 0,
        },
    },
    {
        timestamps: false,
        freezeTableName: true,
    }
);

//Subscription.hasOne(User, { foreignKey: 'user_id', sourceKey: 'id' });
Subscription.belongsTo(User, { foreignKey: 'user_id', sourceKey: 'id' });

module.exports = Subscription;