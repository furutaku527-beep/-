"""戦略パラメータの一元管理.

strategy.md セクション4の既定値に対応。ダッシュボードや CLI から
上書きできるよう dataclass にしている。
"""

from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass
class StrategyParams:
    # --- 移動平均 ---
    ma_fast: int = 5          # 5日線
    ma_slow: int = 25         # 25日線

    # --- エントリー条件 ---
    # 乖離は「リスク指標 / 期待値ブースター」であり必須ゲートではない(手法の忠実化)。
    # 既定0.0 = 上昇中の5日線の上で押し目タッチすれば乖離量に関わらずエントリー。
    # 値を上げると「乖離が大きい押し目(激アツ)」だけに絞り込める。
    dev_min: float = 0.0      # エントリーに必要な最小乖離(前日終値 vs 5日線)
    # 乖離の上限。>0 で有効。乖離しすぎ(落ちるナイフ)を除外する。
    # 実データで乖離>約5.6%は平均リターンがマイナスに転じたため上限が有効。
    dev_max: float = 0.0
    open_buf: float = 0.01    # 寄り付き許容バッファ
    require_open_above: bool = True   # 寄り付きが線付近以上であることを要求

    # --- 決済(利確/損切り)の単位 ---
    # "pct" = 率(entry比%)/ "yen" = 円(1株あたりの値幅)。
    # 本手法は「数百円の利確を積み重ねる」スキャルなので "yen" が本来忠実。
    # ただし円建ては株価帯を絞った銘柄(min/max価格)でのみ意味を持つ。
    exit_mode: str = "pct"

    # 率(pct)モード
    stop_pct: float = 0.03           # 損切り幅(entry比)。低位株はノイズ大なので広め
    take_profit_pct: float = 0.0     # 利確幅(entry比)。0で引けまで保有

    # 円(yen)モード: 1株あたりの値幅
    stop_yen: float = 0.0            # 損切り(entryから何円下)
    take_profit_yen: float = 0.0     # 利確(entryから何円上)。0で引けまで保有

    # 同日にTPと損切りの両方に到達した場合の優先(日足では順序不明のため)。
    # "stop"=保守的に損切り優先 / "tp"=利確優先(楽観)。
    tp_stop_priority: str = "stop"

    # --- スクリーニング ---
    min_history_days: int = 60    # IPO除外(最低営業日数)
    min_turnover: float = 5e7     # 最小平均売買代金(円, 20日)
    exclude_prime: bool = False   # プライム市場を除外するか

    # --- コスト(概算) ---
    fee_rate: float = 0.0005      # 片道手数料率
    slippage_pct: float = 0.001   # 片道スリッページ率

    # --- 実験的 ---
    enable_oversold_rebound: bool = False  # 急落乖離リバウンド(既定OFF)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "StrategyParams":
        fields = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in d.items() if k in fields})
