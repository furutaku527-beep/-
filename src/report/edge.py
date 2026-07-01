"""エッジ(優位性)の有無を詰めるための分析.

バックテストのPFが1を超えても、それが本物の優位性か、単なる株高(ベータ)や
ノイズ、楽観的な決済仮定によるものかを切り分ける。
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..strategy import normalize_ohlcv


def per_trade_expectancy(trades: pd.DataFrame) -> dict:
    """1トレードあたり期待値(net)と t 値.

    |t| が概ね 2 以上なら、期待値が統計的に 0 と区別できる(ノイズでない)目安。
    """
    if trades.empty or "ret_net" not in trades:
        return {}
    r = trades["ret_net"].to_numpy(dtype=float)
    n = len(r)
    mean = float(r.mean())
    sd = float(r.std(ddof=1)) if n > 1 else 0.0
    se = sd / np.sqrt(n) if n > 0 and sd > 0 else 0.0
    t = mean / se if se > 0 else 0.0
    return {"n": n, "mean_ret_net": mean, "t_stat": t, "significant": abs(t) >= 2}


def deviation_buckets(trades: pd.DataFrame, n_buckets: int = 4) -> pd.DataFrame:
    """エントリー時の乖離(dev_fast)別の成績.

    手法の核心主張『5日線からの乖離が大きいほど反発しやすい(期待値が高い)』を検証。
    乖離が大きいバケットほど勝率/平均リターンが高ければ主張を支持する。
    """
    if trades.empty or "dev_fast" not in trades:
        return pd.DataFrame()
    tr = trades.copy()
    try:
        tr["bucket"] = pd.qcut(tr["dev_fast"], n_buckets, duplicates="drop")
    except Exception:
        return pd.DataFrame()
    g = (
        tr.groupby("bucket", observed=True)
        .agg(
            件数=("ret_net", "size"),
            勝率=("ret_net", lambda x: round(float((x > 0).mean()) * 100, 1)),
            平均リターン=("ret_net", lambda x: round(float(x.mean()) * 100, 3)),
        )
        .reset_index()
    )
    g["乖離帯"] = g["bucket"].astype(str)
    return g[["乖離帯", "件数", "勝率", "平均リターン"]]


def buy_and_hold_return(universe: dict) -> float | None:
    """対象銘柄を期間中ただ保有した場合の平均リターン(等ウェイト).

    戦略リターンがこれを大きく上回らなければ、優位性は『株が上がっただけ』の疑い。
    """
    rets = []
    for _code, df in universe.items():
        norm = normalize_ohlcv(df)
        if len(norm) >= 2:
            c = norm["Close"]
            if c.iloc[0] > 0:
                rets.append(float(c.iloc[-1] / c.iloc[0] - 1))
    if not rets:
        return None
    return float(np.mean(rets))
