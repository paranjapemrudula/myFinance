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

const timeframeOptions = ['1hr', '1day', '1month', '6month']

function MetalsPage() {
  const [goldTf, setGoldTf] = useState('1day')
  const [silverTf, setSilverTf] = useState('1day')
  const [corrTf, setCorrTf] = useState('1day')

  const [liveData, setLiveData] = useState(null)
  const [goldPred, setGoldPred] = useState(null)
  const [silverPred, setSilverPred] = useState(null)
  const [corrData, setCorrData] = useState(null)
  const [error, setError] = useState('')

  const loadLive = async () => {
    try {
      const response = await api.get('/api/metals/live/?timeframe=1hr')
      setLiveData(response.data)
      setError('')
    } catch {
      setError('Unable to load live metals prices.')
    }
  }

  const loadGoldPrediction = async () => {
    try {
      const response = await api.get(`/api/metals/prediction/?metal=gold&timeframe=${encodeURIComponent(goldTf)}`)
      setGoldPred(response.data)
      setError('')
    } catch {
      setError('Unable to load gold prediction.')
    }
  }

  const loadSilverPrediction = async () => {
    try {
      const response = await api.get(`/api/metals/prediction/?metal=silver&timeframe=${encodeURIComponent(silverTf)}`)
      setSilverPred(response.data)
      setError('')
    } catch {
      setError('Unable to load silver prediction.')
    }
  }

  const loadCorrelation = async () => {
    try {
      const response = await api.get(`/api/metals/correlation/?timeframe=${encodeURIComponent(corrTf)}`)
      setCorrData(response.data)
      setError('')
    } catch {
      setError('Unable to load metals correlation.')
    }
  }

  useEffect(() => {
    loadLive()
    const timer = setInterval(loadLive, 20000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadGoldPrediction()
  }, [goldTf])

  useEffect(() => {
    loadSilverPrediction()
  }, [silverTf])

  useEffect(() => {
    loadCorrelation()
  }, [corrTf])

  const goldPredChart = useMemo(() => {
    if (!goldPred) return null
    return {
      labels: goldPred.dates || [],
      datasets: [
        {
          label: 'Gold Actual',
          data: goldPred.actual_price || [],
          borderColor: '#f0b429',
          backgroundColor: 'rgba(240, 180, 41, 0.2)',
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'Gold Predicted',
          data: goldPred.predicted_price || [],
          borderColor: '#f0b429',
          backgroundColor: 'rgba(240, 180, 41, 0.2)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 1,
        },
      ],
    }
  }, [goldPred])

  const silverPredChart = useMemo(() => {
    if (!silverPred) return null
    return {
      labels: silverPred.dates || [],
      datasets: [
        {
          label: 'Silver Actual',
          data: silverPred.actual_price || [],
          borderColor: '#6d7b8d',
          backgroundColor: 'rgba(109, 123, 141, 0.2)',
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'Silver Predicted',
          data: silverPred.predicted_price || [],
          borderColor: '#6d7b8d',
          backgroundColor: 'rgba(109, 123, 141, 0.2)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 1,
        },
      ],
    }
  }, [silverPred])

  const corrChart = useMemo(() => {
    if (!corrData) return null
    return {
      labels: corrData.dates || [],
      datasets: [
        {
          label: 'Gold Index (100 base)',
          data: corrData.gold_index || [],
          borderColor: '#f0b429',
          backgroundColor: 'rgba(240, 180, 41, 0.2)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 1,
        },
        {
          label: 'Silver Index (100 base)',
          data: corrData.silver_index || [],
          borderColor: '#6d7b8d',
          backgroundColor: 'rgba(109, 123, 141, 0.2)',
          borderWidth: 2,
          pointRadius: 1,
        },
      ],
    }
  }, [corrData])

  return (
    <AppShell title="Metals">
      <section className="dashboard-hero">
        <div>
          <h2>Metals Analytics (USD)</h2>
          <p>Live prices, predictive outlook, and interactive gold-silver correlation.</p>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="metals-grid">
        <article className="metals-card">
          <div className="metals-head">
            <h3>🟡 Gold</h3>
            <select value={goldTf} onChange={(event) => setGoldTf(event.target.value)}>
              {timeframeOptions.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div className="metals-metrics">
            <span>Live Gold Price: {liveData?.gold?.live_price ?? '-'} USD</span>
            <span>Predicted Next: {goldPred?.predicted_price?.slice(-1)[0] ?? '-'} USD</span>
            <span>Outlook: {goldPred?.outlook || '-'}</span>
          </div>
          {goldPredChart ? (
            <div className="chart-wrap">
              <Line data={goldPredChart} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          ) : (
            <p>Loading gold prediction chart...</p>
          )}
        </article>

        <article className="metals-card">
          <div className="metals-head">
            <h3>⚪ Silver</h3>
            <select value={silverTf} onChange={(event) => setSilverTf(event.target.value)}>
              {timeframeOptions.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div className="metals-metrics">
            <span>Live Silver Price: {liveData?.silver?.live_price ?? '-'} USD</span>
            <span>Predicted Next: {silverPred?.predicted_price?.slice(-1)[0] ?? '-'} USD</span>
            <span>Outlook: {silverPred?.outlook || '-'}</span>
          </div>
          {silverPredChart ? (
            <div className="chart-wrap">
              <Line data={silverPredChart} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          ) : (
            <p>Loading silver prediction chart...</p>
          )}
        </article>

        <article className="metals-card metals-card-wide">
          <div className="metals-head">
            <h3>Gold-Silver Correlation (Interactive)</h3>
            <select value={corrTf} onChange={(event) => setCorrTf(event.target.value)}>
              {timeframeOptions.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div className="metals-metrics">
            <span>Current Correlation: {corrData?.current_correlation ?? '-'}</span>
            <span>Relation: {corrData?.relation || '-'}</span>
          </div>
          {corrChart ? (
            <div className="chart-wrap">
              <Line data={corrChart} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          ) : (
            <p>Loading correlation chart...</p>
          )}
        </article>
      </section>
    </AppShell>
  )
}

export default MetalsPage
