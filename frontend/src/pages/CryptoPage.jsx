import { useEffect, useMemo, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

function CryptoPage() {
  const [query, setQuery] = useState('Bit')
  const [suggestions, setSuggestions] = useState([])
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [regressionData, setRegressionData] = useState(null)
  const [forecastData, setForecastData] = useState(null)
  const [forecastModel, setForecastModel] = useState('arima')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/api/crypto/suggest/?q=${encodeURIComponent(query.trim())}`)
        setSuggestions(response.data)
      } catch {
        setSuggestions([])
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const loadLiveData = async (symbol) => {
    const response = await api.get(`/api/crypto/live/?symbol=${encodeURIComponent(symbol)}`)
    setLiveData(response.data)
  }

  const loadRegressionData = async (symbol) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/api/crypto/regression/?symbol=${encodeURIComponent(symbol)}`)
      setRegressionData(response.data)
      setForecastData(null)
    } catch {
      setError('Unable to load regression insights for this crypto asset.')
    } finally {
      setLoading(false)
    }
  }

  const loadForecastData = async (symbol, model) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(
        `/api/crypto/forecast/?symbol=${encodeURIComponent(symbol)}&model=${encodeURIComponent(model)}`
      )
      setForecastData(response.data)
      setForecastModel(model)
      setRegressionData(null)
    } catch {
      setError(`Unable to load ${model.toUpperCase()} forecast for this crypto asset.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAsset = async (asset) => {
    setSelectedAsset(asset)
    setQuery(asset.name)
    setSuggestions([])
    setRegressionData(null)
    setForecastData(null)
    setError('')

    try {
      await loadLiveData(asset.symbol)
    } catch {
      setError('Unable to load BTC-USD live data right now.')
    }
  }

  useEffect(() => {
    const defaultAsset = { symbol: 'BTC-USD', name: 'Bitcoin / US Dollar' }
    handleSelectAsset(defaultAsset)
  }, [])

  const liveChartData = useMemo(() => {
    if (!liveData) return null
    return {
      labels: liveData.dates || [],
      datasets: [
        {
          label: `${liveData.symbol} close`,
          data: liveData.prices || [],
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.18)',
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    }
  }, [liveData])

  const regressionChartData = useMemo(() => {
    if (!regressionData) return null
    return {
      labels: regressionData.dates || [],
      datasets: [
        {
          label: 'Actual BTC-USD',
          data: regressionData.actual_close || [],
          borderColor: '#0a9396',
          backgroundColor: 'rgba(10, 147, 150, 0.18)',
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'Linear Regression',
          data: regressionData.linear_predicted_close || [],
          borderColor: '#ee9b00',
          backgroundColor: 'rgba(238, 155, 0, 0.18)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    }
  }, [regressionData])

  const forecastChartData = useMemo(() => {
    if (!forecastData) return null
    return {
      labels: forecastData.dates || [],
      datasets: [
        {
          label: 'Actual BTC-USD',
          data: forecastData.actual_close || [],
          borderColor: '#005f73',
          backgroundColor: 'rgba(0, 95, 115, 0.18)',
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: `${forecastData.model} Forecast`,
          data: forecastData.predicted_close || [],
          borderColor: '#bb3e03',
          backgroundColor: 'rgba(187, 62, 3, 0.18)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    }
  }, [forecastData])

  return (
    <AppShell title="Crypto">
      <section className="dashboard-hero">
        <div>
          <h2>BTC-USD Analytics</h2>
          <p>Live Bitcoin pricing from yfinance with 2-year regression, ARIMA, and LSTM forecasting.</p>
        </div>
      </section>

      <section className="stock-search-panel">
        <div className="search-wrap">
          <input
            name="crypto-query"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Bitcoin / BTC-USD"
          />
          {suggestions.length > 0 ? (
            <div className="suggestions-box">
              {suggestions.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className="suggestion-item suggestion-item-rich"
                  onClick={() => handleSelectAsset(item)}
                >
                  <div>
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {liveData ? (
        <section className="crypto-grid">
          <article className="metals-card">
            <h3>{selectedAsset?.name || liveData.name}</h3>
            <div className="metals-metrics">
              <span>Live Price: {liveData.live_price ?? '-'} USD</span>
              <span>24H Move: {liveData.change_pct_24h ?? '-'}%</span>
            </div>
            {liveChartData ? (
              <div className="chart-wrap">
                <Line data={liveChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : null}
          </article>

          <article className="metals-card">
            <h3>Choose Analysis</h3>
            <p className="muted">Option 1 combines linear regression with logistic direction probability.</p>
            <div className="crypto-actions">
              <button
                className="button"
                type="button"
                disabled={loading || !selectedAsset}
                onClick={() => loadRegressionData(selectedAsset.symbol)}
              >
                Regression: Linear + Logistic
              </button>
            </div>
            <p className="muted">Option 2 gives sequential forecasts with ARIMA or LSTM.</p>
            <div className="crypto-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={loading || !selectedAsset}
                onClick={() => loadForecastData(selectedAsset.symbol, 'arima')}
              >
                Forecast with ARIMA
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={loading || !selectedAsset}
                onClick={() => loadForecastData(selectedAsset.symbol, 'lstm')}
              >
                Forecast with LSTM
              </button>
            </div>
            {loading ? <p>Loading analysis...</p> : null}
          </article>
        </section>
      ) : null}

      {regressionData ? (
        <section className="analysis-panel">
          <div className="analysis-panel-head">
            <h3>Regression Stack for {regressionData.symbol}</h3>
          </div>
          <div className="metals-metrics">
            <span>Logistic Up Probability: {(regressionData.logistic?.up_probability ?? 0) * 100}%</span>
            <span>Logistic Signal: {regressionData.logistic?.signal || '-'}</span>
            <span>Next Linear Target: {regressionData.linear_predicted_close?.slice(-1)[0] ?? '-'}</span>
          </div>
          {regressionChartData ? (
            <div className="chart-wrap">
              <Line data={regressionChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          ) : null}
        </section>
      ) : null}

      {forecastData ? (
        <section className="analysis-panel">
          <div className="analysis-panel-head">
            <h3>
              {forecastData.model} Forecast for {forecastData.symbol}
            </h3>
            <span className="user-chip">{forecastModel.toUpperCase()}</span>
          </div>
          <div className="metals-metrics">
            <span>Next Projected Price: {forecastData.next_prediction ?? '-'}</span>
            <span>Lookback Window: 2 years daily data</span>
          </div>
          {forecastChartData ? (
            <div className="chart-wrap">
              <Line data={forecastChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  )
}

export default CryptoPage
