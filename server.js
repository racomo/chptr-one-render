const express = require('express');
const app = express();
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Serve static files (CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// 🔹 Serve the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔹 Serve the start page
app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'start.html'));
});

// 🔹 Learning module prompts
const modulePrompts = {
  what_is_ai: "Explain what Artificial Intelligence is in simple terms. Use relatable examples and be friendly.",
  problem_solving: "Describe how AI can be used to solve everyday problems, from navigation to health and beyond.",
  real_world: "Share real-world examples of AI that people use today, like recommendation systems or voice assistants.",
  machine_learning: "Introduce the concept of machine learning and how AI improves through data and feedback.",
  neural_networks: "Explain how neural networks mimic the human brain to perform tasks like image recognition.",
  implications: "Talk about the ethical implications of AI and how it can affect jobs, bias, and privacy."
};

// 🔹 Generate story using OpenAI
app.post('/generate-story', async (req, res) => {
  try {
    const { module, userName, language, level, voice } = req.body;

    const systemPrompt = `
You are the narrator of an engaging AI lesson. The user is called ${userName}, speaks ${language}, and is currently at a ${level} level.
Adapt the tone accordingly. The topic is: ${module}.
`;

    const userPrompt = modulePrompts[module] || "Explain something interesting about AI.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.7
    });

    res.json({ story: completion.choices[0].message.content });

  } catch (error) {
    console.error("Error generating story:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// 🔹 Narrate using ElevenLabs
app.post('/narrate', async (req, res) => {
  const { text, voice } = req.body;

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      data: {
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.7
        }
      }
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked'
    });

    response.data.pipe(res);
  } catch (error) {
    console.error("Error narrating story:", error.response?.data || error.message);
    res.status(500).json({ error: 'Voice synthesis failed.' });
  }
});

// ✅ Start server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port 3000');
});
