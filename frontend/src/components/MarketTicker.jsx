import { useEffect, useMemo, useState } from 'react'
import { publicApi } from '../lib/api'

function MarketTicker() {
  const [overview, setOverview] = useState({ top_stocks: [], gold: null })

  useEffect(() => {
    const loadTicker = async () => {
      try {
        const response = await publicApi.get('/api/market/overview/')
        setOverview(response.data || { top_stocks: [], gold: null })
      } catch {
        setOverview({ top_stocks: [], gold: null })
      }
    }

    loadTicker()
    const timer = setInterval(loadTicker, 20000)
    return () => clearInterval(timer)
  }, [])

  const tickerItems = useMemo(() => {
    const stockItems = (overview.top_stocks || []).map((stock) => ({
      label: stock.symbol,
      value: stock.last_value ?? '-',
      meta: stock.pe_ratio !== null && stock.pe_ratio !== undefined ? `P/E ${stock.pe_ratio}` : 'Live',
    }))

    const goldItem = overview.gold
      ? [
          {
            label: 'GOLD',
            value: overview.gold.last_value ?? '-',
            meta: 'Futures',
          },
        ]
      : []

    const combined = [...stockItems, ...goldItem]
    return combined.length
      ? combined
      : [
          { label: 'MARKET', value: 'Live data loading', meta: 'Please wait' },
          { label: 'BTC', value: 'Watch crypto page', meta: 'Live' },
        ]
  }, [overview])

  const doubledItems = [...tickerItems, ...tickerItems]

  return (
    <div className="market-ticker-bar" aria-label="Live market ticker">
      <div className="market-ticker-track">
        {doubledItems.map((item, index) => (
          <div key={`${item.label}-${index}`} className="market-ticker-item">
            <strong>{item.label}</strong>
            <span>{item.value}</span>
            <small>{item.meta}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MarketTicker
