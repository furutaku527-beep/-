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

import random
from datetime import date
from typing import Optional

import pandas as pd

from .jquants_client import JQuantsClient

# 上場マスタで銘柄コードを表しうる列名の候補
_CODE_COL_CANDIDATES = ["code", "Code", "local_code", "LocalCode", "ticker", "Ticker"]

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


def _code_col(master: pd.DataFrame) -> Optional[str]:
    return next((c for c in _CODE_COL_CANDIDATES if c in master.columns), None)


def select_nonprime_codes(
    client: JQuantsClient,
    *,
    exclude_prime: bool = True,
    seed: int = 42,
    diag: Optional[dict] = None,
) -> list[str]:
    """上場マスタ(無料プランで取得可)から銘柄コード一覧を作る.

    プライム市場をベストエフォートで除外し、市場全体を満遍なくサンプリングするため
    決定的にシャッフルして返す(キャッシュと再現性のため seed 固定)。
    """
    master = client.get_listed_info()
    if diag is not None:
        diag["master_rows"] = int(len(master))
        diag["master_columns"] = list(master.columns)
    code_col = _code_col(master)
    if code_col is None:
        if diag is not None:
            diag["code_col_found"] = False
        return []

    codes_df = master[[code_col]].astype(str).rename(columns={code_col: "_code"})
    mkt = _market_series(master)
    if exclude_prime and mkt is not None:
        keep = ~mkt.str.lower().apply(lambda v: any(t in v for t in _PRIME_TOKENS))
        codes = master.loc[keep.values, code_col].astype(str).tolist()
        if diag is not None:
            diag["nonprime_codes"] = int(len(codes))
    else:
        codes = codes_df["_code"].tolist()
        if diag is not None and exclude_prime:
            diag["market_col_found"] = False

    # 5桁→4桁の重複や欠損を除き、決定的にシャッフル
    codes = [c for c in dict.fromkeys(codes) if c and c.lower() != "nan"]
    random.Random(seed).shuffle(codes)
    return codes


def qualifies_low_priced(
    df: pd.DataFrame,
    *,
    max_price: float = 1000.0,
    min_turnover: float = 5e7,
    min_range_pct: float = 0.0,
    min_history_days: int = 60,
) -> bool:
    """取得済みの日足から、低位・流動性・ボラの条件を満たすか判定.

    列欠損や欠測に対して堅牢(欠けていれば False を返し、例外を投げない)。
    列名は大文字小文字の揺れも吸収する。
    """
    if df is None or getattr(df, "empty", True) or len(df) < min_history_days:
        return False
    cols = {str(c).lower(): c for c in df.columns}
    if "close" not in cols or "volume" not in cols:
        return False

    recent = df.tail(20)
    close = pd.to_numeric(recent[cols["close"]], errors="coerce")
    vol = pd.to_numeric(recent[cols["volume"]], errors="coerce")
    close_valid = close.dropna()
    if close_valid.empty:
        return False

    last_close = float(close_valid.iloc[-1])
    turnover = float((close * vol).mean())

    if "high" in cols and "low" in cols:
        high = pd.to_numeric(recent[cols["high"]], errors="coerce")
        low = pd.to_numeric(recent[cols["low"]], errors="coerce")
        range_pct = float(((high - low) / close).mean())
    else:
        range_pct = float("nan")

    return bool(
        last_close > 0
        and last_close < max_price
        and turnover >= min_turnover
        and (pd.isna(range_pct) or range_pct >= min_range_pct)
    )


def screen_low_priced(
    client: JQuantsClient,
    snapshot_date: str | date,
    *,
    max_price: float = 1000.0,
    min_turnover: float = 5e7,
    min_range_pct: float = 0.0,
    top_n: int = 50,
    exclude_prime: bool = True,
    diag: Optional[dict] = None,
) -> pd.DataFrame:
    """指定日のスナップショットから低位株候補を抽出して返す.

    diag(dict)を渡すと、各段階の件数・列名・価格レンジを記録する(原因切り分け用)。

    Returns
    -------
    DataFrame
        列: Code, Close, Volume, turnover, range_pct(, market)
        売買代金の大きい順、最大 top_n 件。
    """
    snap = client.get_quotes_by_date(snapshot_date)
    if diag is not None:
        diag["snapshot_rows"] = int(len(snap))
        diag["columns"] = list(snap.columns)
    if snap.empty:
        return pd.DataFrame(columns=["Code", "Close", "Volume", "turnover", "range_pct"])

    if diag is not None and "Close" in snap.columns:
        cl = pd.to_numeric(snap["Close"], errors="coerce")
        diag["close_min"] = float(cl.min())
        diag["close_max"] = float(cl.max())
        diag["close_lt_max_price"] = int((cl < max_price).sum())

    snap = snap.dropna(subset=["Close", "Volume"]).copy()
    snap["Close"] = pd.to_numeric(snap["Close"], errors="coerce")
    snap["Volume"] = pd.to_numeric(snap["Volume"], errors="coerce")
    snap["High"] = pd.to_numeric(snap.get("High"), errors="coerce")
    snap["Low"] = pd.to_numeric(snap.get("Low"), errors="coerce")
    snap = snap.dropna(subset=["Close", "Volume"])

    snap["turnover"] = snap["Close"] * snap["Volume"]
    snap["range_pct"] = (snap["High"] - snap["Low"]) / snap["Close"]

    cond_price = (snap["Close"] > 0) & (snap["Close"] < max_price)
    cond_turn = snap["turnover"] >= min_turnover
    cond_range = snap["range_pct"].fillna(0) >= min_range_pct
    if diag is not None:
        diag["pass_price"] = int(cond_price.sum())
        diag["pass_price_turnover"] = int((cond_price & cond_turn).sum())
        diag["pass_all_filters"] = int((cond_price & cond_turn & cond_range).sum())
    cand = snap[cond_price & cond_turn & cond_range].copy()

    # プライム市場を除外(マスタが取得でき、市場列が判別できる場合のみ・ベストエフォート)
    if exclude_prime and not cand.empty:
        try:
            master = client.get_listed_info()
            if diag is not None:
                diag["master_rows"] = int(len(master))
                diag["master_columns"] = list(master.columns)
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
                before = len(cand)
                cand = cand[~cand["Code"].astype(str).isin(prime_codes)]
                if diag is not None:
                    diag["prime_excluded"] = int(before - len(cand))
            elif diag is not None:
                diag["market_col_found"] = False
        except Exception as exc:  # noqa: BLE001
            if diag is not None:
                diag["master_error"] = str(exc)[:150]

    cand = cand.sort_values("turnover", ascending=False).head(top_n)
    cols = [c for c in ["Code", "Close", "Volume", "turnover", "range_pct"] if c in cand.columns]
    return cand[cols].reset_index(drop=True)
