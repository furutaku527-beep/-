"""検証用の合成日足データ生成(J-Quants 認証なしで動作確認するため).

実データが無くてもパイプライン全体(戦略→バックテスト→レポート→ダッシュボード)
を動かせるよう、ランダムウォーク+トレンドで疑似的な OHLCV を作る。
J-Quants 形式に近い列名(Adjustment* 含む)で返す。
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def make_daily(
    code: str = "9999",
    n: int = 300,
    start: str = "2023-01-04",
    seed: int | None = None,
    base_price: float = 1000.0,
    trend: float = 0.0004,
    vol: float = 0.02,
) -> pd.DataFrame:
    """擬似日足を生成して J-Quants 風の DataFrame を返す."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(start=start, periods=n)

    rets = rng.normal(trend, vol, n)
    close = base_price * np.exp(np.cumsum(rets))

    # 日中レンジを作る(高値/安値/始値)
    intraday = np.abs(rng.normal(0, vol, n))
    high = close * (1 + intraday)
    low = close * (1 - intraday)
    open_ = low + rng.random(n) * (high - low)
    # 高値・安値が始値/終値を包含するよう補正
    high = np.maximum.reduce([high, open_, close])
    low = np.minimum.reduce([low, open_, close])
    volume = rng.integers(200_000, 2_000_000, n).astype(float)

    df = pd.DataFrame(
        {
            "Date": dates.strftime("%Y-%m-%d"),
            "Code": code,
            "Open": open_.round(1),
            "High": high.round(1),
            "Low": low.round(1),
            "Close": close.round(1),
            "Volume": volume,
            # 調整列も同値で用意(分割なし想定)
            "AdjustmentOpen": open_.round(1),
            "AdjustmentHigh": high.round(1),
            "AdjustmentLow": low.round(1),
            "AdjustmentClose": close.round(1),
            "AdjustmentVolume": volume,
        }
    )
    return df


def make_universe(codes=None, **kwargs) -> dict[str, pd.DataFrame]:
    """複数銘柄の疑似ユニバースを返す {code: df}."""
    codes = codes or ["7203", "6758", "9984", "4591", "2884"]
    universe = {}
    for i, c in enumerate(codes):
        universe[c] = make_daily(code=c, seed=i, base_price=500 + i * 700, **kwargs)
    return universe
