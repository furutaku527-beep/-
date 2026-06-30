"""売買シグナル判定とデイトレード(同一日内)のトレード生成.

strategy.md セクション3「5日線 押し目タッチ・リバウンド(LONG)」を実装。

各営業日 t について、前日までの確定情報でセットアップを判定し、当日の OHLC で
押し目タッチ(Low が5日線到達)を検知したらエントリー、損切 or 引け決済する。
手数料・スリッページはバックテストエンジン側で適用する(ここでは総額ベース価格)。
"""

from __future__ import annotations

import pandas as pd

from .indicators import add_indicators, normalize_ohlcv
from .params import StrategyParams


def passes_screening(df: pd.DataFrame, params: StrategyParams) -> bool:
    """銘柄レベルのスクリーニング(母集団フィルタ).

    df は normalize_ohlcv 済み。履歴日数と直近流動性で判定する。
    プライム除外は市場区分が必要なため、ここではなく呼び出し側で扱う。
    """
    if len(df) < params.min_history_days:
        return False
    turnover = (df["Close"] * df["Volume"]).tail(20).mean()
    if pd.isna(turnover) or turnover < params.min_turnover:
        return False
    return True


def generate_trades(
    raw_df: pd.DataFrame,
    params: StrategyParams | None = None,
    *,
    code: str | None = None,
    apply_screening: bool = True,
) -> pd.DataFrame:
    """1銘柄の日足から、デイトレードの候補トレード一覧を生成.

    Parameters
    ----------
    raw_df : DataFrame
        J-Quants 生データ、または normalize 済みデータ。
    params : StrategyParams
    code : str
        銘柄コード(出力に付与)。raw_df に Code 列があればそちら優先。
    apply_screening : bool
        True なら IPO/流動性スクリーニングを適用。

    Returns
    -------
    DataFrame
        1行=1トレード。列:
        Date, Code, entry, exit, stop, exit_reason, ret_gross,
        dev_fast(前日乖離), ma_fast, ma_slow
        ret_gross は手数料・スリッページ控除前のリターン率。
    """
    p = params or StrategyParams()

    df = normalize_ohlcv(raw_df)
    if code is None and "Code" in df.columns and not df.empty:
        code = str(df["Code"].iloc[0])

    if apply_screening and not passes_screening(df, p):
        return _empty_trades()

    df = add_indicators(df, p)

    rows = []
    # 先読み防止: 当日 t のトレード判断には「前日までで確定した情報」だけを使う。
    #   - 基準となる5日線 line = 前日終値までで計算した MA5(= 寄り時点で既知)
    #   - セットアップ(向き・線の上・乖離)も t-1, t-2 の確定値で判定
    #   - 当日は OHLC(始値・高値・安値・終値)だけを約定に使う
    for i in range(2, len(df)):
        prev2 = df.iloc[i - 2]
        prev = df.iloc[i - 1]
        cur = df.iloc[i]

        line = prev["MA_fast"]            # 前日までで確定した5日線(未来情報を含まない)
        if pd.isna(line) or pd.isna(prev2["MA_fast"]):
            continue

        # --- セットアップ条件(前日までで確定)---
        rising = prev["MA_fast"] > prev2["MA_fast"]    # 前日時点で5日線が上向き
        above_line = prev["Close"] > prev["MA_fast"]   # 前日は線の上
        deviated = prev["dev_fast"] >= p.dev_min        # 前日終値が線から乖離
        if not (rising and above_line and deviated):
            continue

        # --- 当日トリガー: 確定した線への押し目タッチ ---
        touched = cur["Low"] <= line                    # 日中に前日5日線へタッチ
        if not touched:
            continue
        if p.require_open_above and cur["Open"] < line * (1 - p.open_buf):
            # 寄りから線を大きく割って始まる日は対象外(ギャップダウン回避)
            continue

        entry = line                                    # 線で拾う想定
        stop = line * (1 - p.stop_pct)

        # --- 決済(当日内で完結)---
        if cur["Low"] < stop:
            exit_price = stop                           # 線割れ → 損切
            reason = "stop"
        else:
            exit_price = cur["Close"]                   # 引け決済
            reason = "close"

        ret_gross = exit_price / entry - 1.0
        rows.append(
            {
                "Date": cur["Date"],
                "Code": code,
                "entry": entry,
                "exit": exit_price,
                "stop": stop,
                "exit_reason": reason,
                "ret_gross": ret_gross,
                "dev_fast": prev["dev_fast"],
                "ma_fast": line,
                "ma_slow": prev["MA_slow"],
            }
        )

    if not rows:
        return _empty_trades()
    return pd.DataFrame(rows)


def _empty_trades() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "Date", "Code", "entry", "exit", "stop",
            "exit_reason", "ret_gross", "dev_fast", "ma_fast", "ma_slow",
        ]
    )
