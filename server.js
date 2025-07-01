const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const sessionStore = {};

// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// 🧠 Generate personalized AI story
app.post('/api/generate-story', async (req, res) => {
  try {
    const { prompt, messages = [], userName = 'friend' } = req.body;

    const systemPrompt = {
      role: 'system',
      content: `You are a TED-style speaker. Talk directly to ${userName}, making it feel personal, motivational, and clear. Use storytelling and emotion.`
    };

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemPrompt, ...messages, { role: 'user', content: prompt }],
      temperature: 0.85
    });

    const reply = gptResponse.choices[0].message.content;
    res.json({ text: reply });
  } catch (err) {
    console.error('Error in /generate-story:', err.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// 🎙️ Narrate the story using ElevenLabs
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
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
  } catch (error) {
    console.error('Error narrating text:', error.message);
    res.status(500).send('Narration failed.');
  }
});

// 🔁 Save session on server
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  sessionStore[sessionId] = messages;
  res.json({ status: 'saved' });
});

// 🔁 Retrieve session from server
app.get('/api/get-session', (req, res) => {
  const sessionId = req.query.sessionId;
  const messages = sessionStore[sessionId] || [];
  res.json({ messages });
});

// 🗣️ Get voices from ElevenLabs
app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    res.json(response.data.voices);
  } catch (error) {
    console.error('Error fetching voices:', error.message);
    res.status(500).json({ error: 'Failed to fetch voices.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
