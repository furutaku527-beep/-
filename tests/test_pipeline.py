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
