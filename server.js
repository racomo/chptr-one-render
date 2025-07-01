const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// === In-memory session store ===
const sessionStore = {};

// === Voice map per language ===
const LANGUAGE_VOICE_MAP = {
  English: ['Rachel', 'Domi', 'Clyde', 'Matthew', 'Steve'],
  Spanish: ['Antonio', 'Lupe'],
  French: ['Chloe', 'Remi', 'Antoine'],
  Danish: ['Freja', 'Naja', 'Liam']
};

// === Routes ===

// Serve start.html
app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// Load ElevenLabs voices
app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVEN_API_KEY }
    });
    res.json(response.data.voices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Generate AI story with OpenAI
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages, userName } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're a TED speaker giving a deeply personal, inspiring, and simple explanation about AI. Address the listener by name (${userName}). Make it feel like a 1-on-1 story, not a generic lecture.`
        },
        ...messages,
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    });

    const story = completion.choices[0].message.content;
    sessionStore[sessionId] = messages.concat({ role: 'assistant', content: story });
    res.json({ text: story });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});

// Narrate story with ElevenLabs
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      },
      {
        headers: {
          'xi-api-key': ELEVEN_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length
    });
    res.send(response.data);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// Save session to memory (simulate DB)
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  sessionStore[sessionId] = messages;
  res.json({ success: true });
});

// Load session
app.get('/api/get-session', (req, res) => {
  const sessionId = req.query.sessionId;
  const messages = sessionStore[sessionId] || [];
  res.json({ messages });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
