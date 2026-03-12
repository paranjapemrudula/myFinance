import numpy as np
import pandas as pd
import yfinance as yf
from django.conf import settings
from django.core.cache import cache
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import MinMaxScaler, StandardScaler

GOLD_SYMBOL = 'GC=F'
SILVER_SYMBOL = 'SI=F'
BTC_SYMBOL = 'BTC-USD'
CRYPTO_SUGGESTIONS = [
    {
        'symbol': BTC_SYMBOL,
        'name': 'Bitcoin / US Dollar',
        'aliases': ['bitcoin', 'btc', 'btc usd', 'bitcoin usd', 'btc-usd'],
    }
]


def normalize_timeframe(timeframe: str):
    value = (timeframe or '').strip().upper().replace(' ', '')
    aliases = {
        '1HR': '1H',
        '1HOUR': '1H',
        '1DAY': '1D',
        '1MONTH': '1M',
        '3MONTH': '3M',
        '6MONTH': '6M',
    }
    return aliases.get(value, value or '1D')


def resolve_timeframe(timeframe: str):
    tf = normalize_timeframe(timeframe)
    mapping = {
        '1D': {
            'period': '30d',
            'interval': '1d',
            'recent_points': 7,
            'future_steps': 2,
        },
        '1H': {
            'period': '7d',
            'interval': '1h',
            'recent_points': 48,
            'future_steps': 2,
        },
        '1M': {
            'period': '24mo',
            'interval': '1mo',
            'recent_points': 12,
            'future_steps': 2,
        },
        '3M': {
            'period': '10y',
            'interval': '3mo',
            'recent_points': 16,
            'future_steps': 2,
        },
        '6M': {
            'period': '15y',
            'interval': '3mo',
            'recent_points': 12,
            'future_steps': 2,
        },
    }
    return mapping.get(tf, mapping['1D'])


def _format_timestamps(date_series: pd.Series, timeframe: str):
    tf = normalize_timeframe(timeframe)
    if tf == '1H':
        return date_series.dt.strftime('%Y-%m-%d %H:%M').tolist()
    if tf in {'1M', '3M', '6M'}:
        return date_series.dt.strftime('%Y-%m').tolist()
    return date_series.dt.strftime('%Y-%m-%d').tolist()


def fetch_historical_data(symbol: str, period: str = '1y', interval: str = '1d'):
    cache_key = f'analysis:history:{symbol}:{period}:{interval}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    history = yf.Ticker(symbol).history(period=period, interval=interval)
    if history.empty:
        return pd.DataFrame()

    frame = history.copy()
    frame = frame[['Close', 'Volume']].dropna()
    frame.index = pd.to_datetime(frame.index)
    frame = frame.sort_index()

    cache.set(cache_key, frame, timeout=getattr(settings, 'ANALYSIS_CACHE_TTL_SECONDS', 900))
    return frame


def _recent_frame(frame: pd.DataFrame, points: int):
    if points <= 0:
        return frame
    return frame.tail(points)


def _future_timestamps(last_date: pd.Timestamp, timeframe: str, steps: int):
    tf = normalize_timeframe(timeframe)
    if steps <= 0:
        return []

    future = []
    for step in range(1, steps + 1):
        if tf == '1H':
            future.append(last_date + pd.Timedelta(hours=step))
        elif tf == '1M':
            future.append(last_date + pd.DateOffset(months=step))
        elif tf == '3M':
            future.append(last_date + pd.DateOffset(months=3 * step))
        elif tf == '6M':
            future.append(last_date + pd.DateOffset(months=6 * step))
        else:
            future.append(last_date + pd.Timedelta(days=step))
    return future


def build_regression_payload(symbol: str, period: str = '1y', interval: str = '1d', timeframe: str = '1D'):
    frame = fetch_historical_data(symbol=symbol, period=period, interval=interval)
    if frame.empty or len(frame) < 2:
        return None

    config = resolve_timeframe(timeframe)
    frame = _recent_frame(frame, config['recent_points'])
    frame = frame.reset_index()
    frame['date'] = _format_timestamps(frame['Date'], timeframe=timeframe)
    frame['t_index'] = np.arange(len(frame))

    x = frame[['t_index']].values
    y = frame['Close'].values
    model = LinearRegression()
    model.fit(x, y)
    predictions_hist = model.predict(x)
    future_steps = config['future_steps']
    future_x = np.arange(len(frame), len(frame) + future_steps).reshape(-1, 1)
    predictions_future = model.predict(future_x) if future_steps > 0 else np.array([])
    future_dates = _future_timestamps(pd.to_datetime(frame['Date'].iloc[-1]), timeframe=timeframe, steps=future_steps)
    future_date_labels = _format_timestamps(pd.Series(pd.to_datetime(future_dates)), timeframe=timeframe) if future_dates else []

    dates = frame['date'].tolist() + future_date_labels
    actual_close = np.round(y, 2).tolist() + [None] * len(future_date_labels)
    predicted_close = np.round(np.concatenate([predictions_hist, predictions_future]), 2).tolist()

    return {
        'symbol': symbol,
        'timeframe': normalize_timeframe(timeframe),
        'dates': dates,
        'actual_close': actual_close,
        'predicted_close': predicted_close,
    }


def build_discount_payload(symbol: str, period: str = '1y', interval: str = '1d', timeframe: str = '1D'):
    frame = fetch_historical_data(symbol=symbol, period=period, interval=interval)
    if frame.empty or len(frame) < 2:
        return None

    config = resolve_timeframe(timeframe)
    df = frame.copy()
    df['avg_price'] = (df['Close'].rolling(10).mean() + df['Close']) / 2
    df = df.dropna()
    if df.empty:
        return None
    df = _recent_frame(df, config['recent_points'])

    df['discount_ratio'] = ((df['avg_price'] - df['Close']) / df['avg_price']) * 100
    df = df.reset_index()

    return {
        'symbol': symbol,
        'timeframe': normalize_timeframe(timeframe),
        'dates': _format_timestamps(df['Date'], timeframe=timeframe),
        'discount_ratio': np.round(df['discount_ratio'], 2).tolist(),
    }


def _cluster_name(avg_return: float, avg_volatility: float):
    if avg_return >= 0 and avg_volatility < 0.02:
        return 'Stable Growth'
    if avg_return >= 0 and avg_volatility >= 0.02:
        return 'Momentum High Volatility'
    if avg_return < 0 and avg_volatility < 0.02:
        return 'Slow Drawdown'
    return 'High Risk Downtrend'


def build_clustering_payload(symbol: str, period: str = '1y', interval: str = '1d', timeframe: str = '1D'):
    frame = fetch_historical_data(symbol=symbol, period=period, interval=interval)
    if frame.empty or len(frame) < 30:
        return None

    df = frame.copy()
    df['returns'] = df['Close'].pct_change()
    df['volatility'] = df['returns'].rolling(10).std()
    df['volume_change'] = df['Volume'].pct_change()
    df['ma20'] = df['Close'].rolling(20).mean()
    df['close_vs_ma20'] = (df['Close'] - df['ma20']) / df['ma20']
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna()
    config = resolve_timeframe(timeframe)
    df = _recent_frame(df, max(config['recent_points'] * 3, 24))
    if len(df) < 6:
        return None

    features = df[['returns', 'volatility', 'volume_change', 'close_vs_ma20']]
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features.values)

    n_clusters = min(3, len(df))
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = model.fit_predict(scaled)
    df['cluster_id'] = labels

    cluster_labels = {}
    for cluster_id in sorted(df['cluster_id'].unique()):
        cluster_rows = df[df['cluster_id'] == cluster_id]
        name = _cluster_name(
            avg_return=float(cluster_rows['returns'].mean()),
            avg_volatility=float(cluster_rows['volatility'].mean()),
        )
        cluster_labels[int(cluster_id)] = name

    df = df.reset_index()
    points = []
    for idx, row in df.iterrows():
        cid = int(labels[idx])
        points.append(
            {
                'date': _format_timestamps(pd.Series([pd.to_datetime(row['Date'])]), timeframe=timeframe)[0],
                'x': round(float(row['returns']), 6),
                'y': round(float(row['volatility']), 6),
                'volume_change': round(float(row['volume_change']), 6),
                'close_vs_ma20': round(float(row['close_vs_ma20']), 6),
                'cluster_id': cid,
                'cluster_name': cluster_labels.get(cid, f'Cluster {cid}'),
            }
        )

    return {
        'symbol': symbol,
        'timeframe': normalize_timeframe(timeframe),
        'points': points,
        'cluster_id': [int(label) for label in labels.tolist()],
        'cluster_labels': cluster_labels,
    }


def _live_price_usd(symbol: str):
    frame = fetch_historical_data(symbol=symbol, period='1d', interval='1m')
    if not frame.empty:
        return round(float(frame['Close'].iloc[-1]), 2)

    fallback = fetch_historical_data(symbol=symbol, period='5d', interval='1d')
    if not fallback.empty:
        return round(float(fallback['Close'].iloc[-1]), 2)
    return None


def build_metals_live_payload(timeframe: str = '1D'):
    config = resolve_timeframe(timeframe)
    gold_hist = fetch_historical_data(GOLD_SYMBOL, period=config['period'], interval=config['interval'])
    silver_hist = fetch_historical_data(SILVER_SYMBOL, period=config['period'], interval=config['interval'])

    if gold_hist.empty or silver_hist.empty:
        return None

    gold_recent = _recent_frame(gold_hist, config['recent_points'])
    silver_recent = _recent_frame(silver_hist, config['recent_points'])

    gold_dates = _format_timestamps(pd.Series(gold_recent.index), timeframe)
    silver_dates = _format_timestamps(pd.Series(silver_recent.index), timeframe)

    return {
        'timeframe': normalize_timeframe(timeframe),
        'gold': {
            'symbol': GOLD_SYMBOL,
            'name': 'Gold (USD)',
            'live_price': _live_price_usd(GOLD_SYMBOL),
            'dates': gold_dates,
            'prices': np.round(gold_recent['Close'], 2).tolist(),
        },
        'silver': {
            'symbol': SILVER_SYMBOL,
            'name': 'Silver (USD)',
            'live_price': _live_price_usd(SILVER_SYMBOL),
            'dates': silver_dates,
            'prices': np.round(silver_recent['Close'], 2).tolist(),
        },
    }


def build_metals_correlation_payload(timeframe: str = '1D'):
    config = resolve_timeframe(timeframe)
    gold = fetch_historical_data(GOLD_SYMBOL, period=config['period'], interval=config['interval'])
    silver = fetch_historical_data(SILVER_SYMBOL, period=config['period'], interval=config['interval'])
    if gold.empty or silver.empty:
        return None

    merged = pd.DataFrame(
        {
            'gold_close': gold['Close'],
            'silver_close': silver['Close'],
        }
    ).dropna()

    if len(merged) < 6:
        return None

    merged['gold_ret'] = merged['gold_close'].pct_change()
    merged['silver_ret'] = merged['silver_close'].pct_change()
    merged = merged.dropna()
    if len(merged) < 6:
        return None

    window = min(10, max(3, len(merged) // 3))
    merged['correlation'] = merged['gold_ret'].rolling(window).corr(merged['silver_ret'])
    merged = merged.dropna()
    merged = _recent_frame(merged, config['recent_points'])
    if merged.empty:
        return None

    merged['gold_index'] = (merged['gold_close'] / merged['gold_close'].iloc[0]) * 100
    merged['silver_index'] = (merged['silver_close'] / merged['silver_close'].iloc[0]) * 100

    current_corr = float(merged['correlation'].iloc[-1])
    relation = 'Strong Positive' if current_corr >= 0.6 else 'Moderate Positive' if current_corr >= 0.2 else 'Weak/Negative'

    return {
        'timeframe': normalize_timeframe(timeframe),
        'dates': _format_timestamps(pd.Series(merged.index), timeframe),
        'correlation_series': np.round(merged['correlation'], 4).tolist(),
        'gold_index': np.round(merged['gold_index'], 2).tolist(),
        'silver_index': np.round(merged['silver_index'], 2).tolist(),
        'current_correlation': round(current_corr, 4),
        'relation': relation,
    }


def build_metal_prediction_payload(metal: str = 'gold', timeframe: str = '1D'):
    config = resolve_timeframe(timeframe)
    metal_key = (metal or 'gold').lower()
    symbol = GOLD_SYMBOL if metal_key == 'gold' else SILVER_SYMBOL
    name = 'Gold (USD)' if metal_key == 'gold' else 'Silver (USD)'

    frame = fetch_historical_data(symbol, period=config['period'], interval=config['interval'])
    if frame.empty or len(frame) < 6:
        return None

    recent = _recent_frame(frame, config['recent_points'])
    df = recent.reset_index()
    df['date'] = _format_timestamps(df['Date'], timeframe)
    df['t_index'] = np.arange(len(df))

    x = df[['t_index']].values
    y = df['Close'].values
    model = LinearRegression()
    model.fit(x, y)
    pred_hist = model.predict(x)

    future_steps = config['future_steps']
    future_x = np.arange(len(df), len(df) + future_steps).reshape(-1, 1)
    pred_future = model.predict(future_x) if future_steps > 0 else np.array([])
    future_dates = _future_timestamps(pd.to_datetime(df['Date'].iloc[-1]), timeframe, future_steps)
    future_labels = _format_timestamps(pd.Series(pd.to_datetime(future_dates)), timeframe) if future_dates else []

    direction = 'Bullish' if pred_future.size > 0 and pred_future[-1] > y[-1] else 'Bearish'

    return {
        'metal': metal_key,
        'name': name,
        'symbol': symbol,
        'timeframe': normalize_timeframe(timeframe),
        'dates': df['date'].tolist() + future_labels,
        'actual_price': np.round(y, 2).tolist() + [None] * len(future_labels),
        'predicted_price': np.round(np.concatenate([pred_hist, pred_future]), 2).tolist(),
        'outlook': direction,
    }


def get_crypto_suggestions(query: str):
    text = (query or '').strip().lower()
    if not text:
        return CRYPTO_SUGGESTIONS

    matches = []
    for item in CRYPTO_SUGGESTIONS:
        haystack = ' '.join([item['symbol'], item['name'], *item['aliases']]).lower()
        if text in haystack:
            matches.append(item)
    return matches


def build_crypto_live_payload(symbol: str = BTC_SYMBOL):
    history = fetch_historical_data(symbol=symbol, period='2y', interval='1d')
    intraday = fetch_historical_data(symbol=symbol, period='5d', interval='1h')
    if history.empty:
        return None

    live_source = intraday if not intraday.empty else history
    live_price = round(float(live_source['Close'].iloc[-1]), 2)
    previous_close = float(history['Close'].iloc[-2]) if len(history) > 1 else live_price
    change_pct = round(((live_price - previous_close) / previous_close) * 100, 2) if previous_close else 0

    recent = history.tail(120)
    return {
        'symbol': symbol,
        'name': 'Bitcoin / US Dollar',
        'live_price': live_price,
        'change_pct_24h': change_pct,
        'dates': recent.index.strftime('%Y-%m-%d').tolist(),
        'prices': np.round(recent['Close'], 2).tolist(),
    }


def build_crypto_regression_payload(symbol: str = BTC_SYMBOL):
    frame = fetch_historical_data(symbol=symbol, period='2y', interval='1d')
    if frame.empty or len(frame) < 60:
        return None

    frame = frame.reset_index()
    frame['date'] = frame['Date'].dt.strftime('%Y-%m-%d')
    frame['t_index'] = np.arange(len(frame))

    x = frame[['t_index']].values
    y = frame['Close'].values
    linear = LinearRegression()
    linear.fit(x, y)
    hist_pred = linear.predict(x)

    future_steps = 14
    future_x = np.arange(len(frame), len(frame) + future_steps).reshape(-1, 1)
    future_pred = linear.predict(future_x)
    future_dates = pd.date_range(frame['Date'].iloc[-1] + pd.Timedelta(days=1), periods=future_steps, freq='D')
    future_labels = future_dates.strftime('%Y-%m-%d').tolist()

    logistic_df = frame[['Date', 'Close', 'Volume']].copy()
    logistic_df['return_1d'] = logistic_df['Close'].pct_change(1)
    logistic_df['return_3d'] = logistic_df['Close'].pct_change(3)
    logistic_df['return_7d'] = logistic_df['Close'].pct_change(7)
    logistic_df['volume_change'] = logistic_df['Volume'].pct_change(1)
    logistic_df['target_up'] = (logistic_df['Close'].shift(-1) > logistic_df['Close']).astype(int)
    logistic_df = logistic_df.replace([np.inf, -np.inf], np.nan).dropna()
    if len(logistic_df) < 30:
        return None

    feature_cols = ['return_1d', 'return_3d', 'return_7d', 'volume_change']
    logistic = LogisticRegression(max_iter=1000)
    logistic.fit(logistic_df[feature_cols], logistic_df['target_up'])
    latest_features = logistic_df[feature_cols].iloc[[-1]]
    up_probability = float(logistic.predict_proba(latest_features)[0][1])

    recent_slice = 120
    recent_dates = frame['date'].tolist()[-recent_slice:]
    recent_actual = np.round(y[-recent_slice:], 2).tolist()
    recent_linear = np.round(hist_pred[-recent_slice:], 2).tolist()

    return {
        'symbol': symbol,
        'name': 'Bitcoin / US Dollar',
        'dates': recent_dates + future_labels,
        'actual_close': recent_actual + [None] * future_steps,
        'linear_predicted_close': recent_linear + np.round(future_pred, 2).tolist(),
        'logistic': {
            'up_probability': round(up_probability, 4),
            'down_probability': round(1 - up_probability, 4),
            'signal': 'Bullish' if up_probability >= 0.5 else 'Bearish',
        },
    }


def build_crypto_forecast_payload(symbol: str = BTC_SYMBOL, model_name: str = 'arima'):
    frame = fetch_historical_data(symbol=symbol, period='2y', interval='1d')
    if frame.empty or len(frame) < 90:
        return None

    model_key = (model_name or 'arima').strip().lower()
    if model_key == 'arima':
        return _build_crypto_arima_payload(frame=frame, symbol=symbol)
    if model_key == 'lstm':
        return _build_crypto_lstm_payload(frame=frame, symbol=symbol)
    return None


def _build_crypto_arima_payload(frame: pd.DataFrame, symbol: str):
    from statsmodels.tsa.arima.model import ARIMA

    close = frame['Close'].astype(float)
    forecast_steps = 14
    model = None
    for order in ((3, 1, 2), (2, 1, 2), (1, 1, 1)):
        try:
            model = ARIMA(close, order=order).fit()
            break
        except Exception:
            model = None
    if model is None:
        return None

    fitted = model.predict(start=1, end=len(close) - 1, typ='levels')
    forecast = model.forecast(steps=forecast_steps)

    recent = frame.tail(120).copy()
    recent_dates = recent.index.strftime('%Y-%m-%d').tolist()
    actual_recent = np.round(recent['Close'], 2).tolist()

    fitted_series = pd.Series(index=close.index, dtype=float)
    fitted_series.iloc[1: len(fitted) + 1] = fitted.values
    fitted_recent = fitted_series.tail(120).round(2).where(pd.notnull(fitted_series.tail(120)), None).tolist()

    future_dates = pd.date_range(frame.index[-1] + pd.Timedelta(days=1), periods=forecast_steps, freq='D')
    future_labels = future_dates.strftime('%Y-%m-%d').tolist()
    combined_pred = fitted_recent + np.round(forecast, 2).tolist()

    return {
        'symbol': symbol,
        'name': 'Bitcoin / US Dollar',
        'model': 'ARIMA',
        'dates': recent_dates + future_labels,
        'actual_close': actual_recent + [None] * forecast_steps,
        'predicted_close': combined_pred,
        'next_prediction': round(float(forecast.iloc[-1]), 2),
    }


def _build_crypto_lstm_payload(frame: pd.DataFrame, symbol: str):
    from tensorflow.keras import Sequential
    from tensorflow.keras.layers import Dense, LSTM

    close_values = frame['Close'].astype(float).values.reshape(-1, 1)
    if len(close_values) < 120:
        return None

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(close_values)
    lookback = 30

    x_train = []
    y_train = []
    for idx in range(lookback, len(scaled)):
        x_train.append(scaled[idx - lookback:idx, 0])
        y_train.append(scaled[idx, 0])

    if len(x_train) < 40:
        return None

    x_train = np.array(x_train)
    y_train = np.array(y_train)
    x_train = x_train.reshape((x_train.shape[0], x_train.shape[1], 1))

    model = Sequential([
        LSTM(32, input_shape=(lookback, 1)),
        Dense(1),
    ])
    model.compile(optimizer='adam', loss='mean_squared_error')
    model.fit(x_train, y_train, epochs=8, batch_size=16, verbose=0)

    history_preds = model.predict(x_train, verbose=0)
    history_prices = scaler.inverse_transform(history_preds).flatten()

    recent = frame.tail(120).copy()
    recent_dates = recent.index.strftime('%Y-%m-%d').tolist()
    actual_recent = np.round(recent['Close'], 2).tolist()

    history_series = [None] * len(frame)
    for idx, value in enumerate(history_prices, start=lookback):
        history_series[idx] = round(float(value), 2)
    history_recent = history_series[-120:]

    window = scaled[-lookback:].flatten().tolist()
    future_predictions = []
    forecast_steps = 14
    for _ in range(forecast_steps):
        sample = np.array(window[-lookback:]).reshape(1, lookback, 1)
        pred_scaled = float(model.predict(sample, verbose=0)[0][0])
        window.append(pred_scaled)
        pred_price = scaler.inverse_transform(np.array([[pred_scaled]])).flatten()[0]
        future_predictions.append(round(float(pred_price), 2))

    future_dates = pd.date_range(frame.index[-1] + pd.Timedelta(days=1), periods=forecast_steps, freq='D')
    future_labels = future_dates.strftime('%Y-%m-%d').tolist()

    return {
        'symbol': symbol,
        'name': 'Bitcoin / US Dollar',
        'model': 'LSTM',
        'dates': recent_dates + future_labels,
        'actual_close': actual_recent + [None] * forecast_steps,
        'predicted_close': history_recent + future_predictions,
        'next_prediction': future_predictions[-1],
    }
