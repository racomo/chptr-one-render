
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

app.post('/generate-story', async (req, res) => {
  try {
    const { prompt, userName, language, level, voice } = req.body;

    const systemPrompt = `
You are the narrator of a story that introduces AI. Use the user's name (${userName}), speak in ${language}, and match the user's level (${level}).
Keep it engaging and friendly.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.7
    });

    res.json({ story: completion.choices[0].message.content });

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate story.' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port 3000');
});
