const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// In-memory session store (use Redis/Mongo for production)
const sessions = {};

// 🔹 Voice list filtering by language
const languageVoiceMap = {
  English: ['Rachel', 'Domi', 'Clyde', 'Matthew', 'Steve'],
  Spanish: ['Antonio', 'Lupe'],
  Danish: ['Freja', 'Naja', 'Liam'],
  French: ['Chloe', 'Remi', 'Antoine']
};

app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });

    const allVoices = response.data.voices || [];
    const filtered = allVoices.filter(v =>
      Object.values(languageVoiceMap).flat().includes(v.name)
    );

    res.json(filtered);
  } catch (error) {
    console.error("❌ Failed to fetch voices:", error.response?.data || error.message);
    res.status(500).json({ error: 'Could not fetch voices' });
  }
});

// 🧠 Session Save/Load
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  if (sessionId && Array.isArray(messages)) {
    sessions[sessionId] = messages;
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid session data' });
  }
});

app.get('/api/get-session', (req, res) => {
  const { sessionId } = req.query;
  const messages = sessions[sessionId] || [];
  res.json({ messages });
});

// 🧠 AI Story
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages, userName } = req.body;
  console.log(`📝 Generating story for ${userName || 'user'}...`);

  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're a TED-level storyteller, speaking directly to ${userName || 'the listener'}. Make every response feel intimate and crafted just for them. Keep it warm, emotional, simple.`
        },
        ...(messages || []),
        { role: 'user', content: prompt }
      ],
      temperature: 0.85,
      max_tokens: 1200
    });

    const story = result.choices?.[0]?.message?.content?.trim();

    if (!story) {
      console.error("❌ No story returned from OpenAI");
      return res.status(500).json({ error: 'Story generation failed.' });
    }

    res.json({ text: story });
  } catch (error) {
    console.error("❌ Error generating story:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// 🔊 Narration
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Missing text or voiceId.' });
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      data: {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.6
        }
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("❌ Narration error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// 🌍 Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
