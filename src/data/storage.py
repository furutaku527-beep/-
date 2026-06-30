"""取得した株価データのローカル保存 / 読み込み.

1銘柄 = 1 parquet ファイル(data/raw/{code}.parquet)で管理する。
再取得時は期間をマージして重複日を排除する。
"""

from __future__ import annotations

import pandas as pd

from .config import RAW_DIR, ensure_dirs


def _path(code: str):
    return RAW_DIR / f"{code}.parquet"


def save_daily(code: str, df: pd.DataFrame) -> None:
    """日足データを保存(既存があれば日付でマージ・重複排除)."""
    ensure_dirs()
    path = _path(code)
    if path.exists():
        existing = pd.read_parquet(path)
        df = (
            pd.concat([existing, df], ignore_index=True)
            .drop_duplicates(subset=["Date"], keep="last")
            .sort_values("Date")
            .reset_index(drop=True)
        )
    df.to_parquet(path, index=False)


def load_daily(code: str) -> pd.DataFrame:
    """保存済み日足データを読み込む。無ければ空 DataFrame."""
    path = _path(code)
    if not path.exists():
        return pd.DataFrame()
    return pd.read_parquet(path)


def list_saved_codes() -> list[str]:
    if not RAW_DIR.exists():
        return []
    return sorted(p.stem for p in RAW_DIR.glob("*.parquet"))
