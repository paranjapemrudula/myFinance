import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import botAvatar from '../assets/assistant-bot.svg'

function AssistantChatbot() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Hi, I am your assistant. Choose what you want to do.',
      options: [
        { id: 'stock_information', label: 'Stock Information' },
        { id: 'metals_information', label: 'Metals Information' },
        { id: 'portfolio_navigation', label: 'Portfolio Navigation' },
        { id: 'market_news', label: 'Market & News Updates' },
      ],
    },
  ])

  const appendUser = (text) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
  }

  const appendBot = (text, options = []) => {
    setMessages((prev) => [...prev, { role: 'bot', text, options }])
  }

  const stockMenuOptions = useMemo(
    () => [
      { id: 'top_5_stocks', label: 'Top 5 Stocks' },
      { id: 'market_condition', label: 'Current Market Condition' },
      { id: 'best_investment_suggestions', label: 'Best Investment Suggestions' },
      { id: 'analyze_stock', label: 'Analyze a Stock' },
      { id: 'view_stock_trends', label: 'View Stock Trends' },
      { id: 'menu_home', label: 'Back to Main Menu' },
    ],
    []
  )

  const showMainMenu = () => {
    appendBot('Choose a section:', [
      { id: 'stock_information', label: 'Stock Information' },
      { id: 'metals_information', label: 'Metals Information' },
      { id: 'portfolio_navigation', label: 'Portfolio Navigation' },
      { id: 'market_news', label: 'Market & News Updates' },
    ])
  }

  const getCandidateSymbols = async () => {
    const symbols = new Set()

    const overview = await api.get('/api/market/overview/')
    ;(overview.data?.top_stocks || []).forEach((stock) => symbols.add(stock.symbol))

    const portfolioRes = await api.get('/api/portfolios/')
    const portfolios = portfolioRes.data || []
    const stockRes = await Promise.all(portfolios.slice(0, 5).map((item) => api.get(`/api/portfolios/${item.id}/stocks/`)))
    stockRes.forEach((res) => {
      ;(res.data || []).forEach((stock) => symbols.add(stock.symbol))
    })

    return Array.from(symbols).slice(0, 8)
  }

  const handleOption = async (option) => {
    appendUser(option.label)

    try {
      if (option.id === 'stock_information') {
        appendBot('Choose a stock info option:', stockMenuOptions)
        return
      }

      if (option.id === 'menu_home') {
        showMainMenu()
        return
      }

      if (option.id === 'portfolio_navigation') {
        appendBot('Choose where to go:', [
          { id: 'go_home', label: 'Open Home' },
          { id: 'go_portfolios', label: 'Open Portfolios' },
          { id: 'go_news', label: 'Open News' },
          { id: 'menu_home', label: 'Back to Main Menu' },
        ])
        return
      }

      if (option.id === 'metals_information') {
        appendBot('Choose metals options:', [
          { id: 'metals_live_prices', label: 'Gold & Silver Live Price' },
          { id: 'metals_correlation', label: 'Gold-Silver Correlation' },
          { id: 'metals_prediction', label: 'Gold & Silver Prediction' },
          { id: 'go_metals', label: 'Open Metals Page' },
          { id: 'menu_home', label: 'Back to Main Menu' },
        ])
        return
      }

      if (option.id === 'go_home') {
        navigate('/home')
        appendBot('Opening Home dashboard.', stockMenuOptions)
        return
      }

      if (option.id === 'go_portfolios') {
        navigate('/portfolios')
        appendBot('Opening Portfolios page.', stockMenuOptions)
        return
      }

      if (option.id === 'go_news') {
        navigate('/news')
        appendBot('Opening News page.', stockMenuOptions)
        return
      }

      if (option.id === 'go_metals') {
        navigate('/metals')
        appendBot('Opening Metals intelligence page.', [{ id: 'metals_information', label: 'Back to Metals Options' }])
        return
      }

      if (option.id === 'market_news') {
        const response = await api.get('/api/market/news/')
        const top = (response.data || []).slice(0, 3)
        const lines = top.map((item, index) => `${index + 1}. ${item.title}`)
        appendBot(`Latest highlights:\n${lines.join('\n')}`, [
          { id: 'go_news', label: 'Open Full News Page' },
          { id: 'menu_home', label: 'Back to Main Menu' },
        ])
        return
      }

      if (option.id === 'metals_live_prices') {
        const response = await api.get('/api/metals/live/?timeframe=1D')
        appendBot(
          `Live metals (USD):\nGold: ${response.data?.gold?.live_price ?? '-'}\nSilver: ${
            response.data?.silver?.live_price ?? '-'
          }`,
          [{ id: 'metals_information', label: 'Back to Metals Options' }, { id: 'go_metals', label: 'Open Metals Page' }]
        )
        return
      }

      if (option.id === 'metals_correlation') {
        const response = await api.get('/api/metals/correlation/?timeframe=1D')
        appendBot(
          `Gold-Silver correlation: ${response.data?.current_correlation ?? '-'} (${response.data?.relation || '-'})`,
          [{ id: 'metals_information', label: 'Back to Metals Options' }, { id: 'go_metals', label: 'Open Metals Page' }]
        )
        return
      }

      if (option.id === 'metals_prediction') {
        const [goldRes, silverRes] = await Promise.all([
          api.get('/api/metals/prediction/?metal=gold&timeframe=1D'),
          api.get('/api/metals/prediction/?metal=silver&timeframe=1D'),
        ])
        appendBot(
          `Outlook:\nGold: ${goldRes.data?.outlook || '-'}\nSilver: ${silverRes.data?.outlook || '-'}`,
          [{ id: 'metals_information', label: 'Back to Metals Options' }, { id: 'go_metals', label: 'Open Metals Page' }]
        )
        return
      }

      if (option.id === 'top_5_stocks') {
        const response = await api.get('/api/market/overview/')
        const items = response.data?.top_stocks || []
        const text = items
          .map((item, index) => `${index + 1}. ${item.symbol} | Last: ${item.last_value ?? '-'} | P/E: ${item.pe_ratio ?? '-'}`)
          .join('\n')
        appendBot(`Top 5 live stocks:\n${text}`, stockMenuOptions)
        return
      }

      if (option.id === 'market_condition') {
        const response = await api.get('/api/market/overview/')
        const items = response.data?.top_stocks || []
        let score = 0
        let count = 0
        items.forEach((item) => {
          const high = Number(item.high_365d)
          const low = Number(item.low_365d)
          const last = Number(item.last_value)
          if (!Number.isNaN(high) && !Number.isNaN(low) && !Number.isNaN(last) && high > low) {
            score += (last - low) / (high - low)
            count += 1
          }
        })
        const avg = count ? score / count : 0.5
        const condition = avg > 0.65 ? 'Bullish bias 📈' : avg < 0.35 ? 'Bearish pressure 📉' : 'Sideways / mixed ⚖️'
        appendBot(`Current market condition: ${condition}`, stockMenuOptions)
        return
      }

      if (option.id === 'best_investment_suggestions') {
        const response = await api.get('/api/market/overview/')
        const items = response.data?.top_stocks || []
        const scored = items
          .filter((item) => item.pe_ratio !== null && item.last_value !== null && item.high_365d !== null)
          .map((item) => ({
            ...item,
            upsidePct: ((item.high_365d - item.last_value) / item.last_value) * 100,
          }))
          .sort((a, b) => a.pe_ratio - b.pe_ratio || b.upsidePct - a.upsidePct)
          .slice(0, 3)
        const text = scored
          .map((item, index) => `${index + 1}. ${item.symbol} | P/E: ${item.pe_ratio} | Upside-to-365D-High: ${item.upsidePct.toFixed(1)}%`)
          .join('\n')
        appendBot(`Potential candidates right now:\n${text || 'Not enough data.'}`, stockMenuOptions)
        return
      }

      if (option.id === 'analyze_stock' || option.id === 'view_stock_trends') {
        const symbols = await getCandidateSymbols()
        appendBot('Choose a stock symbol:', [
          ...symbols.map((symbol) => ({
            id: option.id === 'analyze_stock' ? `choose_analyze_${symbol}` : `choose_trend_${symbol}`,
            label: symbol,
          })),
          { id: 'stock_information', label: 'Back to Stock Information' },
        ])
        return
      }

      if (option.id.startsWith('choose_analyze_')) {
        const symbol = option.id.replace('choose_analyze_', '')
        appendBot(`Choose analysis type for ${symbol}:`, [
          { id: `run_regression_${symbol}`, label: 'PE Graph (Regression)' },
          { id: `run_discount_${symbol}`, label: 'Discount Ratio Graph' },
          { id: `run_cluster_${symbol}`, label: 'Cluster Graph' },
          { id: 'stock_information', label: 'Back to Stock Information' },
        ])
        return
      }

      if (option.id.startsWith('run_regression_')) {
        const symbol = option.id.replace('run_regression_', '')
        const response = await api.get(`/api/analyze/regression/?symbol=${encodeURIComponent(symbol)}&timeframe=1D`)
        const dates = response.data?.dates || []
        const actual = response.data?.actual_close || []
        appendBot(
          `Regression summary for ${symbol}: ${dates.length} points. Latest close: ${actual.filter((v) => v !== null).slice(-1)[0] ?? '-'}.`,
          [{ id: 'analyze_stock', label: 'Analyze Another Stock' }, { id: 'go_portfolios', label: 'Open Graph Page' }]
        )
        return
      }

      if (option.id.startsWith('run_discount_')) {
        const symbol = option.id.replace('run_discount_', '')
        const response = await api.get(`/api/analyze/discount/?symbol=${encodeURIComponent(symbol)}&timeframe=1D`)
        const values = response.data?.discount_ratio || []
        const latest = values.slice(-1)[0]
        appendBot(`Discount summary for ${symbol}: ${values.length} points. Latest discount ratio: ${latest ?? '-'}%.`, [
          { id: 'analyze_stock', label: 'Analyze Another Stock' },
          { id: 'go_portfolios', label: 'Open Graph Page' },
        ])
        return
      }

      if (option.id.startsWith('run_cluster_')) {
        const symbol = option.id.replace('run_cluster_', '')
        const response = await api.get(`/api/analyze/clustering/?symbol=${encodeURIComponent(symbol)}&timeframe=1D`)
        const labels = response.data?.cluster_labels || {}
        const text = Object.entries(labels)
          .map(([id, name]) => `Cluster ${id}: ${name}`)
          .join('\n')
        appendBot(`Cluster summary for ${symbol}:\n${text || 'Cluster data loaded.'}`, [
          { id: 'analyze_stock', label: 'Analyze Another Stock' },
          { id: 'go_portfolios', label: 'Open Graph Page' },
        ])
        return
      }

      if (option.id.startsWith('choose_trend_')) {
        const symbol = option.id.replace('choose_trend_', '')
        appendBot(`Choose trend timeframe for ${symbol}:`, [
          { id: `trend_${symbol}_1D`, label: '1D Trend' },
          { id: `trend_${symbol}_1H`, label: '1H Trend' },
          { id: `trend_${symbol}_1M`, label: '1M Trend' },
          { id: 'stock_information', label: 'Back to Stock Information' },
        ])
        return
      }

      if (option.id.startsWith('trend_')) {
        const [, symbol, timeframe] = option.id.split('_')
        const response = await api.get(
          `/api/analyze/regression/?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
        )
        const actual = (response.data?.actual_close || []).filter((v) => v !== null)
        const first = actual[0]
        const last = actual[actual.length - 1]
        const dir = first && last ? (last > first ? 'uptrend 📈' : last < first ? 'downtrend 📉' : 'flat ⚖️') : 'mixed'
        appendBot(`${symbol} trend (${timeframe}): ${dir}. First=${first ?? '-'} Last=${last ?? '-'}`, [
          { id: 'view_stock_trends', label: 'View Another Trend' },
          { id: 'go_portfolios', label: 'Open Graph Page' },
        ])
        return
      }

      appendBot('Choose one of the available options.', [{ id: 'menu_home', label: 'Back to Main Menu' }])
    } catch {
      appendBot('Something went wrong while fetching data. Please try another option.', [
        { id: 'stock_information', label: 'Back to Stock Information' },
        { id: 'menu_home', label: 'Back to Main Menu' },
      ])
    }
  }

  return (
    <div className="assistant-widget">
      {isOpen ? (
        <div className="assistant-panel">
          <div className="assistant-head">
            <div className="assistant-head-left">
              <img src={botAvatar} alt="Assistant Bot" className="assistant-avatar" />
              <div>
                <strong>How can I help you?</strong>
                <p>Your Assistant</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
          <div className="assistant-body">
            {messages.map((msg, index) => (
              <div key={`${msg.role}-${index}`} className={`assistant-msg assistant-${msg.role}`}>
                <p>{msg.text}</p>
                {msg.options?.length ? (
                  <div className="assistant-options">
                    {msg.options.map((opt) => (
                      <button key={opt.id} type="button" onClick={() => handleOption(opt)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="assistant-fab" onClick={() => setIsOpen((prev) => !prev)}>
        <img src={botAvatar} alt="Assistant Bot" className="assistant-fab-avatar" />
      </button>
    </div>
  )
}

export default AssistantChatbot
