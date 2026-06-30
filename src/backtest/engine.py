"""バックテストエンジン.

複数銘柄のユニバースに戦略を適用し、デイトレード(同一日内)を日次で積み上げて
資産推移(エクイティカーブ)とトレード明細を作る。

資金管理(簡易):
- 1トレードに `equity * position_frac` の想定元本を割り当てる。
- 同一日にシグナルが多い場合は乖離(期待値)の大きい順に `max_positions` 件まで採用。
- 損益は当日内で確定し、翌日の資金に反映(複利)。

手数料・スリッページは往復(エントリー+エグジット)で控除する。
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from ..strategy import StrategyParams, generate_trades


@dataclass
class BacktestConfig:
    initial_capital: float = 1_000_000.0  # 初期資金(円)
    position_frac: float = 0.10           # 1トレードの想定元本(資産比)
    max_positions: int = 5                # 同一日の最大採用トレード数


def _apply_costs(ret_gross: float, p: StrategyParams) -> float:
    """往復の手数料・スリッページを控除した正味リターン率.

    エントリー時に (1 + fee + slip)、エグジット時に (1 - fee - slip) を掛ける近似。
    """
    cost = p.fee_rate + p.slippage_pct
    gross_mult = 1.0 + ret_gross
    net_mult = gross_mult * (1 - cost) / (1 + cost)
    return net_mult - 1.0


def run_backtest(
    universe: dict[str, pd.DataFrame],
    params: StrategyParams | None = None,
    config: BacktestConfig | None = None,
    *,
    apply_screening: bool = True,
) -> dict:
    """ユニバース全体でバックテストを実行.

    Parameters
    ----------
    universe : {code: 日足DataFrame}
    params : StrategyParams
    config : BacktestConfig

    Returns
    -------
    dict
        {
          "trades": 全トレード明細(net損益・資産反映後),
          "equity": 日次エクイティカーブ DataFrame[Date, equity],
          "params": params, "config": config,
        }
    """
    p = params or StrategyParams()
    cfg = config or BacktestConfig()

    # 1) 各銘柄のシグナル/候補トレードを集約
    all_trades = []
    for code, df in universe.items():
        t = generate_trades(df, p, code=code, apply_screening=apply_screening)
        if not t.empty:
            all_trades.append(t)

    if not all_trades:
        return {
            "trades": _empty_result_trades(),
            "equity": pd.DataFrame(columns=["Date", "equity"]),
            "params": p, "config": cfg,
        }

    trades = pd.concat(all_trades, ignore_index=True)
    trades["ret_net"] = trades["ret_gross"].apply(lambda r: _apply_costs(r, p))
    trades = trades.sort_values(["Date", "dev_fast"], ascending=[True, False])

    # 2) 日次ループで資金を積み上げ
    equity = cfg.initial_capital
    equity_rows = []
    executed_rows = []

    for date, day_trades in trades.groupby("Date", sort=True):
        # 期待値(乖離)の大きい順に max_positions 件まで
        picked = day_trades.head(cfg.max_positions)
        day_pnl = 0.0
        capital_per_trade = equity * cfg.position_frac
        for _, tr in picked.iterrows():
            pnl = capital_per_trade * tr["ret_net"]
            day_pnl += pnl
            executed_rows.append(
                {
                    "Date": tr["Date"],
                    "Code": tr["Code"],
                    "entry": tr["entry"],
                    "exit": tr["exit"],
                    "exit_reason": tr["exit_reason"],
                    "dev_fast": tr["dev_fast"],
                    "ret_gross": tr["ret_gross"],
                    "ret_net": tr["ret_net"],
                    "capital": capital_per_trade,
                    "pnl": pnl,
                    "equity_after": None,  # 後で埋める
                }
            )
        equity += day_pnl
        # その日のトレードに当日終了時資産を記録(picked が空なら何もしない)
        n_pick = len(picked)
        if n_pick:
            for row in executed_rows[-n_pick:]:
                row["equity_after"] = equity
        equity_rows.append({"Date": date, "equity": equity, "day_pnl": day_pnl,
                            "n_trades": n_pick})

    executed = pd.DataFrame(executed_rows)
    equity_curve = pd.DataFrame(equity_rows)

    return {
        "trades": executed,
        "equity": equity_curve,
        "params": p,
        "config": cfg,
    }


def _empty_result_trades() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "Date", "Code", "entry", "exit", "exit_reason", "dev_fast",
            "ret_gross", "ret_net", "capital", "pnl", "equity_after",
        ]
    )
