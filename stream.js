const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// POST: original implementation (used by fetch/axios)
router.post('/stream-voice', async (req, res) => {
  const { text, voiceId } = req.body;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Missing text or voiceId' });
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_monolingual_v1', // or 'eleven_multilingual_v2'
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
    console.error('❌ ElevenLabs POST stream failed:', error.message);
    res.status(500).send('Stream error');
  }
});

// GET: used by <audio src="/stream-voice?..."> for direct streaming
router.get('/stream-voice', async (req, res) => {
  const { text, voiceId } = req.query;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Missing text or voiceId' });
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_monolingual_v1',
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
    console.error('❌ ElevenLabs GET stream failed:', error.message);
    res.status(500).send('Stream error');
  }
});

module.exports = router;
