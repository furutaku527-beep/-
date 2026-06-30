"""テクニカル指標の計算.

J-Quants 日足は分割等の調整列(Adjustment*)を持つ。連続性のため、
存在すれば Adjustment 列を優先して OHLCV を組み立てる。
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .params import StrategyParams

# 標準化した列名
OHLCV = ["Open", "High", "Low", "Close", "Volume"]


def normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """J-Quants の生 DataFrame を標準 OHLCV に整える.

    Adjustment{Open,High,Low,Close,Volume} があればそれを採用(分割調整済み)。
    無ければ素の Open/High/Low/Close/Volume を使う。
    """
    out = pd.DataFrame()
    out["Date"] = pd.to_datetime(df["Date"])
    if "Code" in df.columns:
        out["Code"] = df["Code"].astype(str)

    mapping = {
        "Open": "AdjustmentOpen",
        "High": "AdjustmentHigh",
        "Low": "AdjustmentLow",
        "Close": "AdjustmentClose",
        "Volume": "AdjustmentVolume",
    }
    for std, adj in mapping.items():
        if adj in df.columns and df[adj].notna().any():
            out[std] = pd.to_numeric(df[adj], errors="coerce")
        elif std in df.columns:
            out[std] = pd.to_numeric(df[std], errors="coerce")
        else:
            out[std] = np.nan

    out = out.dropna(subset=["Close"]).sort_values("Date").reset_index(drop=True)
    return out


def add_indicators(df: pd.DataFrame, params: StrategyParams | None = None) -> pd.DataFrame:
    """移動平均・傾き・乖離・売買代金などの指標列を付与.

    入力は normalize_ohlcv 済みを想定。シグナル判定で使う列を作る。
    """
    p = params or StrategyParams()
    out = df.copy()

    out["MA_fast"] = out["Close"].rolling(p.ma_fast).mean()
    out["MA_slow"] = out["Close"].rolling(p.ma_slow).mean()

    # 線の向き(前日との差の符号)
    out["MA_fast_slope"] = out["MA_fast"].diff()
    out["MA_slow_slope"] = out["MA_slow"].diff()

    # 終値と各線の乖離率
    out["dev_fast"] = (out["Close"] - out["MA_fast"]) / out["MA_fast"]
    out["dev_slow"] = (out["Close"] - out["MA_slow"]) / out["MA_slow"]

    # 売買代金(流動性スクリーニング用)20日平均
    out["turnover"] = out["Close"] * out["Volume"]
    out["turnover_ma20"] = out["turnover"].rolling(20).mean()

    return out
