"""J-Quants API クライアント(V2対応).

JPX 公式の J-Quants API からデータを取得する薄いラッパー。

⚠️ 2026年6月1日に V1 API は廃止され、V2 API に移行した。
   - 認証: メール/パスワードのトークン方式 → **APIキー方式**(x-api-key ヘッダー)
   - APIキーは J-Quants のダッシュボードで発行する
   - ベースURL: https://api.jquants.com/v2
   - 日足: /equities/bars/daily(旧 /prices/daily_quotes)
   - レスポンスのフィールド名が小文字(date, open, high, low, close, volume)に変更
参考: https://jpx-jquants.com/spec/migration-v1-v2

無料プランの主な制約(最新仕様は要確認):
  - 取得できる期間は直近約2年、データに配信ラグ(約12週間遅延)あり
  - 分足(ザラ場)は提供されない見込み → 日足ベースで検証する

APIキーは環境変数 / Secrets で管理し、リポジトリには含めない。
"""

from __future__ import annotations

import os
import time
from datetime import date, datetime
from typing import Optional

import pandas as pd
import requests

BASE_URL = "https://api.jquants.com/v2"

# V2 レスポンス(小文字)→ 本システム標準列(従来の PascalCase)への対応
_FIELD_MAP = {
    "date": "Date",
    "code": "Code",
    "open": "Open",
    "high": "High",
    "low": "Low",
    "close": "Close",
    "volume": "Volume",
}


class JQuantsError(RuntimeError):
    """J-Quants API 呼び出しに関する例外."""


class JQuantsBadRequest(JQuantsError):
    """400 Bad Request(パラメータ形式エラー等・リトライ不可)."""


class JQuantsClient:
    """J-Quants API V2 の最小クライアント.

    Examples
    --------
    >>> client = JQuantsClient.from_env()           # JQUANTS_API_KEY を読む
    >>> df = client.get_daily_quotes("7203", "2024-01-01", "2024-12-31")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        session: Optional[requests.Session] = None,
        max_retries: int = 4,
    ) -> None:
        self._api_key = api_key
        self._session = session or requests.Session()
        self._max_retries = max_retries

    # ------------------------------------------------------------------ #
    # 構築
    # ------------------------------------------------------------------ #
    @classmethod
    def from_env(cls) -> "JQuantsClient":
        """環境変数 / .env から APIキーを読み込んでクライアントを作る.

        JQUANTS_API_KEY が必須。.env を使う場合は呼び出し側で
        ``config.load_env()`` を実行しておくこと。
        """
        api_key = os.environ.get("JQUANTS_API_KEY")
        if not api_key:
            raise JQuantsError(
                "APIキーが見つかりません。J-Quants のダッシュボードで発行した "
                "APIキーを、環境変数 / .env / Secrets の JQUANTS_API_KEY に設定してください。"
                "(2026年6月にメール/パスワード方式は廃止され、APIキー方式に変わりました)"
            )
        return cls(api_key=api_key)

    # ------------------------------------------------------------------ #
    # 認証(V2はヘッダーにAPIキーを載せるだけ)
    # ------------------------------------------------------------------ #
    def _headers(self) -> dict:
        if not self._api_key:
            raise JQuantsError("APIキーが設定されていません。")
        return {"x-api-key": self._api_key}

    def authenticate(self, force: bool = False) -> None:
        """V2 はトークン取得が不要。互換のため残すが、キーの存在確認のみ行う."""
        self._headers()

    # ------------------------------------------------------------------ #
    # 低レベル HTTP
    # ------------------------------------------------------------------ #
    def _get(self, path: str, *, params=None) -> dict:
        url = f"{BASE_URL}{path}"
        last_exc: Optional[Exception] = None
        for attempt in range(self._max_retries):
            try:
                resp = self._session.get(
                    url, params=params, headers=self._headers(), timeout=30
                )
                if resp.status_code in (401, 403):
                    raise JQuantsError(
                        f"認証エラー({resp.status_code})。APIキーが正しいか、"
                        f"プランで該当データにアクセスできるか確認してください。"
                    )
                if resp.status_code == 400:
                    # パラメータ形式の問題。リトライせず即時に専用例外で返す
                    raise JQuantsBadRequest(
                        f"400 Bad Request: {resp.text[:200]}"
                    )
                if resp.status_code == 410:
                    raise JQuantsError(
                        "410 Gone: 旧V1エンドポイントは廃止されています。"
                        "クライアントがV2を指しているか確認してください。"
                    )
                if resp.status_code == 429:  # レート制限
                    self._sleep_backoff(attempt)
                    continue
                resp.raise_for_status()
                return resp.json()
            except JQuantsError:
                raise
            except requests.RequestException as exc:  # ネットワーク系は指数バックオフ
                last_exc = exc
                self._sleep_backoff(attempt)
        raise JQuantsError(f"GET {path} に失敗しました: {last_exc}")

    @staticmethod
    def _sleep_backoff(attempt: int) -> None:
        time.sleep(min(2 ** attempt, 16))

    # ------------------------------------------------------------------ #
    # 公開 API
    # ------------------------------------------------------------------ #
    def _fetch_all(self, path: str, params: dict) -> list[dict]:
        """pagination_key を辿って全件取得して data 配列を結合."""
        rows: list[dict] = []
        p = dict(params)
        while True:
            data = self._get(path, params=p)
            rows.extend(data.get("data", []))
            key = data.get("pagination_key")
            if not key:
                break
            p = {**p, "pagination_key": key}
        return rows

    def get_listed_info(self, code: Optional[str] = None) -> pd.DataFrame:
        """上場銘柄マスタ(V2: /equities/master)."""
        params = {"code": code} if code else None
        data = self._get("/equities/master", params=params)
        rows = data.get("data", data.get("info", []))
        return pd.DataFrame(rows)

    def get_daily_quotes(
        self,
        code: str,
        from_date: str | date,
        to_date: str | date,
    ) -> pd.DataFrame:
        """指定銘柄・期間の日足株価を取得(V2: /equities/bars/daily).

        Parameters
        ----------
        code : str
            銘柄コード(例 "7203")。
        from_date, to_date : str | date
            "YYYY-MM-DD" もしくは date。

        Returns
        -------
        pandas.DataFrame
            標準列(Date, Code, Open, High, Low, Close, Volume)に整えた日足。
            V2 の adjustment_factor 列があれば併せて保持する。
            pagination_key を辿って全件取得する。
        """
        # 日付形式はハイフン付き("2024-01-31")を第一候補、ハイフン無し
        # ("20240131")を予備にして、400が出たら自動で切り替える(両対応)。
        date_formats = ["%Y-%m-%d", "%Y%m%d"]
        last_err: Optional[JQuantsBadRequest] = None
        rows: list[dict] = []
        for fmt in date_formats:
            params = {
                "code": code,
                "from": _fmt_date(from_date, fmt),
                "to": _fmt_date(to_date, fmt),
            }
            try:
                rows = self._fetch_all("/equities/bars/daily", params)
                last_err = None
                break
            except JQuantsBadRequest as exc:
                last_err = exc  # 次の日付形式で再挑戦
                continue
        if last_err is not None:
            raise last_err

        df = pd.DataFrame(rows)
        if df.empty:
            return df

        # V2 の小文字フィールドを標準列名にリネーム(adjustment_factor 等は温存)
        df = df.rename(columns=_FIELD_MAP)
        if "Date" in df.columns:
            df["Date"] = pd.to_datetime(df["Date"])
            df = df.sort_values("Date").reset_index(drop=True)
        return df


def _fmt_date(value: str | date, fmt: str) -> str:
    """日付を指定 strftime 形式の文字列にする.

    入力が date/datetime ならそのまま整形。文字列なら一旦 8桁数字に正規化して
    から date に直し、目的の形式へ変換する(ハイフン有無の揺れを吸収)。
    """
    if isinstance(value, (date, datetime)):
        return value.strftime(fmt)
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if len(digits) >= 8:
        d = datetime.strptime(digits[:8], "%Y%m%d")
        return d.strftime(fmt)
    return str(value)
