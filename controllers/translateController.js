const axios = require('axios');

exports.translateText = async (req, res) => {
  const { text, target } = req.body;
  if (!text || !target) return res.status(400).json({ error: 'Missing text or target language' });

  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await axios.post(url, {
      q: text,
      target,
      format: 'text'
    });
    res.json({ translation: response.data.data.translations[0].translatedText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 