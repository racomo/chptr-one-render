const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(compression());
app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: false
}));

// Simple in-memory session store
const sessions = {};

// 🌍 Serve Static Pages
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/start', (_, res) => res.sendFile(path.join(__dirname, 'start.html')));

// 🔹 Session APIs
app.get('/api/get-session', (req, res) => {
  const { sessionId } = req.query;
  res.json({ messages: sessions[sessionId] || [] });
});

app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  if (sessionId && Array.isArray(messages)) {
    sessions[sessionId] = messages;
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid session data' });
  }
});

// 🧠 Generate AI Story
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages = [], userName } = req.body;

  console.log(`📝 [${userName || 'User'}] Prompt:`, prompt);

  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're an inspiring TED-style speaker. Craft an emotionally engaging monologue for one listener — ${userName || "the user"}. Match their level, and use personal, direct tone. End naturally or invite them to continue.`
        },
        ...messages,
        {
          role: 'user',
          content: prompt
        }
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
  } catch (error) {
    console.error("❌ Error generating story:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// 🔊 ElevenLabs Narration
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
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      responseType: 'arraybuffer',
      timeout: 15000,
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
    console.error("❌ Narration error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// 🎙️ Get ElevenLabs Voices
app.get('/api/get-voices', async (_, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Connection': 'keep-alive'
      },
      timeout: 10000
    });

    const voices = response.data.voices || [];
    res.json(voices);
  } catch (error) {
    console.error("❌ Failed to fetch voices:", error.response?.data || error.message);
    res.status(500).json({ error: 'Could not fetch voices' });
  }
});

// 🚀 Launch Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Optimized server running on http://localhost:${PORT}`);
});
