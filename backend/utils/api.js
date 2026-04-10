const axios = require('axios');

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
});

// Note: This file is in the backend utils folder.
// The frontend has its own api.js at frontend/src/utils/api.js
// This file is only used if the backend needs to make internal API calls.

module.exports = API;