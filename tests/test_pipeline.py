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
