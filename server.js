const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = process.env.PORT || 10000;

// Serve static and start page
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.get('/start', (req, res) => res.sendFile(path.join(__dirname, 'start.html')));

// Load cached template JSONs
let preloadedStories = {};
try { preloadedStories = JSON.parse(fs.readFileSync('./preloadedStories.json')); } catch {}
let storyCache = {};
try { storyCache = JSON.parse(fs.readFileSync('./storyCache.json')); } catch {}

function getStoryIntro(level, lang) {
  if (preloadedStories[lang]?.[level]?.length) {
    const arr = preloadedStories[lang][level];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  return storyCache[`${lang}_${level}`] || "Let's explore AI together.";
}

// Session store
const sessions = {};
app.get('/api/get-session', (req, res) => {
  const { sessionId } = req.query;
  res.json({ messages: sessions[sessionId] || [] });
});
app.post('/api/save-session', (req, res) => {
  const { sessionId, messages } = req.body;
  if (sessionId && Array.isArray(messages)) {
    sessions[sessionId] = messages;
    return res.json({ success: true });
  }
  res.status(400).json({ error: 'Invalid session' });
});

// Story generator with GPT-4 -> GPT-3.5 fallback
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages = [], userName, level, language } = req.body;
  const intro = getStoryIntro(level, language);

  const systemPrompt = `
You are a friendly, personalized narrator tailored to one user: ${userName || 'the listener'}.
Speak in ${language}, at a ${level} level. No TED references or time-of-day greetings.
`;

  const conversation = [
    { role: 'system', content: systemPrompt },
    ...messages,
    { role: 'user', content: intro },
    { role: 'user', content: prompt }
  ];

  try {
    const gpt = await openai.chat.completions.create({ model: 'gpt-4', messages: conversation, temperature: 0.7, max_tokens: 600 });
    const output = gpt.choices[0].message.content.trim();
    if (!output) throw new Error('Empty');
    sessions[sessionId] = conversation.concat({ role: 'assistant', content: output });
    return res.json({ text: output });
  } catch (e) {
    console.warn('❗ GPT‑4 failed:', e.message);
    try {
      const fallback = await openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages: conversation, temperature: 0.7, max_tokens: 600 });
      const out = fallback.choices[0].message.content.trim();
      sessions[sessionId] = conversation.concat({ role: 'assistant', content: out });
      return res.json({ text: out });
    } catch (e2) {
      console.error('❌ Fallback failed too:', e2.message);
      return res.status(500).json({ error: 'AI unavailable' });
    }
  }
});

// TTS endpoint
app.post('/api/narrate', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId.' });
  try {
    const r = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      responseType: 'arraybuffer',
      data: { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.7 } }
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(r.data);
  } catch (err) {
    console.error('❌ Narration error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// Voice selector with filtered languages
app.get('/api/get-voices', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    const langs = ['en', 'es', 'fr', 'da'];
    const voices = data.voices.filter(v => langs.includes(v.labels?.language));
    res.json(voices);
  } catch (err) {
    console.error('❌ Voice fetch failed:', err.message);
    res.status(500).json({ error: 'Voice fetch failed' });
  }
});

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
const streamVoiceRoute = require('./stream');
app.use('/', streamVoiceRoute);
