export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'No symbols provided' })

  const tickers = symbols.split(',').slice(0, 20) // max 20 tickers
  const results = {}

  await Promise.all(tickers.map(async (ticker) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10d`
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const data = await response.json()
      const result = data?.chart?.result?.[0]
      if (!result) return

      const meta = result.meta
      const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) || []
      const price = meta.regularMarketPrice || closes[closes.length - 1] || 0
      const prevClose = meta.previousClose || meta.chartPreviousClose || closes[closes.length - 2] || price
      const change = prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0

      results[ticker] = {
        ticker,
        name: meta.longName || meta.shortName || ticker,
        price: +price.toFixed(2),
        prevClose: +prevClose.toFixed(2),
        change,
        currency: meta.currency || 'USD',
        exchange: meta.exchangeName || '',
        high52: meta.fiftyTwoWeekHigh,
        low52: meta.fiftyTwoWeekLow,
        volume: meta.regularMarketVolume,
        history: closes.slice(-10).map(v => +v.toFixed(2)),
        timestamp: Date.now(),
      }
    } catch (e) {
      results[ticker] = { ticker, error: true, price: 0, change: 0 }
    }
  }))

  // Cache 60 segundos en Vercel Edge
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  return res.status(200).json({ ok: true, data: results, timestamp: Date.now() })
}
