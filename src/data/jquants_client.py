"""J-Quants API クライアント.

JPX 公式の J-Quants API から株価データを取得する薄いラッパー。
無料(Free)プラン前提。認証フローは次の3段:

    メール+パスワード ──> refreshToken ──> idToken ──> 各APIを Bearer 認証で叩く

参考: https://jpx.gitbook.io/j-quants-ja/

無料プランの主な制約(2024時点の公開情報ベース。実際は最新仕様を要確認):
  - 取得できる期間は直近約2年
  - データには配信ラグ(約12週間遅延)がある
  - 分足(ザラ場)データは提供されない見込み → 日足ベースで検証する

APIキー(認証情報)は環境変数で管理し、リポジトリには含めない。
"""

from __future__ import annotations

import os
import time
from datetime import date, datetime
from typing import Optional

import pandas as pd
import requests

BASE_URL = "https://api.jquants.com/v1"


class JQuantsError(RuntimeError):
    """J-Quants API 呼び出しに関する例外."""


class JQuantsClient:
    """J-Quants API の最小クライアント.

    Examples
    --------
    >>> client = JQuantsClient.from_env()
    >>> df = client.get_daily_quotes("7203", "2023-01-01", "2023-12-31")
    """

    def __init__(
        self,
        mailaddress: Optional[str] = None,
        password: Optional[str] = None,
        refresh_token: Optional[str] = None,
        *,
        session: Optional[requests.Session] = None,
        max_retries: int = 4,
    ) -> None:
        self._mailaddress = mailaddress
        self._password = password
        self._refresh_token = refresh_token
        self._id_token: Optional[str] = None
        self._session = session or requests.Session()
        self._max_retries = max_retries

    # ------------------------------------------------------------------ #
    # 構築
    # ------------------------------------------------------------------ #
    @classmethod
    def from_env(cls) -> "JQuantsClient":
        """環境変数から認証情報を読み込んでクライアントを作る.

        .env を使う場合は呼び出し側で ``python-dotenv`` の ``load_dotenv()`` を
        実行しておくこと(``config.load_env`` を参照)。
        """
        mail = os.environ.get("JQUANTS_MAILADDRESS")
        pwd = os.environ.get("JQUANTS_PASSWORD")
        refresh = os.environ.get("JQUANTS_REFRESH_TOKEN")
        if not refresh and not (mail and pwd):
            raise JQuantsError(
                "認証情報が見つかりません。JQUANTS_MAILADDRESS と JQUANTS_PASSWORD、"
                "または JQUANTS_REFRESH_TOKEN を環境変数 / .env に設定してください。"
            )
        return cls(mailaddress=mail, password=pwd, refresh_token=refresh)

    # ------------------------------------------------------------------ #
    # 認証
    # ------------------------------------------------------------------ #
    def _fetch_refresh_token(self) -> str:
        resp = self._post(
            "/token/auth_user",
            json={"mailaddress": self._mailaddress, "password": self._password},
            auth=False,
        )
        token = resp.get("refreshToken")
        if not token:
            raise JQuantsError(f"refreshToken の取得に失敗しました: {resp}")
        return token

    def _fetch_id_token(self, refresh_token: str) -> str:
        # auth_refresh は refreshtoken をクエリパラメータで渡す
        resp = self._post(
            "/token/auth_refresh",
            params={"refreshtoken": refresh_token},
            auth=False,
        )
        token = resp.get("idToken")
        if not token:
            raise JQuantsError(f"idToken の取得に失敗しました: {resp}")
        return token

    def authenticate(self, force: bool = False) -> None:
        """idToken を用意する。既に保持していれば何もしない."""
        if self._id_token and not force:
            return
        if not self._refresh_token:
            self._refresh_token = self._fetch_refresh_token()
        self._id_token = self._fetch_id_token(self._refresh_token)

    # ------------------------------------------------------------------ #
    # 低レベル HTTP
    # ------------------------------------------------------------------ #
    def _headers(self, auth: bool) -> dict:
        if not auth:
            return {}
        if not self._id_token:
            self.authenticate()
        return {"Authorization": f"Bearer {self._id_token}"}

    def _post(self, path: str, *, json=None, params=None, auth: bool = True) -> dict:
        return self._request("POST", path, json=json, params=params, auth=auth)

    def _get(self, path: str, *, params=None, auth: bool = True) -> dict:
        return self._request("GET", path, params=params, auth=auth)

    def _request(self, method: str, path: str, *, json=None, params=None, auth=True) -> dict:
        url = f"{BASE_URL}{path}"
        last_exc: Optional[Exception] = None
        for attempt in range(self._max_retries):
            try:
                resp = self._session.request(
                    method, url, json=json, params=params,
                    headers=self._headers(auth), timeout=30,
                )
                # idToken 失効 → 1度だけ再認証して即リトライ
                if resp.status_code == 401 and auth and attempt == 0:
                    self.authenticate(force=True)
                    continue
                if resp.status_code == 429:  # レート制限
                    self._sleep_backoff(attempt)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException as exc:  # ネットワーク系は指数バックオフ
                last_exc = exc
                self._sleep_backoff(attempt)
        raise JQuantsError(f"{method} {path} に失敗しました: {last_exc}")

    @staticmethod
    def _sleep_backoff(attempt: int) -> None:
        time.sleep(min(2 ** attempt, 16))

    # ------------------------------------------------------------------ #
    # 公開 API
    # ------------------------------------------------------------------ #
    def get_listed_info(self, code: Optional[str] = None) -> pd.DataFrame:
        """上場銘柄一覧(銘柄スクリーニングの母集団に使う)."""
        params = {"code": code} if code else None
        data = self._get("/listed/info", params=params)
        return pd.DataFrame(data.get("info", []))

    def get_daily_quotes(
        self,
        code: str,
        from_date: str | date,
        to_date: str | date,
    ) -> pd.DataFrame:
        """指定銘柄・期間の日足株価を取得.

        Parameters
        ----------
        code : str
            銘柄コード(例 "7203" または "72030")。
        from_date, to_date : str | date
            "YYYY-MM-DD" もしくは date。

        Returns
        -------
        pandas.DataFrame
            J-Quants の daily_quotes をそのまま DataFrame 化したもの。
            主な列: Date, Code, Open, High, Low, Close, Volume,
                    AdjustmentOpen/High/Low/Close/Volume(分割調整済み)。
            ページングは pagination_key を辿って自動で全件取得する。
        """
        params = {
            "code": code,
            "from": _to_iso(from_date),
            "to": _to_iso(to_date),
        }
        rows: list[dict] = []
        while True:
            data = self._get("/prices/daily_quotes", params=params)
            rows.extend(data.get("daily_quotes", []))
            key = data.get("pagination_key")
            if not key:
                break
            params = {**params, "pagination_key": key}

        df = pd.DataFrame(rows)
        if not df.empty:
            df["Date"] = pd.to_datetime(df["Date"])
            df = df.sort_values("Date").reset_index(drop=True)
        return df


def _to_iso(value: str | date) -> str:
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    return str(value)
