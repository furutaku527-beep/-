"""結果レポート(指標算出・グラフ)."""

from .metrics import compute_metrics, format_metrics
from .plots import plot_equity_curve
from .html_report import build_html_report

__all__ = ["compute_metrics", "format_metrics", "plot_equity_curve", "build_html_report"]
