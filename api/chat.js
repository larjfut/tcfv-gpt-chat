// File: /api/chat.js
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import crypto from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load vector store from file
const storePath = path.resolve(process.cwd(), 'vector_store.json');
const vectorStore = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

// Embed a string using OpenAI
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

// Calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const embeddedQuestion = await embedText(message);

    // Rank all chunks by similarity
    const scored = vectorStore.map(chunk => {
      const score = cosineSimilarity(chunk.embedding, embeddedQuestion);
      return { ...chunk, score };
    });

    // Get top 5 most relevant chunks
    const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);
    const context = topChunks.map(c => c.text).join('\n---\n');

    const systemPrompt = `You are the TCFV Assistant: a trauma-informed, knowledgeable, respectful, and accurate guide for survivors of family violence and those helping them. Use the information below to answer the user’s question. If unsure, say so honestly.\n\nKnowledge Base:\n${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });
 } catch (err) {
  console.error("Server error:", err);
  res.setHeader("Content-Type", "application/json");
  res.status(500).json({
    error: 'Server error occurred',
    details: err.message || 'No details available'
  });
}

