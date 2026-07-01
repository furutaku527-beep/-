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

st.set_page_config(
    page_title="5日線デイトレ検証",
    page_icon="📈",
    layout="centered",          # iPhone縦画面で読みやすい
    initial_sidebar_state="collapsed",  # スマホは設定をたたんで開始
)

# スマホ表示の微調整(余白圧縮・タブ折返し・テーブル文字サイズ)
st.markdown(
    """
    <style>
      .block-container { padding-top: 1.2rem; padding-bottom: 2rem; }
      [data-testid="stMetricValue"] { font-size: 1.15rem; }
      [data-testid="stMetricLabel"] { font-size: .75rem; }
      .stTabs [data-baseweb="tab"] { padding: 6px 10px; }
      [data-testid="stDataFrame"] { font-size: .8rem; }
    </style>
    """,
    unsafe_allow_html=True,
)


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
from datetime import date, timedelta              # noqa: E402
from dashboard.data_source import (                # noqa: E402
    resolve_credentials, fetch_live, screen_and_fetch,
)

st.sidebar.title("⚙️ 設定")

saved = list_saved_codes()
has_creds = resolve_credentials()

# データソースの選択。手法は低位株が対象なので「自動スクリーニング」を主役にする。
source_options = [
    "低位株 自動スクリーニング",
    "J-Quantsから取得(銘柄指定)",
    "デモ(合成データ)",
    "保存済みデータ",
]
default_idx = 0 if has_creds else (3 if saved else 2)
source = st.sidebar.radio("データソース", source_options, index=default_idx)

use_demo = source == "デモ(合成データ)"
live_universe = None  # J-Quants取得時にセット

# 提供範囲に収まりやすい既定期間(終了=約100日前/開始=約2年前)
_def_to = date.today() - timedelta(days=100)
_def_from = date.today() - timedelta(days=720)

if source == "低位株 自動スクリーニング":
    if not has_creds:
        st.sidebar.error(
            "APIキーが未設定です。Secrets か .env の JQUANTS_API_KEY を設定してください。"
        )
    st.sidebar.caption(
        "無料プランは全銘柄一括取得が不可のため、上場マスタ→個別取得で選別します。"
    )
    st.sidebar.markdown("**スクリーニング条件**")
    max_price = st.sidebar.number_input("上限株価(円・低位株)", 100, 5000, 1000, 100)
    min_turn_oku = st.sidebar.slider("最小売買代金(億円)", 0.1, 10.0, 0.5, 0.1)
    min_range = st.sidebar.slider("最小日中変動率", 0.0, 0.15, 0.0, 0.01,
                                  help="直近20日平均の(高値-安値)/終値。0で無効")
    top_n = st.sidebar.slider("採用銘柄数(条件を満たす上位)", 5, 40, 15, 5)
    scan_limit = st.sidebar.slider("走査する銘柄数(多いほど精度↑/時間↑)",
                                   10, 100, 30, 5,
                                   help="無料プランはレート制限が厳しいため控えめ推奨")
    excl_prime = st.sidebar.checkbox("プライム市場を除外", value=True)
    st.sidebar.caption(
        "⚠️ 無料プランはレート制限あり。1件ずつ約0.8秒間隔で取得します"
        "(30銘柄で約30秒)。429が出たら数分おいて再実行してください。"
    )
    st.sidebar.markdown("**取得期間(バックテスト用)**")
    frm = st.sidebar.date_input("取得開始日", _def_from, key="scr_from")
    to = st.sidebar.date_input("取得終了日", _def_to, key="scr_to")
    if st.sidebar.button("🔎 スクリーニング & 取得", disabled=not has_creds):
        prog = st.sidebar.progress(0.0, text="準備中(銘柄マスタ取得)...")
        status = st.sidebar.empty()

        def _cb(scanned, total, selected, code):
            frac = min(scanned / max(total, 1), 1.0)
            prog.progress(frac, text=f"走査 {scanned}/{total}")
            status.info(f"🔎 走査 {scanned}/{total} ・ 選別 {selected}銘柄 ・ 現在 {code}")

        live_universe = screen_and_fetch(
            float(max_price), min_turn_oku * 1e8, float(min_range),
            int(top_n), int(scan_limit), bool(excl_prime), str(frm), str(to),
            progress_cb=_cb,
        )
        prog.progress(1.0, text="完了")
        n_sel = len(live_universe)
        if n_sel:
            status.success(f"✅ 完了: {n_sel}銘柄を選別しました")
        else:
            status.warning("⚠️ 条件を満たす銘柄が0件でした(下の診断を確認)")
        st.session_state["live_universe"] = live_universe
    live_universe = st.session_state.get("live_universe")
    if "_screen_table" in st.session_state and st.session_state["_screen_table"] is not None:
        n_hit = len(st.session_state["_screen_table"])
        diag = st.session_state.get("_screen_diag", {})
        scanned = diag.get("scanned")
        cap = f"選別 {n_hit} 銘柄"
        if scanned is not None:
            cap += f"(走査 {scanned} 銘柄中)"
        st.sidebar.caption(cap)
        if n_hit == 0 and diag:
            with st.sidebar.expander("🔧 スクリーニング診断(0件の原因)", expanded=True):
                st.json(diag)
    if "_fetch_errors" in st.session_state:
        st.sidebar.warning("一部取得できませんでした(先頭のみ):\n"
                           + "\n".join(st.session_state["_fetch_errors"][:5]))
    all_codes = sorted(live_universe.keys()) if live_universe else []
    if not all_codes:
        st.sidebar.caption("「スクリーニング & 取得」を押すと検証できます。")

elif use_demo:
    st.sidebar.info("合成データで表示中(実データではありません)")
    all_codes = ["7203", "6758", "9984", "4591", "2884"]

elif source == "J-Quantsから取得(銘柄指定)":
    if not has_creds:
        st.sidebar.error(
            "APIキーが未設定です。J-Quants ダッシュボードで発行した APIキーを "
            "Streamlit Secrets か .env の JQUANTS_API_KEY に設定してください。"
            "(2026年6月にメール/パスワード方式は廃止されAPIキー方式になりました)"
        )
        st.sidebar.caption("(設定済みなら再読み込みしてください)")
    # 低位・高ボラの小型株を初期値にセット(ボタン1回で試せるように)
    default_codes = "3825,4591,2158,6172,3672,4777,2743,3810,3990,2484,3667,6047"
    codes_text = st.sidebar.text_area(
        "銘柄コード(カンマ区切り)", default_codes, height=80,
        help="低位株の例を初期設定済み。自由に差し替え可",
    )
    frm = st.sidebar.date_input("取得開始日", _def_from)
    to = st.sidebar.date_input("取得終了日", _def_to)
    st.sidebar.caption("※無料プランは約12週間遅延・直近約2年。範囲外は自動調整します。")
    if st.sidebar.button("📥 データ取得 / 更新", disabled=not has_creds):
        codes = tuple(c.strip() for c in codes_text.split(",") if c.strip())
        prog = st.sidebar.progress(0.0, text="取得開始...")
        status = st.sidebar.empty()

        def _cb(done, total, ok, code):
            prog.progress(min(done / max(total, 1), 1.0), text=f"取得 {done}/{total}")
            status.info(f"📥 取得 {done}/{total} ・ 成功 {ok} ・ 現在 {code}")

        live_universe = fetch_live(codes, str(frm), str(to), progress_cb=_cb)
        prog.progress(1.0, text="完了")
        status.success(f"✅ 完了: {len(live_universe)}銘柄を取得しました")
        st.session_state["live_universe"] = live_universe
    live_universe = st.session_state.get("live_universe")
    if "_fetch_errors" in st.session_state:
        st.sidebar.warning("一部取得できませんでした:\n" + "\n".join(st.session_state["_fetch_errors"]))
    all_codes = sorted(live_universe.keys()) if live_universe else []
    if not all_codes:
        st.sidebar.caption("「データ取得」を押すと検証できます。")

else:  # 保存済みデータ
    all_codes = saved
    if not all_codes:
        st.sidebar.warning("data/raw に保存データがありません。先に scripts/fetch_data.py で取得してください。")

selected = st.sidebar.multiselect("対象銘柄", all_codes, default=all_codes)

st.sidebar.subheader("戦略パラメータ")
dev_min = st.sidebar.slider("最小乖離 dev_min", 0.0, 0.10, 0.0, 0.005,
                            help="0=押し目タッチで広くエントリー。上げると『大きな乖離からの押し目(激アツ)』に絞る")
stop_pct = st.sidebar.slider("損切り幅 stop_pct", 0.005, 0.08, 0.03, 0.005,
                             help="低位株はノイズが大きいので広め推奨(狭いと刈られやすい)")
take_profit = st.sidebar.slider("利確幅 take_profit(0=無効)", 0.0, 0.10, 0.0, 0.005,
                                help=">0で日中高値が目標に届いたら利確(スキャル的)。0は引けまで保有")
tp_priority = st.sidebar.selectbox(
    "同日にTP/損切り両到達時の優先", ["stop(保守)", "tp(楽観)"], index=0,
    help="日足では日中の順序が不明なため。stop=保守的",
)
min_turnover_oku = st.sidebar.slider("最小売買代金(億円・銘柄フィルタ)", 0.0, 10.0, 0.5, 0.5)
exclude_prime = st.sidebar.checkbox(
    "プライム市場を除外(準備中)", value=False, disabled=True,
    help="市場区分データの取得が必要なため未対応。今後 listed_info から実装予定。",
)

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

if source in ("低位株 自動スクリーニング", "J-Quantsから取得(銘柄指定)"):
    universe = {k: v for k, v in (live_universe or {}).items() if k in selected}
else:
    universe = load_universe(tuple(selected), use_demo)
    universe = {k: v for k, v in universe.items() if k in selected}

if not universe:
    st.warning("対象データがありません。サイドバーでデータソース・銘柄を選んでください"
               "(J-Quants取得/スクリーニングの場合はボタンを押してください)。")
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
    take_profit_pct=take_profit,
    tp_stop_priority="tp" if tp_priority.startswith("tp") else "stop",
)
config = BacktestConfig(initial_capital=initial_capital, position_frac=position_frac)

result = run_backtest(universe, params, config, apply_screening=apply_screening)
metrics = compute_metrics(result)
trades = result["trades"]
equity = result["equity"]

# トレード0件なのにデータがある場合、原因を段階別に診断表示
if metrics["n_trades"] == 0 and universe:
    from src.strategy import diagnose_trades
    with st.expander("🔧 トレード0件の診断(銘柄ごとの段階別件数)", expanded=True):
        st.caption(
            "raw_columns=取得した生の列名 / normalized_rows=価格正規化後の行数 / "
            "screening_pass=銘柄フィルタ通過 / stage_*=各条件を満たした日数。"
        )
        for code, df in list(universe.items())[:6]:
            st.markdown(f"**{code}**")
            st.json(diagnose_trades(df, params))


# ----------------------------------------------------------------------- #
# 表示(スマホ向け: タブで縦スクロールを最小化)
# ----------------------------------------------------------------------- #
pf = metrics["profit_factor"]
pf_s = "∞" if pf == float("inf") else f"{pf:.2f}"

tab_sum, tab_chart, tab_trades = st.tabs(["📊 サマリー", "📈 資産推移", "📋 トレード"])

with tab_sum:
    # 2列グリッド(iPhone縦画面で見やすい)
    a1, a2 = st.columns(2)
    a1.metric("トレード件数", f"{metrics['n_trades']}")
    a2.metric("勝率", f"{metrics['win_rate']*100:.1f}%")
    b1, b2 = st.columns(2)
    b1.metric("損益合計", f"{metrics['total_pnl']:+,.0f} 円")
    b2.metric("プロフィットファクター", pf_s)
    c1, c2 = st.columns(2)
    c1.metric("最終資産", f"{metrics['final_equity']:,.0f} 円", f"{metrics['return_pct']*100:+.1f}%")
    c2.metric("最大DD", f"{metrics['max_drawdown_pct']*100:.1f}%",
              f"{metrics['max_drawdown']:,.0f} 円")
    d1, d2 = st.columns(2)
    d1.metric("期待値/トレード", f"{metrics['expectancy']:+,.0f} 円")
    d2.metric("日次シャープ(年率)", f"{metrics['sharpe_daily']:.2f}")

with tab_chart:
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
        fig.update_layout(height=320, margin=dict(l=6, r=6, t=24, b=6),
                          legend=dict(orientation="h"), font=dict(size=12))
        st.plotly_chart(fig, width='stretch', config={"displayModeBar": False})

        fig_dd = go.Figure()
        fig_dd.add_trace(go.Scatter(x=eq["Date"], y=eq["dd_pct"], fill="tozeroy",
                                    line=dict(color="#d62728"), name="ドローダウン"))
        fig_dd.update_layout(height=180, margin=dict(l=6, r=6, t=6, b=6),
                             yaxis_title="DD (%)", font=dict(size=12))
        st.plotly_chart(fig_dd, width='stretch', config={"displayModeBar": False})

with tab_trades:
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
        show["決済理由"] = show["決済理由"].map(
            {"close": "引け", "stop": "損切", "tp": "利確"}
        )
        show["乖離"] = (show["乖離"] * 100).round(2).astype(str) + "%"
        show["リターン(正味)"] = (show["リターン(正味)"] * 100).round(2).astype(str) + "%"
        # スマホは横スクロールが負担なので主要列だけ既定表示にできるトグル
        compact = st.checkbox("主要列のみ表示(スマホ向け)", value=True)
        if compact:
            cols = ["日付", "銘柄", "決済理由", "乖離", "損益(円)"]
        else:
            cols = ["日付", "銘柄", "エントリー", "エグジット", "決済理由", "乖離",
                    "リターン(正味)", "損益(円)", "約定後資産"]
        st.dataframe(
            show[cols].style.format({"損益(円)": "{:+,.0f}", "約定後資産": "{:,.0f}",
                                     "エントリー": "{:,.1f}", "エグジット": "{:,.1f}"}),
            width='stretch', height=420,
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
