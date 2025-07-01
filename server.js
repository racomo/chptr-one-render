const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

// ✅ Initialize OpenAI SDK v4+
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// 🔹 Serve static HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/start', (req, res) => res.sendFile(path.join(__dirname, 'start.html')));

// 🔹 In-memory session store (can replace with Redis/Mongo)
const sessions = {};

// 🎙️ AI Story Generator
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages = [] } = req.body;
  console.log('📨 Prompt received:', prompt);

  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Act like an accomplished speechwriter and public speaking coach.
You mastered every precept from the book "Talk like TED".
Your expertise lies in crafting captivating and influential TED-style talks for global audiences.
Structure your response like a compelling story built for listening, not reading. Keep it simple, clear, and emotional.`
        },
        ...messages,
        { role: 'user', content: prompt }
      ],
      temperature: 0.85,
      max_tokens: 1200
    });

    const story = result.choices?.[0]?.message?.content?.trim();

    if (!story) {
      console.error("❌ Empty story returned");
      return res.status(500).json({ error: 'No story returned' });
    }

    if (sessionId) {
      sessions[sessionId] = [...(sessions[sessionId] || []), { role: 'user', content: prompt }, { role: 'assistant', content: story }];
    }

    res.json({ text: story });
  } catch (err) {
    console.error("❌ OpenAI error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Story generation failed' });
  }
});

// 🔊 ElevenLabs Text-to-Speech
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });

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
          stability: 0.5,
          similarity_boost: 0.7
        }
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("❌ TTS error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// 🔈 Get ElevenLabs Voices
app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      }
    });

    const voices = response.data.voices || [];
    res.json(voices);
  } catch (err) {
    console.error("❌ Voice fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Could not retrieve voices' });
  }
});

// 💾 Save Session
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  if (sessionId && Array.isArray(messages)) {
    sessions[sessionId] = messages;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid session data' });
  }
});

// 📥 Retrieve Session
app.get('/api/get-session', (req, res) => {
  const { sessionId } = req.query;
  res.json({ messages: sessions[sessionId] || [] });
});

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
