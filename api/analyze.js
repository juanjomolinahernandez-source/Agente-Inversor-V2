export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      text: '## Sin API Key\n\nAñade ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables y redespliega.'
    })
  }

  try {
    const { prompt } = req.body

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system: 'Eres analista financiero experto en mercado español. Directo, preciso, sin clichés. Responde en español. Usa ## para secciones y ** para negrita.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.map(b => b.text || '').join('') || data.error?.message || 'Sin respuesta.'

    return res.status(200).json({ text })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
