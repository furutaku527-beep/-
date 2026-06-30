"""バックテスト結果の指標算出.

勝率、損益合計、プロフィットファクター、最大ドローダウン、トレード件数 ほか。
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def compute_metrics(result: dict) -> dict:
    """run_backtest の戻り値から主要指標を算出して dict で返す."""
    trades: pd.DataFrame = result["trades"]
    equity: pd.DataFrame = result["equity"]
    cfg = result["config"]

    n = len(trades)
    if n == 0:
        return {
            "n_trades": 0, "win_rate": 0.0, "total_pnl": 0.0,
            "profit_factor": 0.0, "max_drawdown": 0.0, "max_drawdown_pct": 0.0,
            "final_equity": cfg.initial_capital, "return_pct": 0.0,
            "avg_win": 0.0, "avg_loss": 0.0, "expectancy": 0.0,
            "gross_profit": 0.0, "gross_loss": 0.0, "sharpe_daily": 0.0,
        }

    pnl = trades["pnl"]
    wins = pnl[pnl > 0]
    losses = pnl[pnl < 0]

    gross_profit = float(wins.sum())
    gross_loss = float(-losses.sum())  # 正の値
    total_pnl = float(pnl.sum())

    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    win_rate = len(wins) / n

    # 最大ドローダウン(エクイティカーブから)
    eq = equity["equity"].to_numpy()
    peak = np.maximum.accumulate(eq)
    dd = eq - peak
    dd_pct = dd / peak
    max_dd = float(dd.min()) if len(dd) else 0.0
    max_dd_pct = float(dd_pct.min()) if len(dd_pct) else 0.0

    # 日次リターンから簡易シャープ(年率化)
    day_pnl = equity["day_pnl"].to_numpy() if "day_pnl" in equity else np.array([])
    if len(day_pnl) > 1:
        base = np.concatenate([[cfg.initial_capital], eq[:-1]])
        day_ret = day_pnl / base
        sharpe = (
            day_ret.mean() / day_ret.std() * np.sqrt(252)
            if day_ret.std() > 0 else 0.0
        )
    else:
        sharpe = 0.0

    final_equity = float(eq[-1]) if len(eq) else cfg.initial_capital

    return {
        "n_trades": int(n),
        "win_rate": float(win_rate),
        "total_pnl": total_pnl,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "profit_factor": float(profit_factor),
        "max_drawdown": max_dd,
        "max_drawdown_pct": max_dd_pct,
        "final_equity": final_equity,
        "return_pct": (final_equity - cfg.initial_capital) / cfg.initial_capital,
        "avg_win": float(wins.mean()) if len(wins) else 0.0,
        "avg_loss": float(losses.mean()) if len(losses) else 0.0,
        "expectancy": float(pnl.mean()),
        "sharpe_daily": float(sharpe),
    }


def format_metrics(m: dict) -> str:
    """指標を人間可読なテキストに整形(CLI出力用)."""
    pf = m["profit_factor"]
    pf_s = "∞" if pf == float("inf") else f"{pf:.2f}"
    return (
        f"トレード件数 : {m['n_trades']}\n"
        f"勝率         : {m['win_rate']*100:.1f}%\n"
        f"損益合計     : {m['total_pnl']:+,.0f} 円\n"
        f"総利益/総損失: {m['gross_profit']:,.0f} / {m['gross_loss']:,.0f} 円\n"
        f"プロフィットファクター: {pf_s}\n"
        f"期待値/トレード: {m['expectancy']:+,.0f} 円\n"
        f"平均利益/平均損失: {m['avg_win']:+,.0f} / {m['avg_loss']:+,.0f} 円\n"
        f"最大ドローダウン: {m['max_drawdown']:,.0f} 円 ({m['max_drawdown_pct']*100:.1f}%)\n"
        f"最終資産     : {m['final_equity']:,.0f} 円 (リターン {m['return_pct']*100:+.1f}%)\n"
        f"日次シャープ(年率): {m['sharpe_daily']:.2f}"
    )
