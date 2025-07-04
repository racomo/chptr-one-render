const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PORT = process.env.PORT || 10000;

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Explicitly serve start.html
app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// Load cached story template
let storyCache = {};
try {
  const cacheData = fs.readFileSync('./storyCache.json');
  storyCache = JSON.parse(cacheData);
} catch (error) {
  console.warn('⚠️ No story cache found or invalid JSON.');
}

// Load preloaded story templates
let preloadedStories = {};
try {
  const preloadData = fs.readFileSync('./preloadedStories.json');
  preloadedStories = JSON.parse(preloadData);
} catch (error) {
  console.warn('⚠️ No preloaded stories found or invalid JSON.');
}

// Helper: select story based on level and language
function getStoryIntro(level, language) {
  if (preloadedStories[language] && preloadedStories[language][level]) {
    const variants = preloadedStories[language][level];
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }
  return `Let’s explore AI together.`; // fallback
}

// POST endpoint to get GPT-generated story
app.post('/generate-story', async (req, res) => {
  const { userName, level, language } = req.body;

  const storyPrompt = `
Your role is a friendly voice-driven narrator.
Do NOT mention TED or time of day (no 'good evening').
Narrate the story in ${language}, in a ${level} tone for ${userName}.
Begin with an inspiring story about someone curious about AI.
Keep it short and engaging like a podcast.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: storyPrompt },
        { role: 'user', content: getStoryIntro(level, language) }
      ],
      temperature: 0.7
    });

    const content = completion.choices[0].message.content;
    res.json({ story: content });
  } catch (error) {
    console.error('❌ GPT-4 failed, using fallback.', error.message);

    // Fallback to GPT-3.5
    try {
      const fallback = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: storyPrompt },
          { role: 'user', content: getStoryIntro(level, language) }
        ],
        temperature: 0.7
      ]);
      const content = fallback.choices[0].message.content;
      res.json({ story: content });
    } catch (fallbackErr) {
      console.error('❌ GPT-3.5 also failed.', fallbackErr.message);
      res.status(500).json({ error: 'Both GPT models failed.' });
    }
  }
});

// Voice dropdown filter by language (reduced persona set)
app.get('/voices', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });

    const preferred = ['en', 'es', 'fr', 'da'];
    const bestVoices = data.voices.filter(v => preferred.includes(v.labels?.language));
    res.json(bestVoices);
  } catch (err) {
    console.error('Failed to load voices', err.message);
    res.status(500).json({ error: 'Voice fetch failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});