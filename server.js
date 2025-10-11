// server.js
require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// ✅ Allow CORS requests from any origin with credentials
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

// ✅ Import route controllers
const accountRoutes = require('./accounts/accounts.controller');
const employeeRoutes = require('./employees/employee.controller');
const departmentRoutes = require('./departments'); // folder with index.js exporting router
const requestRoutes = require('./requests');       // folder with index.js exporting router
const workflowRoutes = require('./workflows/workflow.controller');
const positionRoutes = require('./positions/position.controller'); // ✅ fixed path

// ✅ Mount routes
app.use('/accounts', accountRoutes);
app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);
app.use('/requests', requestRoutes);
app.use('/workflows', workflowRoutes);
app.use('/positions', positionRoutes); // ✅ now /positions not /api/positions

// 🧩 Global error handler
app.use(errorHandler);

// ✅ Start server
const port = process.env.NODE_ENV === 'production'
  ? (process.env.PORT || 80)
  : 4000;

app.listen(port, () => console.log(`✅ Server listening on port ${port}`));
