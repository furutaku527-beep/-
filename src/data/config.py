"""環境変数 / .env の読み込みと共通パス定義."""

from __future__ import annotations

from pathlib import Path

# プロジェクトルート(このファイルは src/data/ にある)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"          # API から取得した生データ
PROCESSED_DIR = DATA_DIR / "processed"


def load_env() -> None:
    """プロジェクトルートの .env を環境変数に読み込む(あれば).

    python-dotenv が無くてもクラッシュしないようにしておく。
    """
    env_path = PROJECT_ROOT / ".env"
    try:
        from dotenv import load_dotenv

        load_dotenv(env_path)
    except ImportError:
        # dotenv 未インストール時は OS の環境変数だけで動かす
        pass


def ensure_dirs() -> None:
    for d in (DATA_DIR, RAW_DIR, PROCESSED_DIR):
        d.mkdir(parents=True, exist_ok=True)
