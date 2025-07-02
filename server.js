const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/start', (req, res) => res.sendFile(path.join(__dirname, 'start.html')));

// 🧠 In-memory sessions and voice cache
const sessions = {};
let voiceCache = null;
let lastVoiceFetch = 0;

// 📦 Get saved session
app.get('/api/get-session', (req, res) => {
  const { sessionId } = req.query;
  res.json({ messages: sessions[sessionId] || [] });
});

// 💾 Save session
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  if (sessionId && Array.isArray(messages)) {
    sessions[sessionId] = messages;
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid session data' });
  }
});

// 🧠 Generate personalized story with streaming
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages = [], userName } = req.body;
  console.log(`📝 [${userName || 'User'}] Prompt:`, prompt);

  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're an accomplished TED-style speaker. Your job is to create a highly personal talk, tailored to one person — named ${userName || "the listener"}. Make the tone inspiring and emotionally engaging, and adjust the depth to match their learning level. End with a natural pause or invitation to continue.`
        },
        ...messages,
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

    if (sessionId) sessions[sessionId] = [...messages, { role: 'assistant', content: story }];
    res.json({ text: story });
  } catch (err) {
    console.error("❌ Story error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// 🔊 ElevenLabs Narration (stream-ready)
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;

  if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId.' });

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
        voice_settings: { stability: 0.5, similarity_boost: 0.7 }
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("❌ Narration error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// 🎙️ Voice list with 10-min cache
app.get('/api/get-voices', async (req, res) => {
  const now = Date.now();
  if (voiceCache && now - lastVoiceFetch < 10 * 60 * 1000) {
    return res.json(voiceCache);
  }

  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });

    voiceCache = response.data.voices || [];
    lastVoiceFetch = now;
    res.json(voiceCache);
  } catch (error) {
    console.error("❌ Voice fetch error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Could not fetch voices' });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
