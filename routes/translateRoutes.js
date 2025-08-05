const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { translateText } = require('../controllers/translateController');

// Load Gemini API key from environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/', translateText);

module.exports = router; 