from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .services import (
    build_crypto_forecast_payload,
    build_crypto_live_payload,
    build_crypto_regression_payload,
    build_metal_prediction_payload,
    build_metals_correlation_payload,
    build_metals_live_payload,
    build_clustering_payload,
    build_discount_payload,
    get_crypto_suggestions,
    build_regression_payload,
    normalize_timeframe,
    resolve_timeframe,
)


class RegressionAnalysisView(APIView):
    def get(self, request):
        symbol = request.query_params.get('symbol')
        timeframe = request.query_params.get('timeframe', '1D').upper()
        timeframe_config = resolve_timeframe(timeframe)
        period = request.query_params.get('period', timeframe_config['period'])
        interval = request.query_params.get('interval', timeframe_config['interval'])
        if not symbol:
            return Response({'detail': 'Query parameter "symbol" is required.'}, status=400)

        payload = build_regression_payload(
            symbol=symbol,
            period=period,
            interval=interval,
            timeframe=timeframe,
        )
        if payload is None:
            return Response({'detail': 'Insufficient historical data for analysis.'}, status=404)
        return Response(payload)


class DiscountAnalysisView(APIView):
    def get(self, request):
        symbol = request.query_params.get('symbol')
        timeframe = request.query_params.get('timeframe', '1D').upper()
        timeframe_config = resolve_timeframe(timeframe)
        period = request.query_params.get('period', timeframe_config['period'])
        interval = request.query_params.get('interval', timeframe_config['interval'])
        if not symbol:
            return Response({'detail': 'Query parameter "symbol" is required.'}, status=400)

        payload = build_discount_payload(
            symbol=symbol,
            period=period,
            interval=interval,
            timeframe=timeframe,
        )
        if payload is None:
            return Response({'detail': 'Insufficient historical data for analysis.'}, status=404)
        return Response(payload)


class ClusteringAnalysisView(APIView):
    def get(self, request):
        symbol = request.query_params.get('symbol')
        timeframe = request.query_params.get('timeframe', '1D').upper()
        timeframe_config = resolve_timeframe(timeframe)
        period = request.query_params.get('period', timeframe_config['period'])
        interval = request.query_params.get('interval', timeframe_config['interval'])
        if not symbol:
            return Response({'detail': 'Query parameter "symbol" is required.'}, status=400)

        payload = build_clustering_payload(
            symbol=symbol,
            period=period,
            interval=interval,
            timeframe=timeframe,
        )
        if payload is None:
            return Response({'detail': 'Insufficient historical data for analysis.'}, status=404)
        return Response(payload)


class MetalsLiveView(APIView):
    def get(self, request):
        timeframe = normalize_timeframe(request.query_params.get('timeframe', '1D'))
        payload = build_metals_live_payload(timeframe=timeframe)
        if payload is None:
            return Response({'detail': 'Unable to fetch metals live data.'}, status=404)
        return Response(payload)


class MetalsCorrelationView(APIView):
    def get(self, request):
        timeframe = normalize_timeframe(request.query_params.get('timeframe', '1D'))
        payload = build_metals_correlation_payload(timeframe=timeframe)
        if payload is None:
            return Response({'detail': 'Unable to compute metals correlation.'}, status=404)
        return Response(payload)


class MetalsPredictionView(APIView):
    def get(self, request):
        timeframe = normalize_timeframe(request.query_params.get('timeframe', '1D'))
        metal = (request.query_params.get('metal') or 'gold').lower()
        if metal not in {'gold', 'silver'}:
            return Response({'detail': 'metal must be either gold or silver.'}, status=400)

        payload = build_metal_prediction_payload(metal=metal, timeframe=timeframe)
        if payload is None:
            return Response({'detail': 'Unable to generate metal prediction.'}, status=404)
        return Response(payload)


class CryptoSuggestionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '')
        return Response(get_crypto_suggestions(query=query))


class CryptoLiveView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        symbol = request.query_params.get('symbol', 'BTC-USD').upper()
        payload = build_crypto_live_payload(symbol=symbol)
        if payload is None:
            return Response({'detail': 'Unable to fetch crypto live data.'}, status=404)
        return Response(payload)


class CryptoRegressionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        symbol = request.query_params.get('symbol', 'BTC-USD').upper()
        payload = build_crypto_regression_payload(symbol=symbol)
        if payload is None:
            return Response({'detail': 'Unable to generate crypto regression analysis.'}, status=404)
        return Response(payload)


class CryptoForecastView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        symbol = request.query_params.get('symbol', 'BTC-USD').upper()
        model_name = request.query_params.get('model', 'arima').lower()
        payload = build_crypto_forecast_payload(symbol=symbol, model_name=model_name)
        if payload is None:
            return Response({'detail': 'Unable to generate crypto forecast.'}, status=404)
        return Response(payload)
