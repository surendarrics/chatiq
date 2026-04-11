const axios = require('axios');

// Internal API client for backend-to-backend calls (if needed)
const API = axios.create({
  baseURL: `http://localhost:${process.env.PORT || 3001}/api`,
});

module.exports = API;