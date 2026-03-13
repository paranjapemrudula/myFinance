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

const horizonOptions = [
  { value: '1M', label: '1 Month' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
]

const modelMeta = {
  linear: {
    title: '📈 Linear Regression',
    description: 'Best when you want a clean trend-based projection of BTC price over the selected range.',
  },
  logistic: {
    title: '🎯 Logistic Regression',
    description: 'Best when you want a directional signal that estimates the probability of BTC moving up next.',
  },
  arima: {
    title: '🔮 ARIMA Forecast',
    description: 'Best when you want a classical time-series forecast that follows historical BTC structure.',
  },
  lstm: {
    title: '🤖 LSTM Forecast',
    description: 'Best when you want a neural sequence model that learns longer BTC price patterns.',
  },
}

function CryptoPage() {
  const [liveData, setLiveData] = useState(null)
  const [selectedModel, setSelectedModel] = useState('linear')
  const [selectedData, setSelectedData] = useState(null)
  const [forecastHorizon, setForecastHorizon] = useState('3M')
  const [loadingKey, setLoadingKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadLiveData = async () => {
      try {
        const response = await api.get('/api/crypto/live/?symbol=BTC-USD')
        setLiveData(response.data)
      } catch {
        setError('Unable to load BTC-USD live data right now.')
      }
    }

    loadLiveData()
  }, [])

  useEffect(() => {
    const loadSelectedModel = async () => {
      setLoadingKey(selectedModel)
      setError('')

      try {
        let response
        if (selectedModel === 'linear') {
          response = await api.get(
            `/api/crypto/linear-regression/?symbol=BTC-USD&horizon=${encodeURIComponent(forecastHorizon)}`
          )
        } else if (selectedModel === 'logistic') {
          response = await api.get('/api/crypto/logistic-regression/?symbol=BTC-USD')
        } else {
          response = await api.get(
            `/api/crypto/forecast/?symbol=BTC-USD&model=${encodeURIComponent(selectedModel)}&horizon=${encodeURIComponent(
              forecastHorizon
            )}`
          )
        }
        setSelectedData(response.data)
      } catch {
        setError(`Unable to load ${selectedModel.toUpperCase()} analysis for BTC-USD.`)
      } finally {
        setLoadingKey('')
      }
    }

    loadSelectedModel()
  }, [selectedModel, forecastHorizon])

  const liveChartData = useMemo(() => {
    if (!liveData) return null
    return {
      labels: liveData.dates || [],
      datasets: [
        {
          label: 'Actual BTC-USD',
          data: liveData.prices || [],
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.16)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.28,
        },
      ],
    }
  }, [liveData])

  const analysisChartData = useMemo(() => {
    if (!selectedData) return null

    if (selectedModel === 'logistic') {
      return {
        labels: selectedData.dates || [],
        datasets: [
          {
            label: 'Up Probability (%)',
            data: selectedData.up_probability_series || [],
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.16)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.28,
          },
        ],
      }
    }

    return {
      labels: selectedData.dates || [],
      datasets: [
        {
          label: 'Actual BTC-USD',
          data: selectedData.actual_close || [],
          borderColor: '#0a9396',
          backgroundColor: 'rgba(10, 147, 150, 0.16)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.28,
        },
        {
          label:
            selectedModel === 'linear'
              ? 'Predicted BTC-USD'
              : `${selectedData.model || selectedModel.toUpperCase()} Predicted BTC-USD`,
          data: selectedData.predicted_close || [],
          borderColor: '#ee9b00',
          backgroundColor: 'rgba(238, 155, 0, 0.16)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.28,
        },
      ],
    }
  }, [selectedData, selectedModel])

  const activeMeta = modelMeta[selectedModel]

  return (
    <AppShell title="Crypto">
      <section className="crypto-hero">
        <div className="crypto-hero-copy">
          <p className="badge">BTC Focused</p>
          <h2>BTC-USD Intelligence Hub ₿</h2>
          <p>
            Explore live Bitcoin pricing from yfinance with interactive model switching, forecast ranges, and
            side-by-side charts for actual versus predicted behavior.
          </p>
        </div>

        <div className="crypto-button-row">
          <button
            className={`button crypto-button ${selectedModel === 'linear' ? 'crypto-button-active' : ''}`}
            type="button"
            onClick={() => setSelectedModel('linear')}
          >
            📈 Linear Regression
          </button>
          <button
            className={`button crypto-button ${selectedModel === 'logistic' ? 'crypto-button-active' : ''}`}
            type="button"
            onClick={() => setSelectedModel('logistic')}
          >
            🎯 Logistic Regression
          </button>
          <button
            className={`button crypto-button ${selectedModel === 'arima' ? 'crypto-button-active' : ''}`}
            type="button"
            onClick={() => setSelectedModel('arima')}
          >
            🔮 ARIMA
          </button>
          <button
            className={`button crypto-button ${selectedModel === 'lstm' ? 'crypto-button-active' : ''}`}
            type="button"
            onClick={() => setSelectedModel('lstm')}
          >
            🤖 LSTM
          </button>
        </div>

        <div className="crypto-subpanel">
          <div className="crypto-controls">
            <label htmlFor="forecast-horizon">Graph Range</label>
            <select
              id="forecast-horizon"
              value={forecastHorizon}
              onChange={(event) => setForecastHorizon(event.target.value)}
              disabled={selectedModel === 'logistic'}
            >
              {horizonOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="crypto-model-meta">
            <h3>Choose Your BTC Model</h3>
            <p>
              <strong>{activeMeta.title}</strong> {activeMeta.description}
            </p>
          </div>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {(liveData || selectedData) && (
        <section className="crypto-chart-grid">
          <article className="crypto-card crypto-card-spotlight">
            <div className="crypto-card-head">
              <h3>🚀 Live BTC-USD Market</h3>
              <span className="live-dot">LIVE</span>
            </div>
            <div className="metals-metrics">
              <span>Live Price: {liveData?.live_price ?? '-'} USD</span>
              <span>24H Move: {liveData?.change_pct_24h ?? '-'}%</span>
            </div>
            {liveChartData ? (
              <div className="chart-wrap">
                <Line data={liveChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p>Loading live chart...</p>
            )}
          </article>

          <article className="crypto-card crypto-analysis-panel">
            <div className="crypto-card-head">
              <h3>{activeMeta.title}</h3>
              <span className="user-chip">{selectedModel.toUpperCase()}</span>
            </div>
            <div className="metals-metrics">
              {selectedModel === 'logistic' ? (
                <>
                  <span>Up Probability: {((selectedData?.up_probability || 0) * 100).toFixed(2)}%</span>
                  <span>Down Probability: {((selectedData?.down_probability || 0) * 100).toFixed(2)}%</span>
                  <span>Signal: {selectedData?.signal || '-'}</span>
                </>
              ) : (
                <>
                  <span>Next Predicted Price: {selectedData?.next_prediction ?? '-'}</span>
                  <span>Graph Range: {selectedData?.horizon || forecastHorizon}</span>
                  <span>Actual vs Predicted Price</span>
                </>
              )}
            </div>
            {loadingKey ? <p className="muted">Loading {loadingKey.toUpperCase()} graph...</p> : null}
            {analysisChartData ? (
              <div className="chart-wrap">
                <Line data={analysisChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : null}
          </article>
        </section>
      )}
    </AppShell>
  )
}

export default CryptoPage
