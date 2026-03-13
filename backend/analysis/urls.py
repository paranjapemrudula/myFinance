from django.urls import path

from .views import (
    ClusteringAnalysisView,
    CryptoForecastView,
    CryptoLinearRegressionView,
    CryptoLiveView,
    CryptoLogisticRegressionView,
    CryptoSuggestionView,
    DiscountAnalysisView,
    MetalsCorrelationView,
    MetalsLiveView,
    MetalsPredictionView,
    RegressionAnalysisView,
)

urlpatterns = [
    path('analyze/regression/', RegressionAnalysisView.as_view(), name='analyze_regression'),
    path('analyze/discount/', DiscountAnalysisView.as_view(), name='analyze_discount'),
    path('analyze/clustering/', ClusteringAnalysisView.as_view(), name='analyze_clustering'),
    path('crypto/suggest/', CryptoSuggestionView.as_view(), name='crypto_suggest'),
    path('crypto/live/', CryptoLiveView.as_view(), name='crypto_live'),
    path('crypto/linear-regression/', CryptoLinearRegressionView.as_view(), name='crypto_linear_regression'),
    path('crypto/logistic-regression/', CryptoLogisticRegressionView.as_view(), name='crypto_logistic_regression'),
    path('crypto/forecast/', CryptoForecastView.as_view(), name='crypto_forecast'),
    path('metals/live/', MetalsLiveView.as_view(), name='metals_live'),
    path('metals/correlation/', MetalsCorrelationView.as_view(), name='metals_correlation'),
    path('metals/prediction/', MetalsPredictionView.as_view(), name='metals_prediction'),
]
