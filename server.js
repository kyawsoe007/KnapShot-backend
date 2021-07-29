var express = require('express');
var path = require('path');
var app = express();

var bodyParser = require('body-parser');
var cors = require('cors');

//port
var port = process.env.PORT || 5000;


//routes
var companyRoute = require('./api/routes/Company');
var userRoute = require('./api/routes/User');
var analyzeRoute = require('./api/routes/Analyze');
var uploadRoute = require('./api/routes/Upload');
var subscriptionRoute = require('./api/routes/Subscription');
var favRoute = require('./api/routes/Favourite');
var scoreRoute = require('./api/routes/Score');
var checkerRoute = require('./api/routes/Checker');

app.use(cors());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb', extended: true }));

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());



app.use(express.static(__dirname + '/assets/images'))
app.use('/images', express.static(path.join(__dirname, '/assets/images')))

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setTimeout(10 * 60 * 1000);
    next();
});

companyRoute(app);
userRoute(app);
analyzeRoute(app);
uploadRoute(app);
subscriptionRoute(app);
favRoute(app);
scoreRoute(app);
checkerRoute(app);

app.listen(port);
console.log('todo list RESTful API server started on: ' + port);


