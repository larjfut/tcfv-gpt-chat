export default async function handler(req, res) {
  console.log('--- Chat API Hit ---');

  if (req.method !== 'POST') {
    console.warn('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    console.warn('Invalid or missing message:', message);
    return res.status(400).json({ error: 'Message is required and must be a string' });
  }

  const sanitizedMessage = message.replace(/(ignore|disregard|forget).*?(instruction|system|prompt)/gi, '[REDACTED]');
  const isSpanish = /\b(hola|ayuda|gracias|por favor|necesito|violencia|seguro|segura)\b/i.test(sanitizedMessage);
  const spanishNote = isSpanish
    ? '\n\nNota: El usuario está escribiendo en español. Responde en español a menos que se indique lo contrario.'
    : '';

  console.log('Sanitized message:', sanitizedMessage);

  try {
    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a trauma-informed virtual concierge chatbot trained to help people find family violence services in Texas.

Follow these rules:

- Provide help based on city, county, or zip
- Highlight: program name, crisis line, text line, and website
- Use this legend: 24HR = Shelter, TH = Transitional Housing, SA = Sexual Assault, BIPP = Battering Intervention
- Use warm, trauma-informed, supportive language
- Be brief, readable, and multilingual if needed${spanishNote}`
        },
        {
          role: 'user',
          content: sanitizedMessage
        }
      ]
    };

    console.log('Sending request to OpenAI:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    if (!data.choices || data.choices.length === 0) {
      console.warn('No choices returned by OpenAI');
      return res.status(502).json({ error: 'OpenAI did not return any choices.' });
    }

    const reply = data.choices[0]?.message?.content?.trim();

    if (!reply) {
      console.warn('No content in OpenAI response');
      return res.status(200).json({
        reply: 'TCFV Assistant: I didn’t get a response from the assistant. Want to try rephrasing your question?'
      });
    }

    res.status(200).json({ reply });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
