export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string' });
  }

  // Basic prompt injection protection
  const sanitizedMessage = message.replace(/(ignore|disregard|forget).*?(instruction|system|prompt)/gi, '[REDACTED]');
  const isSpanish = /\b(hola|ayuda|gracias|por favor|necesito|violencia|seguro|segura)\b/i.test(sanitizedMessage);
  const spanishNote = isSpanish
    ? '\n\nNota: El usuario está escribiendo en español. Responde en español a menos que se indique lo contrario.'
    : '';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
