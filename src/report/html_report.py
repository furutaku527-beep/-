"""スマホ(iPhone)で見やすい自己完結HTMLレポートを生成.

Streamlit を起動できない環境(リモートコンテナ等)でも、バックテスト結果を
1枚のHTMLとして書き出し、ブラウザやアプリ内ビューアで確認できるようにする。
plotly.js は CDN から読み込む(端末のネット接続が必要)。
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio

from .metrics import compute_metrics


def _equity_fig(equity: pd.DataFrame, initial_capital: float) -> go.Figure:
    eq = equity.copy()
    eq["Date"] = pd.to_datetime(eq["Date"])
    eq["peak"] = eq["equity"].cummax()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=eq["Date"], y=eq["equity"], mode="lines",
                             name="資産", line=dict(color="#1f77b4", width=2)))
    fig.add_hline(y=initial_capital, line_dash="dash", line_color="gray")
    fig.update_layout(
        height=300, margin=dict(l=8, r=8, t=10, b=8),
        legend=dict(orientation="h"), font=dict(size=13),
    )
    return fig


def _dd_fig(equity: pd.DataFrame) -> go.Figure:
    eq = equity.copy()
    eq["Date"] = pd.to_datetime(eq["Date"])
    eq["peak"] = eq["equity"].cummax()
    eq["dd"] = (eq["equity"] - eq["peak"]) / eq["peak"] * 100
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=eq["Date"], y=eq["dd"], fill="tozeroy",
                             line=dict(color="#d62728"), name="DD"))
    fig.update_layout(height=200, margin=dict(l=8, r=8, t=10, b=8),
                      yaxis_title="DD (%)", font=dict(size=13))
    return fig


def _metric_cards(m: dict) -> str:
    pf = m["profit_factor"]
    pf_s = "∞" if pf == float("inf") else f"{pf:.2f}"
    cards = [
        ("トレード件数", f"{m['n_trades']}"),
        ("勝率", f"{m['win_rate']*100:.1f}%"),
        ("損益合計", f"{m['total_pnl']:+,.0f}円"),
        ("PF", pf_s),
        ("最終資産", f"{m['final_equity']:,.0f}円"),
        ("リターン", f"{m['return_pct']*100:+.1f}%"),
        ("最大DD", f"{m['max_drawdown_pct']*100:.1f}%"),
        ("期待値/回", f"{m['expectancy']:+,.0f}円"),
    ]
    html = '<div class="grid">'
    for label, val in cards:
        html += f'<div class="card"><div class="label">{label}</div><div class="val">{val}</div></div>'
    html += "</div>"
    return html


def _trades_table(trades: pd.DataFrame, limit: int = 200) -> str:
    if trades.empty:
        return "<p>トレードなし</p>"
    show = trades.copy()
    show["日付"] = pd.to_datetime(show["Date"]).dt.date.astype(str)
    show["乖離"] = (show["dev_fast"] * 100).round(1).astype(str) + "%"
    show["損益"] = show["pnl"].round(0).map(lambda x: f"{x:+,.0f}")
    show["決済"] = show["exit_reason"].map({"close": "引け", "stop": "損切"})
    cols = {"日付": "日付", "Code": "銘柄", "決済": "決済", "乖離": "乖離", "損益": "損益(円)"}
    t = show[list(cols.keys())].rename(columns=cols).head(limit)
    rows = "".join(
        "<tr>" + "".join(f"<td>{v}</td>" for v in row) + "</tr>"
        for row in t.itertuples(index=False)
    )
    head = "".join(f"<th>{c}</th>" for c in t.columns)
    return f'<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>'


TEMPLATE = """<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>5日線デイトレ バックテスト結果</title>
<style>
  :root {{ color-scheme: light dark; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
         margin: 0; padding: 12px; background: #f7f7f9; color: #1a1a1a; }}
  h1 {{ font-size: 1.15rem; margin: 4px 0 2px; }}
  .sub {{ font-size: .75rem; color: #666; margin-bottom: 12px; }}
  h2 {{ font-size: .95rem; margin: 18px 0 8px; border-left: 4px solid #1f77b4; padding-left: 8px; }}
  .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }}
  .card {{ background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
  .card .label {{ font-size: .7rem; color: #888; }}
  .card .val {{ font-size: 1.05rem; font-weight: 700; margin-top: 2px; }}
  .chart {{ background: #fff; border-radius: 10px; padding: 4px; margin-top: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
  .tablewrap {{ overflow-x: auto; background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
  table {{ border-collapse: collapse; width: 100%; font-size: .8rem; }}
  th, td {{ padding: 7px 9px; text-align: right; white-space: nowrap; border-bottom: 1px solid #eee; }}
  th {{ background: #f0f2f6; position: sticky; top: 0; }}
  td:first-child, th:first-child {{ text-align: left; }}
  .note {{ font-size: .72rem; color: #777; margin-top: 16px; line-height: 1.5; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #1c1c1e; color: #eee; }}
    .card, .chart, .tablewrap {{ background: #2c2c2e; box-shadow: none; }}
    th {{ background: #3a3a3c; }} td {{ border-color: #3a3a3c; }}
    .card .val {{ color: #fff; }}
  }}
</style></head>
<body>
  <h1>📈 5日線デイトレード手法 バックテスト結果</h1>
  <div class="sub">{subtitle}</div>
  <h2>サマリー指標</h2>
  {cards}
  <h2>資産推移(エクイティカーブ)</h2>
  <div class="chart">{equity_chart}</div>
  <div class="chart">{dd_chart}</div>
  <h2>個別トレード一覧</h2>
  <div class="tablewrap">{table}</div>
  <div class="note">{note}</div>
</body></html>
"""


def build_html_report(
    result: dict,
    out_path: str | Path = "output/report.html",
    *,
    subtitle: str = "",
    is_demo: bool = False,
) -> Path:
    """バックテスト結果からスマホ向けHTMLレポートを生成して保存."""
    m = compute_metrics(result)
    equity = result["equity"]
    trades = result["trades"]
    initial = result["config"].initial_capital

    plot_kw = dict(include_plotlyjs="cdn", full_html=False,
                   config={"displayModeBar": False, "responsive": True})
    if not equity.empty:
        equity_chart = pio.to_html(_equity_fig(equity, initial), **plot_kw)
        dd_chart = pio.to_html(_dd_fig(equity), **plot_kw)
    else:
        equity_chart = dd_chart = "<p>トレードが発生しませんでした。</p>"

    demo_tag = "⚠️ デモ(合成データ)" if is_demo else "実データ"
    note = (
        "本検証は『5日線への押し目タッチ・リバウンド(ロング・デイトレ)』を日足で"
        "機械化したものです(strategy.md参照)。J-Quants無料プランは分足が無いため日中の"
        "値動きはOHLCで近似。板読み・特別気配回避・スキャル再現は対象外。"
        "過去データの検証であり将来の利益を保証しません。投資は自己責任で。"
    )

    html = TEMPLATE.format(
        subtitle=f"{demo_tag} ｜ {subtitle}",
        cards=_metric_cards(m),
        equity_chart=equity_chart,
        dd_chart=dd_chart,
        table=_trades_table(trades),
        note=note,
    )
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out
