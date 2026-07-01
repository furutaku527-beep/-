"""パイプラインのスモークテスト(合成データ).

J-Quants 認証なしで、戦略→バックテスト→指標算出が一貫して動くことを確認する。
"""

import pandas as pd

from tests.synthetic import make_daily, make_universe
from src.strategy import StrategyParams, generate_trades, normalize_ohlcv, add_indicators
from src.backtest import run_backtest, BacktestConfig
from src.report import compute_metrics


def test_normalize_and_indicators():
    df = make_daily(seed=1, n=120)
    norm = normalize_ohlcv(df)
    assert {"Open", "High", "Low", "Close", "Volume"}.issubset(norm.columns)
    ind = add_indicators(norm, StrategyParams())
    assert "MA_fast" in ind and "dev_fast" in ind
    # 5日線は5日目以降で値を持つ
    assert ind["MA_fast"].iloc[4:].notna().all()


def test_generate_trades_schema():
    df = make_daily(seed=2, n=300)
    trades = generate_trades(df, StrategyParams())
    expected = {"Date", "Code", "entry", "exit", "exit_reason", "ret_gross"}
    assert expected.issubset(trades.columns)
    # 損切りトレードのリターンは下限(-stop_pct - 端数)以上
    if not trades.empty:
        assert trades["ret_gross"].min() >= -StrategyParams().stop_pct - 1e-6


def test_screening_filters_short_history():
    short = make_daily(seed=5, n=30)  # 60日未満
    trades = generate_trades(short, StrategyParams(), apply_screening=True)
    assert trades.empty


def test_backtest_end_to_end():
    universe = make_universe(n=300)
    result = run_backtest(universe, StrategyParams(), BacktestConfig())
    m = compute_metrics(result)
    assert m["n_trades"] >= 0
    assert "win_rate" in m and "profit_factor" in m and "max_drawdown" in m
    # エクイティ初期値整合
    if m["n_trades"] > 0:
        assert not result["equity"].empty


def test_costs_reduce_return():
    # 手数料を上げると正味リターンは総リターンより小さくなる
    from src.backtest.engine import _apply_costs
    p = StrategyParams(fee_rate=0.001, slippage_pct=0.001)
    assert _apply_costs(0.02, p) < 0.02


def test_v2_field_mapping_standardize():
    """V2実データの短縮列名(O/H/L/C/Vo/AdjC…)を標準列へ正しくマップする回帰テスト."""
    from src.data.jquants_client import JQuantsClient
    rows = [{
        "Date": "2024-07-11", "Code": "38250", "O": 100, "H": 110, "L": 95, "C": 105,
        "UL": 130, "LL": 70, "Vo": 1_000_000, "Va": 105_000_000, "AdjFactor": 1.0,
        "AdjO": 100, "AdjH": 110, "AdjL": 95, "AdjC": 105, "AdjVo": 1_000_000,
    }]
    std = JQuantsClient._standardize(rows)
    for col in ["Open", "High", "Low", "Close", "Volume", "AdjustmentClose"]:
        assert col in std.columns, f"{col} が標準化されていない"
    assert float(std["Close"].iloc[0]) == 105


def test_v2_mapped_data_generates_trades():
    """V2列名の生データからトレードが生成される(0件バグの回帰防止)."""
    import numpy as np
    from src.data.jquants_client import JQuantsClient
    rng = np.random.default_rng(1)
    n = 300
    dates = pd.bdate_range("2024-01-01", periods=n)
    close = 300 * np.exp(np.cumsum(rng.normal(0.0005, 0.03, n)))
    rows = []
    for i in range(n):
        c = close[i]
        hi = c * (1 + abs(rng.normal(0, 0.03)))
        lo = c * (1 - abs(rng.normal(0, 0.03)))
        o = lo + rng.random() * (hi - lo)
        rows.append({
            "Date": dates[i].strftime("%Y-%m-%d"), "Code": "38250",
            "O": o, "H": max(hi, o, c), "L": min(lo, o, c), "C": c,
            "Vo": int(rng.integers(1e6, 5e6)),
        })
    std = JQuantsClient._standardize(rows)
    trades = generate_trades(std, StrategyParams(), apply_screening=False)
    assert len(trades) > 0, "V2データからトレードが1件も出ていない(マッピング不良の疑い)"


def test_screener_filters_low_priced_and_prime():
    """低位株スクリーナー: 高価格/低流動性/プライムを除外する."""
    from src.data.screener import screen_low_priced

    class FakeClient:
        def get_quotes_by_date(self, d):
            return pd.DataFrame([
                {"Code": "3719", "Close": 300, "High": 330, "Low": 290, "Volume": 5_000_000},
                {"Code": "7203", "Close": 2800, "High": 2820, "Low": 2790, "Volume": 3_000_000},
                {"Code": "9999", "Close": 400, "High": 410, "Low": 399, "Volume": 1000},
                {"Code": "2191", "Close": 800, "High": 900, "Low": 780, "Volume": 2_000_000},
            ])

        def get_listed_info(self):
            return pd.DataFrame([
                {"code": "3719", "market_code_name": "グロース"},
                {"code": "7203", "market_code_name": "プライム"},
                {"code": "2191", "market_code_name": "スタンダード"},
            ])

    res = screen_low_priced(FakeClient(), "2025-01-10", max_price=1000,
                            min_turnover=5e7, top_n=10, exclude_prime=True)
    assert set(res["Code"]) == {"3719", "2191"}


def test_dev_min_zero_yields_more_trades():
    """乖離ゲートを0にすると、3%必須より多くのトレードが出る(忠実化)."""
    df = make_daily(seed=3, n=300)
    n0 = len(generate_trades(df, StrategyParams(dev_min=0.0), apply_screening=False))
    n3 = len(generate_trades(df, StrategyParams(dev_min=0.03), apply_screening=False))
    assert n0 >= n3


def test_no_lookahead():
    """先読み防止: 後日のデータを足しても、過去のトレードは一切変わらない."""
    p = StrategyParams()
    df = make_daily(seed=7, n=250)
    full = generate_trades(df, p, apply_screening=False)

    cut = 160
    df_trunc = df.iloc[:cut].copy()
    part = generate_trades(df_trunc, p, apply_screening=False)

    # 切り詰めた範囲のトレードは、全期間版と完全一致するはず
    last_date = pd.to_datetime(df_trunc["Date"]).max()
    full_sub = full[full["Date"] <= last_date].reset_index(drop=True)
    part = part.reset_index(drop=True)

    assert len(part) == len(full_sub), "切り詰めでトレード件数が変化(=先読みの疑い)"
    if not part.empty:
        assert (abs(part["entry"].values - full_sub["entry"].values) < 1e-9).all()
        assert (abs(part["exit"].values - full_sub["exit"].values) < 1e-9).all()


def test_entry_uses_prior_day_line():
    """エントリー価格(=基準線)は前日までで確定したMA5であること(当日終値非依存)."""
    from src.strategy.indicators import normalize_ohlcv, add_indicators
    p = StrategyParams()
    df = make_daily(seed=2, n=300)
    trades = generate_trades(df, p, apply_screening=False)
    ind = add_indicators(normalize_ohlcv(df), p).set_index("Date")
    for _, tr in trades.iterrows():
        # その日の MA5(当日終値込み)とは一致せず、前日 MA5 と一致するはず
        prev_idx = ind.index.get_loc(tr["Date"]) - 1
        prev_ma = ind["MA_fast"].iloc[prev_idx]
        assert abs(tr["entry"] - prev_ma) < 1e-9
