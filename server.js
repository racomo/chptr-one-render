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

// 🔹 TED-style intro per language
const languageIntros = {
  English: "Act like an accomplished speechwriter and public speaking coach. You mastered every precept from the book 'Talk like Ted'. Your expertise lies in crafting captivating and influential speeches, with a specialization in TED-style presentations. Your clients include executives, entrepreneurs, and thought leaders who seek to inspire and engage their audiences on global platforms. I am one of your clients, and here’s the needed context between angle brackets <>. <context>Learn about AI</context> Your objective is to help me create a public speaking script that resonates with the essence of a TED Talk. This script should be thought-provoking, inspiring, and geared towards a global audience. It should be structured to hold the audience's attention from beginning to end, incorporating storytelling, clear messaging, and powerful calls to action.",
  Spanish: "Actúa como un experto en oratoria y presentaciones al estilo TED. Has perfeccionado cada principio del libro 'Talk like Ted'. Tu especialidad es crear discursos cautivadores e influyentes. Tus clientes incluyen ejecutivos, emprendedores y líderes de pensamiento que buscan inspirar y conectar con audiencias globales. Yo soy uno de tus clientes, y aquí está el contexto entre corchetes <>. <context>Aprender sobre la IA</context> Tu objetivo es ayudarme a crear un guion que refleje el estilo TED. Debe ser inspirador, claro y adaptado a un público internacional.",
  French: "Agis comme un expert en discours et en présentations TED. Tu maîtrises tous les principes du livre 'Talk like Ted'. Ton expertise est de créer des discours captivants et influents. Tes clients sont des dirigeants, entrepreneurs et leaders d'opinion. Je suis l’un d’eux. Voici le contexte entre <>. <context>Découvrir l’IA</context>. Ton objectif est de rédiger un script qui capte l’attention, inspire et reste accessible.",
  Danish: "Opfør dig som en ekspert i offentlig tale og TED-lignende oplæg. Du mestrer alt fra 'Talk like Ted'. Dine kunder er ledere, iværksættere og formidlere, der ønsker at engagere et globalt publikum. Jeg er en af dine kunder. Her er konteksten mellem <>. <context>Lær om AI</context>. Dit mål er at skabe et manuskript, der inspirerer og vækker eftertanke."
};

// 🔹 Generate story using OpenAI
app.post('/generate-story', async (req, res) => {
  try {
    const { module, userName, language, level, voice } = req.body;

    const systemPrompt = languageIntros[language] || languageIntros['English'];

    const userPrompt = `Generate a TED-style story appropriate for a ${level} learner named ${userName}.\n${modulePrompts[module] || "Explain something interesting about AI."}`;

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
