"""5日線デイトレ手法 バックテスト確認ダッシュボード(Streamlit).

PC・iPhone どちらのブラウザからも確認できる構成。
表示内容:
  - エクイティカーブ(資産推移)
  - 個別トレード一覧
  - サマリー指標(勝率・損益合計・最大DD など)
  - 対象銘柄・期間・主要パラメータを画面で切り替え

起動:
    streamlit run dashboard/app.py
    # スマホからは表示される Network URL にアクセス(同一Wi-Fi)
    # 外出先からは streamlit run ... --server.address 0.0.0.0 + トンネル等
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.strategy import StrategyParams                       # noqa: E402
from src.backtest import run_backtest, BacktestConfig         # noqa: E402
from src.report import compute_metrics                        # noqa: E402
from src.data import load_daily, list_saved_codes             # noqa: E402

st.set_page_config(page_title="5日線デイトレ検証", layout="wide")


# ----------------------------------------------------------------------- #
# データ読み込み
# ----------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def load_universe(codes: tuple[str, ...], use_demo: bool) -> dict:
    if use_demo:
        from tests.synthetic import make_universe
        return make_universe(n=300)
    uni = {}
    for c in codes:
        df = load_daily(c)
        if not df.empty:
            uni[c] = df
    return uni


def filter_period(universe: dict, start, end) -> dict:
    out = {}
    for code, df in universe.items():
        d = df.copy()
        d["Date"] = pd.to_datetime(d["Date"])
        d = d[(d["Date"] >= pd.Timestamp(start)) & (d["Date"] <= pd.Timestamp(end))]
        if not d.empty:
            out[code] = d
    return out


# ----------------------------------------------------------------------- #
# サイドバー(設定)
# ----------------------------------------------------------------------- #
st.sidebar.title("⚙️ 設定")

saved = list_saved_codes()
use_demo = st.sidebar.toggle(
    "デモデータを使う(合成データ)", value=not saved,
    help="J-Quants 未取得でも動作確認できます。実データがあればOFF。",
)

if use_demo:
    st.sidebar.info("合成データで表示中(実データではありません)")
    all_codes = ["7203", "6758", "9984", "4591", "2884"]
else:
    all_codes = saved
    if not all_codes:
        st.sidebar.warning("data/raw に保存データがありません。先に scripts/fetch_data.py で取得してください。")

selected = st.sidebar.multiselect("対象銘柄", all_codes, default=all_codes)

st.sidebar.subheader("戦略パラメータ")
dev_min = st.sidebar.slider("最小乖離 dev_min", 0.0, 0.10, 0.03, 0.005,
                            help="エントリーに必要な前日終値と5日線の乖離")
stop_pct = st.sidebar.slider("損切り幅 stop_pct", 0.005, 0.05, 0.015, 0.005)
min_turnover_oku = st.sidebar.slider("最小売買代金(億円)", 0.0, 10.0, 1.0, 0.5)
exclude_prime = st.sidebar.checkbox("プライム市場を除外", value=False,
                                    help="市場区分データがある場合のみ有効")

st.sidebar.subheader("資金・コスト")
initial_capital = st.sidebar.number_input("初期資金(円)", 100_000, 100_000_000,
                                          1_000_000, 100_000)
position_frac = st.sidebar.slider("1トレード元本比", 0.01, 1.0, 0.10, 0.01)
fee_rate = st.sidebar.slider("手数料率(片道)", 0.0, 0.005, 0.0005, 0.0001, format="%.4f")
slippage = st.sidebar.slider("スリッページ(片道)", 0.0, 0.005, 0.001, 0.0001, format="%.4f")
apply_screening = st.sidebar.checkbox("スクリーニング適用", value=True)


# ----------------------------------------------------------------------- #
# 実行
# ----------------------------------------------------------------------- #
st.title("📈 5日線デイトレード手法 バックテスト")
st.caption("シンジ氏 note手法(5日線軸)を日足で検証 — 過去データ検証であり将来の利益を保証しません")

universe = load_universe(tuple(selected), use_demo)
universe = {k: v for k, v in universe.items() if k in selected}

if not universe:
    st.warning("対象データがありません。サイドバーで銘柄を選ぶか、デモデータをONにしてください。")
    st.stop()

# 期間の範囲を算出して日付スライダー
all_dates = pd.concat([pd.to_datetime(df["Date"]) for df in universe.values()])
dmin, dmax = all_dates.min().date(), all_dates.max().date()
period = st.slider("検証期間", dmin, dmax, (dmin, dmax))
universe = filter_period(universe, period[0], period[1])

if not universe:
    st.warning("選択期間にデータがありません。")
    st.stop()

params = StrategyParams(
    dev_min=dev_min, stop_pct=stop_pct, min_turnover=min_turnover_oku * 1e8,
    exclude_prime=exclude_prime, fee_rate=fee_rate, slippage_pct=slippage,
)
config = BacktestConfig(initial_capital=initial_capital, position_frac=position_frac)

result = run_backtest(universe, params, config, apply_screening=apply_screening)
metrics = compute_metrics(result)
trades = result["trades"]
equity = result["equity"]


# ----------------------------------------------------------------------- #
# サマリー指標
# ----------------------------------------------------------------------- #
st.subheader("サマリー指標")
pf = metrics["profit_factor"]
pf_s = "∞" if pf == float("inf") else f"{pf:.2f}"

c1, c2, c3, c4 = st.columns(4)
c1.metric("トレード件数", f"{metrics['n_trades']}")
c2.metric("勝率", f"{metrics['win_rate']*100:.1f}%")
c3.metric("損益合計", f"{metrics['total_pnl']:+,.0f} 円")
c4.metric("プロフィットファクター", pf_s)

c5, c6, c7, c8 = st.columns(4)
c5.metric("最終資産", f"{metrics['final_equity']:,.0f} 円", f"{metrics['return_pct']*100:+.1f}%")
c6.metric("最大ドローダウン", f"{metrics['max_drawdown_pct']*100:.1f}%",
          f"{metrics['max_drawdown']:,.0f} 円")
c7.metric("期待値/トレード", f"{metrics['expectancy']:+,.0f} 円")
c8.metric("日次シャープ(年率)", f"{metrics['sharpe_daily']:.2f}")


# ----------------------------------------------------------------------- #
# エクイティカーブ
# ----------------------------------------------------------------------- #
st.subheader("資産推移(エクイティカーブ)")
if equity.empty:
    st.info("この条件ではトレードが発生しませんでした。乖離やスクリーニング条件を緩めてみてください。")
else:
    eq = equity.copy()
    eq["Date"] = pd.to_datetime(eq["Date"])
    eq["peak"] = eq["equity"].cummax()
    eq["dd_pct"] = (eq["equity"] - eq["peak"]) / eq["peak"] * 100

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=eq["Date"], y=eq["equity"], mode="lines",
                             name="資産", line=dict(color="#1f77b4")))
    fig.add_trace(go.Scatter(x=eq["Date"], y=eq["peak"], mode="lines",
                             name="ピーク", line=dict(color="#bbbbbb", dash="dot")))
    fig.add_hline(y=initial_capital, line_dash="dash", line_color="gray",
                  annotation_text="初期資金")
    fig.update_layout(height=380, margin=dict(l=10, r=10, t=30, b=10),
                      legend=dict(orientation="h"))
    st.plotly_chart(fig, width='stretch')

    fig_dd = go.Figure()
    fig_dd.add_trace(go.Scatter(x=eq["Date"], y=eq["dd_pct"], fill="tozeroy",
                                line=dict(color="#d62728"), name="ドローダウン"))
    fig_dd.update_layout(height=200, margin=dict(l=10, r=10, t=10, b=10),
                         yaxis_title="DD (%)")
    st.plotly_chart(fig_dd, width='stretch')


# ----------------------------------------------------------------------- #
# トレード一覧
# ----------------------------------------------------------------------- #
st.subheader("個別トレード一覧")
if trades.empty:
    st.info("トレードなし")
else:
    show = trades.copy()
    show["Date"] = pd.to_datetime(show["Date"]).dt.date
    show = show.rename(columns={
        "Date": "日付", "Code": "銘柄", "entry": "エントリー", "exit": "エグジット",
        "exit_reason": "決済理由", "dev_fast": "乖離", "ret_net": "リターン(正味)",
        "pnl": "損益(円)", "equity_after": "約定後資産",
    })
    show["乖離"] = (show["乖離"] * 100).round(2).astype(str) + "%"
    show["リターン(正味)"] = (show["リターン(正味)"] * 100).round(2).astype(str) + "%"
    cols = ["日付", "銘柄", "エントリー", "エグジット", "決済理由", "乖離",
            "リターン(正味)", "損益(円)", "約定後資産"]
    st.dataframe(
        show[cols].style.format({"損益(円)": "{:+,.0f}", "約定後資産": "{:,.0f}",
                                 "エントリー": "{:,.1f}", "エグジット": "{:,.1f}"}),
        width='stretch', height=360,
    )
    csv = trades.to_csv(index=False).encode("utf-8-sig")
    st.download_button("トレード明細をCSVダウンロード", csv, "trades.csv", "text/csv")

with st.expander("ℹ️ 手法と検証範囲について"):
    st.markdown(
        "- 本検証は **5日線への押し目タッチ・リバウンド(ロング・デイトレ)** を"
        "日足で機械化したものです(`strategy.md` 参照)。\n"
        "- J-Quants 無料プランは日足のみで分足が無いため、日中の値動きは"
        "OHLCで近似しています。板読み・特別気配回避・1日数百回のスキャルは再現対象外です。\n"
        "- 過去データでの検証であり、将来の利益を保証しません。投資は自己責任で。"
    )
