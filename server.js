
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const sessions = new Map();

// 🟡 GET VOICES
app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVEN_LABS_API_KEY }
    });
    res.json(response.data.voices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// 🟡 GENERATE STORY
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a voice-based interactive learning companion who explains AI through stories, adapted to the user's level and language.' },
        ...messages,
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const story = completion.choices[0].message.content.trim();
    sessions.set(sessionId, messages.concat({ role: 'assistant', content: story }));
    res.json({ text: story });
  } catch (err) {
    console.error('Error generating story:', err.message);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});

// 🟡 TTS
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      data: {
        text,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75
        }
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error('TTS Error:', err.message);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

// 🟡 SAVE SESSION
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  try {
    sessions.set(sessionId, messages);
    res.json({ status: 'saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// 🟡 GET SESSION
app.get('/api/get-session', (req, res) => {
  const sessionId = req.query.sessionId;
  const messages = sessions.get(sessionId) || [];
  res.json({ messages });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
