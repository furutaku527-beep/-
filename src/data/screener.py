"""低位株スクリーニング(手法の母集団づくり).

シンジ氏の手法は東証プライムの大型株ではなく、値動きの大きい低位・小型株が対象
(本人が「東証1部は苦手」と明言)。そこで全銘柄の日次スナップショットから、
  - 低位(終値 < max_price)
  - 流動性あり(売買代金 = 終値×出来高 が一定以上)
  - 値動きが大きい(任意・日中レンジ率)
  - (任意)プライム市場を除外
を満たす銘柄を抽出する。
"""

from __future__ import annotations

from datetime import date
from typing import Optional

import pandas as pd

from .jquants_client import JQuantsClient

# 上場マスタで市場区分を表しうる列名の候補(V2の正確な列名が不明なため複数試す)
_MARKET_COL_CANDIDATES = [
    "market_code_name", "MarketCodeName", "market_name",
    "market_code", "MarketCode", "market", "Market",
]
# 「プライム」を示す値の候補(コード/名称どちらでも拾えるように)
_PRIME_TOKENS = ["prime", "プライム", "0111"]  # 0111 は東証プライムのコード


def _market_series(master: pd.DataFrame) -> Optional[pd.Series]:
    for col in _MARKET_COL_CANDIDATES:
        if col in master.columns:
            return master[col].astype(str)
    return None


def screen_low_priced(
    client: JQuantsClient,
    snapshot_date: str | date,
    *,
    max_price: float = 1000.0,
    min_turnover: float = 5e7,
    min_range_pct: float = 0.0,
    top_n: int = 50,
    exclude_prime: bool = True,
) -> pd.DataFrame:
    """指定日のスナップショットから低位株候補を抽出して返す.

    Returns
    -------
    DataFrame
        列: Code, Close, Volume, turnover, range_pct(, market)
        売買代金の大きい順、最大 top_n 件。
    """
    snap = client.get_quotes_by_date(snapshot_date)
    if snap.empty:
        return pd.DataFrame(columns=["Code", "Close", "Volume", "turnover", "range_pct"])

    snap = snap.dropna(subset=["Close", "Volume"]).copy()
    snap["Close"] = pd.to_numeric(snap["Close"], errors="coerce")
    snap["Volume"] = pd.to_numeric(snap["Volume"], errors="coerce")
    snap["High"] = pd.to_numeric(snap.get("High"), errors="coerce")
    snap["Low"] = pd.to_numeric(snap.get("Low"), errors="coerce")
    snap = snap.dropna(subset=["Close", "Volume"])

    snap["turnover"] = snap["Close"] * snap["Volume"]
    snap["range_pct"] = (snap["High"] - snap["Low"]) / snap["Close"]

    cond = (
        (snap["Close"] > 0)
        & (snap["Close"] < max_price)
        & (snap["turnover"] >= min_turnover)
        & (snap["range_pct"].fillna(0) >= min_range_pct)
    )
    cand = snap[cond].copy()

    # プライム市場を除外(マスタが取得でき、市場列が判別できる場合のみ・ベストエフォート)
    if exclude_prime and not cand.empty:
        try:
            master = client.get_listed_info()
            mkt = _market_series(master)
            code_col = next(
                (c for c in ["code", "Code"] if c in master.columns), None
            )
            if mkt is not None and code_col is not None:
                master = master.assign(_mkt=mkt.str.lower(),
                                       _code=master[code_col].astype(str))
                is_prime = master["_mkt"].apply(
                    lambda v: any(t in v for t in _PRIME_TOKENS)
                )
                prime_codes = set(master.loc[is_prime, "_code"])
                cand = cand[~cand["Code"].astype(str).isin(prime_codes)]
        except Exception:
            pass  # マスタ取得失敗時はプライム除外をスキップ

    cand = cand.sort_values("turnover", ascending=False).head(top_n)
    cols = [c for c in ["Code", "Close", "Volume", "turnover", "range_pct"] if c in cand.columns]
    return cand[cols].reset_index(drop=True)
