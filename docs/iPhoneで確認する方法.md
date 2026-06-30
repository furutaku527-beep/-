# iPhone で結果を確認する方法

ダッシュボード(Streamlit アプリ)は **Python の実行環境の中**で動くため、
iPhone のブラウザから直接開くには「どこかで動かして URL を公開する」必要があります。
用途に応じて3つの方法があります。

---

## 方法A. 静的HTMLレポートを見る(いちばん手軽・今すぐ)

サーバを立てずに、結果を1枚のHTMLにして見る方法です。Claude Code 上では
このファイルをそのまま表示できます。

```bash
python scripts/run_backtest.py --demo        # 合成データで確認
# 実データがあれば:
python scripts/run_backtest.py --codes 7203 6758 9984
```

→ `output/report.html` が生成されます。スマホ縦画面向けレイアウトで、
指標カード・資産推移・ドローダウン・トレード一覧が入っています。

**メリット**: 起動が速い。オフラインに近い手軽さ。
**デメリット**: 操作(銘柄/期間/パラメータ切替)はできない静的表示。

---

## 方法B. Streamlit Community Cloud にデプロイ(iPhoneで操作したい人向け・推奨)

GitHub リポジトリから無料でホスティングでき、**iPhone のブラウザで URL を開くだけ**で
銘柄・期間・パラメータを切り替えながら操作できます。外出先からも使えます。

### 手順
1. PC または iPhone のブラウザで <https://share.streamlit.io> を開く
2. GitHub アカウントでサインイン(このリポジトリにアクセスできるアカウント)
3. **「New app」** または **「Create app」** をクリック
4. 次を指定:
   - Repository: `furutaku527-beep/-`
   - Branch: `claude/jp-daytrading-backtest-kswajk`(本番運用時は `main`)
   - Main file path: `dashboard/app.py`
5. **「Advanced settings」→「Secrets」** に J-Quants 認証情報を貼り付け(任意・実データ用):
   ```toml
   JQUANTS_MAILADDRESS = "your-email@example.com"
   JQUANTS_PASSWORD = "your-password"
   ```
   ※ Secrets はリポジトリには保存されず Streamlit 側で安全に管理されます。
6. **「Deploy」** を押すと数分でビルドされ、`https://....streamlit.app` の URL が発行されます
7. その URL を iPhone のホーム画面に追加すればアプリのように使えます

> 注意: 認証情報未設定でも「デモデータ」トグルで動作確認できます。
> 実データを使うには方法B(Secrets設定)か、ローカルでのデータ取得が必要です。

---

## 方法C. ローカルPCで起動して同一Wi-FiのiPhoneから見る

自宅PCで動かし、同じWi-Fiにつないだ iPhone から見る方法です。

```bash
streamlit run dashboard/app.py --server.address 0.0.0.0
```

起動時に表示される **Network URL**(例 `http://192.168.x.x:8501`)を
iPhone のブラウザで開きます。外出先から使うには別途トンネル
(ngrok / Cloudflare Tunnel など)が必要です。

---

## どれを選ぶ?

| 目的 | おすすめ |
|---|---|
| とにかく今すぐ結果を見たい | **方法A**(HTMLレポート) |
| iPhoneで操作・外出先でも使いたい | **方法B**(Streamlit Cloud) |
| 自宅PCがあり同一Wi-Fiで見たい | 方法C |
