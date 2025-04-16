// File: /api/chat.js
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = 'asst_jKfwAJceQdVe0J9YEUtSkVuu';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // 1. Create a thread
    const thread = await openai.beta.threads.create();

    // 2. Add user message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message
    });

    // 3. Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    // 4. Wait for the run to complete (polling)
    let runStatus = run;
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === 'failed') {
      throw new Error('Run failed: ' + runStatus.last_error?.message);
    }

    // 5. Retrieve the assistant's message
    const messages = await openai.beta.threads.messages.list(thread.id);
    const reply = messages.data[0].content[0].text.value;

    res.status(200).json({ reply });
  } catch (err) {
    console.error('❌ Assistant error:', err);
    res.status(500).json({
      error: 'A server error occurred.',
      details: err.message
    });
  }
}
