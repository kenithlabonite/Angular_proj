require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');

// middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// api routes
const accountRoutes = require('./accounts/accounts.controller');
const employeeRoutes = require('./employees/employee.controller');
const departmentRoutes = require('./departments');
const requestRoutes = require('./requests/request.controller');


// If you plan to expose refresh tokens via API, add a controller for it
// const refreshTokenRoutes = require('./accounts/refresh-tokens.controller');

app.use('/accounts', accountRoutes);
app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);
app.use('/requests', requestRoutes);
// app.use('/refreshtokens', refreshTokenRoutes);

// global error handler
app.use(errorHandler);

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => console.log('Server listening on port ' + port));
