const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/stream-voice', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_monolingual_v1', // You may update to multilingual or enhanced models
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      responseType: 'stream',
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('❌ ElevenLabs stream failed', error.message);
    res.status(500).send('Stream error');
  }
});

module.exports = router;
