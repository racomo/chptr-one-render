const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = 10000;
app.use(express.static(path.join(__dirname)));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Load preloaded stories
let preloadedStories = {};
try {
  preloadedStories = JSON.parse(fs.readFileSync('./preloadedStories.json', 'utf8'));
} catch (error) {
  console.error('Failed to load preloaded stories:', error);
}

// Determine greeting based on time
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

// GPT fallback wrapper
async function getChatResponse(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.warn('GPT-4 failed, falling back to GPT-3.5');
    const fallback = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
    });
    return fallback.choices[0].message.content;
  }
}

// Route: get voice options
app.get('/voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });
    const voices = response.data.voices.filter(v =>
      ['en', 'fr', 'es', 'da'].some(lang => v.labels?.accent?.toLowerCase().includes(lang))
    );
    res.json(voices);
  } catch (error) {
    console.error('Error fetching voices:', error.message);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Route: get cached story start
app.post('/story/start', (req, res) => {
  const { level, language } = req.body;
  const key = `${language}_${level}`.toLowerCase();
  const story = preloadedStories[key] || "Welcome. This story is not available yet.";
  res.json({ content: `${getTimeBasedGreeting()} ${story}` });
});

// Route: continue story or respond to question
app.post('/story/continue', async (req, res) => {
  const { history, language, level } = req.body;

  const messages = [
    { role: 'system', content: `You are a helpful AI teacher that speaks ${language}. Avoid references to TED talks.` },
    ...history,
  ];

  try {
    const reply = await getChatResponse(messages);
    res.json({ content: reply });
  } catch (error) {
    console.error('Error during story continuation:', error);
    res.status(500).json({ error: 'Failed to continue the story' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
