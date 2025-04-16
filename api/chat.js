let threadId = null; // Optional: store in session if you want chat memory

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string' });
  }

  try {
    // 1. Create thread if not created yet
    if (!threadId) {
      const threadRes = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const threadData = await threadRes.json();
      threadId = threadData.id;
    }

    // 2. Add user message to thread
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'user',
        content: message
      })
    });

    // 3. Run the assistant using your Assistant ID
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistant_id: 'asst_jKfwAJceQdVe0J9YEUtSkVuu',
        instructions: "Answer using trauma-informed language. Prioritize file knowledge first."
      })
    });

    const runData = await runRes.json();
    const runId = runData.id;

    // 4. Poll for completion
    let status = 'in_progress';
    while (status !== 'completed' && status !== 'failed') {
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      const statusData = await statusRes.json();
      status = statusData.status;

      if (status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s
      }
    }

    // 5. Get the assistant's latest message
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const messagesData = await messagesRes.json();
    const reply = messagesData.data
      .reverse()
      .find(m => m.role === 'assistant')?.content[0]?.text?.value || 'No response from assistant.';

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Assistants API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
