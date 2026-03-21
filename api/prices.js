export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'No symbols provided' })

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return res.status(200).json({ ok: false, error: 'No FINNHUB_API_KEY set' })

  const tickers = symbols.split(',').slice(0, 20)
  const results = {}

  await Promise.all(tickers.map(async (ticker) => {
    try {
      let fhSymbol = ticker
      if (ticker.endsWith('.MC')) fhSymbol = ticker.replace('.MC', '')

      const quoteRes = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSymbol)}&token=${apiKey}`
      )
      const quote = await quoteRes.json()

      const profileRes = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(fhSymbol)}&token=${apiKey}`
      )
      const profile = await profileRes.json()

      if (quote && quote.c && quote.c > 0) {
        const price = quote.c
        const prevClose = quote.pc || price
        const change = prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0
        const isBME = ticker.endsWith('.MC')
        const isEUR = isBME || profile?.currency === 'EUR'

        results[ticker] = {
          ticker,
          name: profile?.name || ticker,
          price: +price.toFixed(2),
          prevClose: +prevClose.toFixed(2),
          high: quote.h,
          low: quote.l,
          change,
          currency: isEUR ? 'EUR' : (profile?.currency || 'USD'),
          exchange: profile?.exchange || '',
          industry: profile?.finnhubIndustry || '',
          timestamp: Date.now(),
        }
      } else {
        // Retry with full ticker (for ETFs like SPY, GLD)
        const q2 = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`)
        const quote2 = await q2.json()
        if (quote2 && quote2.c && quote2.c > 0) {
          const price = quote2.c
          const prevClose = quote2.pc || price
          results[ticker] = {
            ticker, name: ticker,
            price: +price.toFixed(2), prevClose: +prevClose.toFixed(2),
            change: prevClose ? +((price-prevClose)/prevClose*100).toFixed(2) : 0,
            currency: 'USD', timestamp: Date.now(),
          }
        } else {
          results[ticker] = { ticker, error: true, price: 0, change: 0 }
        }
      }
    } catch (e) {
      results[ticker] = { ticker, error: true, price: 0, change: 0 }
    }
  }))

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  return res.status(200).json({ ok: true, data: results, timestamp: Date.now() })
}
