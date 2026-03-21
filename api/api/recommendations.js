export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(200).json({ error: 'No API key' })

  const { portfolio } = req.body || {}
  const portStr = portfolio?.length
    ? `Cartera actual del inversor: ${portfolio.map(p => `${p.ticker} (${p.name}): ${p.shares} títulos a coste €${p.cost}`).join(', ')}.`
    : 'El inversor está comenzando a construir cartera.'

  const prompt = `Eres un asesor financiero experto. ${portStr}

Perfil del inversor: español, cartera pequeña (<10.000€), 70% largo plazo + 30% oportunidades.

Contexto macro actual (marzo 2026): Estrecho de Ormuz cerrado, Brent $101, S&P500 -5%, VIX 28, Fed retrasa tipos a sept 2026, rearme europeo +40%, Goldman objetivo petróleo $150, JPMorgan objetivo oro $3.500.

Genera recomendaciones concretas y accionables organizadas en tres horizontes. Para cada recomendación incluye:
- Nombre y ticker exacto
- ISIN si es fondo/ETF
- Tipo: Acción / ETF / Fondo indexado
- Acción: COMPRAR / ACUMULAR / MANTENER / EVITAR
- Razón en 2 líneas máximas
- Precio aproximado actual
- Peso sugerido en cartera (%)

Responde ÚNICAMENTE en formato JSON válido, sin texto adicional, sin backticks, con esta estructura exacta:
{
  "updated": "marzo 2026",
  "short": [
    {"ticker":"XLE","name":"Energy Select Sector ETF","isin":"","type":"ETF","action":"COMPRAR","reason":"Ormuz cerrado dispara energía. Cobertura directa al petróleo sin riesgo empresa.","price":"$91","weight":8},
    {"ticker":"REP.MC","name":"Repsol","isin":"","type":"Acción","action":"COMPRAR","reason":"Goldman objetivo €24. Brent $100+ dispara márgenes refino.","price":"€14.50","weight":5}
  ],
  "medium": [
    {"ticker":"LMT","name":"Lockheed Martin","isin":"","type":"Acción","action":"COMPRAR","reason":"Rearme europeo +40%. Superciclo defensa estructural de años.","price":"$520","weight":6},
    {"ticker":"GLD","name":"SPDR Gold ETF","isin":"IE00B4L5Y983","type":"ETF","action":"AÑADIR","reason":"JPM objetivo $3.500. Refugio ante inflación y tensión geopolítica.","price":"$218","weight":6},
    {"ticker":"IBE.MC","name":"Iberdrola","isin":"","type":"Acción","action":"MANTENER","reason":"Utility defensiva. Crisis fósil acelera renovables. Tipos bajos sept benefician.","price":"€19","weight":10}
  ],
  "long": [
    {"ticker":"IWDA","name":"iShares Core MSCI World ETF","isin":"IE00B4L5Y983","type":"ETF","action":"ACUMULAR","reason":"Corrección -5% es oportunidad de entrada. 1.500 empresas globales. TER 0.20%.","price":"€95","weight":25},
    {"ticker":"VWRL","name":"Vanguard FTSE All-World ETF","isin":"IE00B3RBWM25","type":"ETF","action":"ACUMULAR","reason":"2.700 empresas de 50 países. El ETF más diversificado del mundo. TER 0.22%.","price":"$108","weight":20},
    {"ticker":"CSPX","name":"iShares Core S&P 500 ETF","isin":"IE00B5BMR087","type":"ETF","action":"ACUMULAR","reason":"S&P500 en corrección = mejor punto de entrada en 18 meses. TER 0.07%.","price":"$580","weight":15},
    {"ticker":"NVDA","name":"NVIDIA","isin":"","type":"Acción","action":"ACUMULAR","reason":"Tesis IA estructural. Solo acumular en caídas >15%. No perseguir rallies.","price":"$875","weight":8}
  ],
  "avoid": [
    {"ticker":"IAG.MC","name":"IAG (Iberia/BA)","reason":"Brent $100 destruye márgenes aerolíneas."},
    {"ticker":"ICLN","name":"ETF Renovables Solares","reason":"Aranceles + demanda -18%. Evitar hasta 2027."},
    {"ticker":"ARKK","name":"ARK Innovation ETF","reason":"Growth especulativo en entorno risk-off y tipos altos."}
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: 'Eres un asesor financiero experto. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.map(b => b.text || '').join('') || ''

    // Parse JSON
    const clean = text.replace(/```json|```/g, '').trim()
    const json = JSON.parse(clean)

    res.setHeader('Cache-Control', 's-maxage=3600')
    return res.status(200).json({ ok: true, data: json })
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message })
  }
}
