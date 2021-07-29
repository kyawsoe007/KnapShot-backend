module.exports = {
    database: {
        host: 'localhost',
        name: 'cleandatai_db',
        user: 'root',
        pass: '',
        // host: '52.163.248.218:8443',
        // name: 'cleandatai_db',
        // user: 'api-dev',
        // pass: 'Ap!-d3v',
    },
    engine_api: {
        search_company: 'http://localhost:8121/processCompany',
        check_company_status: 'http://localhost:8121/checkStatus',
        get_company_results: 'http://localhost:8121/getResult'
    }
};