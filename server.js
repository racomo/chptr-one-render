const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// In-memory cache for fallback story templates
const storyCache = {
  en: {
    beginner: ["Let’s take a simple walk into the world of AI. Imagine you’re baking a cake…"],
    intermediate: ["AI isn't magic — it's logic. Imagine you're building a Lego robot…"],
    advanced: ["The boundary between neural networks and consciousness is blurring…"]
  },
  es: {
    beginner: ["Vamos a descubrir la inteligencia artificial como si fuera una historia sencilla…"],
    intermediate: ["La IA no es magia, es lógica. Imagina que programas un robot para ayudarte…"],
    advanced: ["La frontera entre las redes neuronales y la conciencia se vuelve difusa…"]
  },
  fr: {
    beginner: ["Découvrons l’IA ensemble, comme une histoire racontée autour d’un feu de camp…"],
    intermediate: ["L’intelligence artificielle n’est pas un mystère, mais une mécanique fascinante…"],
    advanced: ["À mesure que les algorithmes deviennent plus complexes, une question émerge…"]
  },
  da: {
    beginner: ["Forestil dig, at AI er som en hjælpsom ven, der forstår dig bedre hver dag…"],
    intermediate: ["AI handler ikke kun om data — det handler om at forstå og handle…"],
    advanced: ["I takt med at algoritmer udvikler sig, nærmer vi os noget dybere…"]
  }
};

// Helper: context-aware greeting
function getGreeting() {
  const now = new Date();
  const hour = now.getUTCHours() + 2; // CET
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";
  return "Hello";
}

// Serve UI pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/start', (req, res) => res.sendFile(path.join(__dirname, 'start.html')));

// In-memory session store
const sessions = {};
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

// Generate Personalized Story
app.post('/api/generate-story', async (req, res) => {
  const { prompt, sessionId, messages = [], userName, language = 'en', level = 'beginner' } = req.body;
  const greeting = getGreeting();
  const userLabel = userName || "the listener";

  const baseSystemPrompt = `${greeting}, ${userLabel}. You are a powerful storyteller delivering personalized insight — not a TED speaker. Speak with clarity, emotional depth, and always adapt to the user's level (${level}). Avoid repeating 'TED talk' references.`;

  const openAIRequest = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: baseSystemPrompt },
      ...messages,
      { role: 'user', content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 1200
  };

  try {
    const result = await openai.chat.completions.create(openAIRequest);
    const story = result.choices?.[0]?.message?.content?.trim();

    if (!story) throw new Error("GPT-4 returned empty.");

    if (sessionId) sessions[sessionId] = [...messages, { role: 'assistant', content: story }];
    res.json({ text: story });
  } catch (err) {
    console.warn("⚠️ GPT-4 failed, retrying with GPT-3.5:", err.message);

    try {
      const fallbackResult = await openai.chat.completions.create({
        ...openAIRequest,
        model: 'gpt-3.5-turbo'
      });
      const fallbackStory = fallbackResult.choices?.[0]?.message?.content?.trim();

      if (sessionId) sessions[sessionId] = [...messages, { role: 'assistant', content: fallbackStory }];
      res.json({ text: fallbackStory || storyCache[language]?.[level] || "Let’s explore something amazing together…" });
    } catch (fallbackError) {
      console.error("❌ GPT-3.5 fallback failed:", fallbackError.message);
      res.json({ text: storyCache[language]?.[level] || "Let’s explore something amazing together…" });
    }
  }
});

// ElevenLabs Narration
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
        voice_settings: { stability: 0.4, similarity_boost: 0.7 }
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("❌ Narration error:", err.message);
    res.status(500).json({ error: 'Narration failed' });
  }
});

// Filter voices by language tag
app.get('/api/get-voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });

    const voices = response.data.voices.filter(v => {
      const tags = (v.labels?.language || '').toLowerCase();
      return ['english', 'spanish', 'french', 'danish'].some(lang => tags.includes(lang));
    });

    res.json(voices);
  } catch (error) {
    console.error("❌ Failed to fetch voices:", error.message);
    res.status(500).json({ error: 'Could not fetch voices' });
  }
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
