const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

// ✅ Initialize OpenAI properly for SDK v4+
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// 🎙️ AI Story Generator
app.post('/api/generate-story', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Act like an accomplished speechwriter and public speaking coach.
You mastered every precept from the book "Talk like TED".
Your expertise lies in crafting captivating and influential TED-style talks for global audiences.
Structure your response like a compelling story built for listening, not reading. Keep it simple, clear, and emotional.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.85
    });

    console.log("✅ OpenAI raw response:", JSON.stringify(completion, null, 2));
    const result = completion?.choices?.[0]?.message?.content?.trim();

    if (!result) {
      console.error("❌ No story returned from OpenAI");
      return res.status(500).json({ error: 'Story generation failed.' });
    }

    res.json({ text: result });
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
    console.error("❌ Narration error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// 🌍 Port Listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
