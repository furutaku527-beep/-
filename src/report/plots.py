"""資産推移などのグラフ出力(matplotlib).

ダッシュボードは plotly を使うが、CLI/保存用に matplotlib 版も用意する。
"""

from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # GUI なし環境向け
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def plot_equity_curve(result: dict, out_path: str | Path = "output/equity.png") -> Path:
    """エクイティカーブ + ドローダウンを2段で描画して保存."""
    equity: pd.DataFrame = result["equity"]
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    if equity.empty:
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.set_title("No trades")
        fig.savefig(out, dpi=120, bbox_inches="tight")
        plt.close(fig)
        return out

    dates = pd.to_datetime(equity["Date"])
    eq = equity["equity"].to_numpy()
    peak = np.maximum.accumulate(eq)
    dd_pct = (eq - peak) / peak * 100

    fig, (ax1, ax2) = plt.subplots(
        2, 1, figsize=(11, 6), sharex=True, gridspec_kw={"height_ratios": [3, 1]}
    )
    ax1.plot(dates, eq, color="#1f77b4", lw=1.5)
    ax1.fill_between(dates, eq, peak, where=eq < peak, color="#ff7f0e", alpha=0.15)
    ax1.set_ylabel("Equity (JPY)")
    ax1.set_title("Equity Curve")
    ax1.grid(alpha=0.3)

    ax2.fill_between(dates, dd_pct, 0, color="#d62728", alpha=0.4)
    ax2.set_ylabel("DD (%)")
    ax2.set_xlabel("Date")
    ax2.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(out, dpi=120, bbox_inches="tight")
    plt.close(fig)
    return out
