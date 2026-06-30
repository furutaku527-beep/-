"""ダッシュボード用のデータソース取得ヘルパー.

Streamlit Community Cloud では data/raw の保存データが存在しないため、
J-Quants から直接取得する経路を用意する。認証情報は以下の優先順で解決:

  1. Streamlit Secrets (st.secrets) — クラウドデプロイ時に設定
  2. 環境変数 / .env (JQUANTS_MAILADDRESS, JQUANTS_PASSWORD)

取得結果は st.cache_data でキャッシュし、再実行時の API 呼び出しを抑える。
"""

from __future__ import annotations

import os

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


@st.cache_data(show_spinner="J-Quants からデータ取得中...", ttl=3600)
def fetch_live(codes: tuple[str, ...], from_date: str, to_date: str) -> dict:
    """J-Quants から日足を取得して {code: DataFrame} を返す(キャッシュ付き).

    認証は resolve_credentials() で事前に通しておくこと。
    """
    client = JQuantsClient.from_env()
    universe: dict[str, pd.DataFrame] = {}
    errors: list[str] = []
    for c in codes:
        try:
            df = client.get_daily_quotes(c, from_date, to_date)
            if not df.empty:
                universe[c] = df
            else:
                errors.append(f"{c}: 0件")
        except Exception as exc:  # noqa: BLE001 - UIに表示するため握る
            errors.append(f"{c}: {exc}")
    if errors:
        # キャッシュ対象の戻り値に混ぜず、セッションに残す
        st.session_state["_fetch_errors"] = errors
    else:
        st.session_state.pop("_fetch_errors", None)
    return universe
