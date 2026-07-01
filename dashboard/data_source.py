"""ダッシュボード用のデータソース取得ヘルパー.

Streamlit Community Cloud では data/raw の保存データが存在しないため、
J-Quants から直接取得する経路を用意する。認証情報は以下の優先順で解決:

  1. Streamlit Secrets (st.secrets) — クラウドデプロイ時に設定
  2. 環境変数 / .env (JQUANTS_MAILADDRESS, JQUANTS_PASSWORD)

取得結果は st.cache_data でキャッシュし、再実行時の API 呼び出しを抑える。
"""

from __future__ import annotations

import os
import time

import pandas as pd
import streamlit as st

from src.data import JQuantsClient
from src.data.config import load_env


def resolve_credentials() -> bool:
    """APIキーを os.environ に用意できれば True.

    Streamlit Secrets があれば環境変数へ橋渡しする。なければ .env/環境変数を読む。
    V2 API は単一の APIキー(JQUANTS_API_KEY)で認証する。
    """
    # 1) Streamlit Secrets(無い環境では参照時に例外が出るため try)
    try:
        secrets = st.secrets
        if "JQUANTS_API_KEY" in secrets and secrets["JQUANTS_API_KEY"]:
            os.environ["JQUANTS_API_KEY"] = str(secrets["JQUANTS_API_KEY"])
    except Exception:
        pass

    # 2) .env / 環境変数
    load_env()

    return bool(os.environ.get("JQUANTS_API_KEY"))


@st.cache_data(show_spinner=False, ttl=3600)
def _nonprime_codes_cached(exclude_prime: bool, fallback_date: str):
    """非プライム銘柄コード一覧(+診断)をキャッシュ付きで取得."""
    from src.data.screener import select_nonprime_codes

    client = JQuantsClient.from_env()
    diag: dict = {}
    try:
        codes = select_nonprime_codes(
            client, exclude_prime=exclude_prime, fallback_date=fallback_date, diag=diag,
        )
    except Exception as exc:  # noqa: BLE001 - 画面に原因を出すため握る
        diag["master_error"] = str(exc)[:300]
        codes = []
    return codes, diag


@st.cache_data(show_spinner=False, ttl=3600)
def _fetch_one_cached(code: str, from_date: str, to_date: str) -> pd.DataFrame:
    """1銘柄の日足をキャッシュ付きで取得(再実行時は即返る).

    無料プランはレート制限が厳しいため、実ネットワーク取得時(=キャッシュミス時)
    のみ短いウェイトを入れて連続アクセスを緩和する。
    """
    time.sleep(0.8)  # レート制限対策(キャッシュヒット時は実行されない)
    return JQuantsClient.from_env().get_daily_quotes(code, from_date, to_date)


def screen_and_fetch(
    max_price: float,
    min_turnover: float,
    min_range_pct: float,
    top_n: int,
    scan_limit: int,
    exclude_prime: bool,
    from_date: str,
    to_date: str,
    progress_cb=None,
) -> dict:
    """無料プラン対応のスクリーニング(進捗コールバック対応).

    上場マスタ(無料可)から非プライム銘柄を作り、個別に日足を取得しながら
    低位・流動性・ボラで選別する。scan_limit 件まで走査し top_n 件集める。
    progress_cb(scanned, total, selected, code) が渡されれば都度呼ぶ。
    """
    from src.data.screener import qualifies_low_priced

    codes, diag = _nonprime_codes_cached(exclude_prime, to_date)
    if not codes:
        st.session_state["_screen_diag"] = diag
        st.session_state["_screen_table"] = pd.DataFrame()
        return {}

    total = min(scan_limit, len(codes))
    universe: dict[str, pd.DataFrame] = {}
    errors: list[str] = []
    scanned = 0
    for c in codes:
        if scanned >= scan_limit or len(universe) >= top_n:
            break
        scanned += 1
        if progress_cb is not None:
            progress_cb(scanned, total, len(universe), c)
        try:
            df = _fetch_one_cached(c, from_date, to_date)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{c}: {exc}")
            continue
        if qualifies_low_priced(df, max_price=max_price, min_turnover=min_turnover,
                                min_range_pct=min_range_pct):
            universe[c] = df

    diag["scanned"] = scanned
    diag["selected"] = len(universe)
    st.session_state["_screen_diag"] = diag
    st.session_state["_screen_table"] = (
        pd.DataFrame({"Code": list(universe.keys())}) if universe else pd.DataFrame()
    )
    if errors:
        st.session_state["_fetch_errors"] = errors[:8]
    else:
        st.session_state.pop("_fetch_errors", None)
    return universe


def fetch_live(
    codes: tuple[str, ...], from_date: str, to_date: str, progress_cb=None,
) -> dict:
    """指定銘柄の日足を取得して {code: DataFrame} を返す(進捗コールバック対応).

    個別取得はキャッシュ(_fetch_one_cached)されるので再実行は高速。
    progress_cb(done, total, ok, code) が渡されれば都度呼ぶ。
    """
    universe: dict[str, pd.DataFrame] = {}
    errors: list[str] = []
    total = len(codes)
    for i, c in enumerate(codes, start=1):
        if progress_cb is not None:
            progress_cb(i, total, len(universe), c)
        try:
            df = _fetch_one_cached(c, from_date, to_date)
            if not df.empty:
                universe[c] = df
            else:
                errors.append(f"{c}: 0件")
        except Exception as exc:  # noqa: BLE001 - UIに表示するため握る
            errors.append(f"{c}: {exc}")
    if errors:
        st.session_state["_fetch_errors"] = errors
    else:
        st.session_state.pop("_fetch_errors", None)
    return universe
