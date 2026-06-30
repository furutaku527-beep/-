#!/usr/bin/env python
"""バックテストを実行してレポートを出力する CLI.

ローカル保存済みデータ(data/raw/*.parquet)を使う。データが無い場合は
--demo で合成データを用いて全パイプラインの動作確認ができる。

使い方:
    # 保存済みデータでバックテスト
    python scripts/run_backtest.py --codes 7203 6758 9984

    # データ未取得でもパイプライン確認(合成データ)
    python scripts/run_backtest.py --demo
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.strategy import StrategyParams                       # noqa: E402
from src.backtest import run_backtest, BacktestConfig         # noqa: E402
from src.report import compute_metrics, format_metrics, plot_equity_curve  # noqa: E402
from src.data import load_daily, list_saved_codes             # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="5日線デイトレ手法 バックテスト")
    parser.add_argument("--codes", nargs="+", default=None, help="対象銘柄(省略時は保存済み全件)")
    parser.add_argument("--demo", action="store_true", help="合成データで動作確認")
    parser.add_argument("--no-screening", action="store_true", help="スクリーニング無効化")
    parser.add_argument("--dev-min", type=float, default=None, help="最小乖離(既定0.03)")
    parser.add_argument("--out", default="output/equity.png", help="エクイティカーブ出力先")
    args = parser.parse_args()

    params = StrategyParams()
    if args.dev_min is not None:
        params.dev_min = args.dev_min

    universe = _load_universe(args)
    if not universe:
        print("対象データがありません。--demo か、先に scripts/fetch_data.py で取得してください。")
        return 1

    print(f"対象銘柄: {len(universe)} 件  期間: {_period(universe)}")
    result = run_backtest(
        universe, params, BacktestConfig(), apply_screening=not args.no_screening
    )
    metrics = compute_metrics(result)
    print("\n===== バックテスト結果 =====")
    print(format_metrics(metrics))

    path = plot_equity_curve(result, args.out)
    print(f"\nエクイティカーブを保存: {path}")
    return 0


def _load_universe(args) -> dict:
    if args.demo:
        from tests.synthetic import make_universe
        print("[demo] 合成データを使用します(実データではありません)")
        return make_universe(n=300)

    codes = args.codes or list_saved_codes()
    universe = {}
    for c in codes:
        df = load_daily(c)
        if not df.empty:
            universe[c] = df
        else:
            print(f"  {c}: 保存データなし(スキップ)")
    return universe


def _period(universe: dict) -> str:
    import pandas as pd
    mins, maxs = [], []
    for df in universe.values():
        d = pd.to_datetime(df["Date"])
        mins.append(d.min()); maxs.append(d.max())
    return f"{min(mins).date()} 〜 {max(maxs).date()}"


if __name__ == "__main__":
    raise SystemExit(main())
