#!/usr/bin/env python
"""J-Quants から日足データを取得してローカル保存する CLI.

使い方:
    # .env に JQUANTS_API_KEY(V2のAPIキー)を設定してから
    python scripts/fetch_data.py --codes 7203 6758 9984 --from 2023-01-01 --to 2024-12-31

    # 接続テストだけ(1銘柄を少しだけ取得して表示)
    python scripts/fetch_data.py --check
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

# src を import パスに追加
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data import JQuantsClient, JQuantsError, save_daily  # noqa: E402
from src.data.config import load_env  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="J-Quants 日足データ取得")
    parser.add_argument("--codes", nargs="+", default=[], help="銘柄コード(複数可)")
    parser.add_argument("--from", dest="from_date", default=None, help="取得開始日 YYYY-MM-DD")
    parser.add_argument("--to", dest="to_date", default=None, help="取得終了日 YYYY-MM-DD")
    parser.add_argument("--check", action="store_true", help="接続テスト(7203を直近30日)")
    args = parser.parse_args()

    load_env()

    try:
        client = JQuantsClient.from_env()
    except JQuantsError as exc:
        print(f"[認証情報エラー] {exc}", file=sys.stderr)
        return 2

    if args.check:
        return _connection_check(client)

    if not args.codes or not args.from_date or not args.to_date:
        parser.error("--codes / --from / --to を指定してください(または --check)")

    rc = 0
    for code in args.codes:
        try:
            df = client.get_daily_quotes(code, args.from_date, args.to_date)
            if df.empty:
                print(f"  {code}: データ0件(期間や権限を確認してください)")
                continue
            save_daily(code, df)
            print(f"  {code}: {len(df)} 件保存 ({df['Date'].min().date()} 〜 {df['Date'].max().date()})")
        except JQuantsError as exc:
            print(f"  {code}: 取得失敗 - {exc}", file=sys.stderr)
            rc = 1
    return rc


def _connection_check(client: JQuantsClient) -> int:
    print("J-Quants 接続テスト中...")
    try:
        client.authenticate()
        print("  APIキー設定 OK")
        to = date.today()
        frm = to - timedelta(days=90)
        df = client.get_daily_quotes("7203", frm, to)
        print(f"  7203(トヨタ)直近30日: {len(df)} 件取得")
        if not df.empty:
            cols = [c for c in ["Date", "Open", "High", "Low", "Close", "Volume"] if c in df.columns]
            print(df[cols].tail(5).to_string(index=False))
        print(
            "\n  ※ 無料プランは約12週間のデータ遅延があるため、直近営業日が"
            "数か月前になることがあります(正常)。"
        )
        return 0
    except JQuantsError as exc:
        print(f"  接続テスト失敗: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
