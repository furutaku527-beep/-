import { MACHINES } from '../logic/machines'

interface Props {
  onClose: () => void
}

/**
 * アプリ内ヘルプ（使い方・仕組み）。
 * READMEの要点をエンドユーザー向けにまとめたもの。設定シートから開く。
 */
export function HelpSheet({ onClose }: Props) {
  return (
    <div
      className="sheetOverlay helpOverlay"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="sheet helpSheet"
        role="dialog"
        aria-modal="true"
        aria-label="使い方・仕組み"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheetHandle" aria-hidden="true" />
        <h2 className="sheetTitle">使い方・仕組み</h2>

        <div className="helpDoc">
          <p className="helpLead">
            パチスロ用の小役カウンターです。小役を数えて確率を出し、ハナハナシリーズの
            設定推測ができます。データは自動保存され、オフラインでも動きます。
          </p>

          <section className="helpSection">
            <h3 className="helpH3">🔘 カウンタータブ</h3>
            <ul className="helpList">
              <li>
                <b>4色ボタンをタップで +1</b>。役の出現数を数えます。押すと光って「カチッ」と鳴ります。
              </li>
              <li>
                <b>役名の変更</b>: カード左上の名前をタップ（初期値はベル/スイカ/チェリー/その他）。
              </li>
              <li>
                <b>−1 / リセット</b>: 各カードの専用ボタン。リセットは誤操作防止で2回タップ確定です。
              </li>
              <li>
                <b>総回転数</b>: ±1/10/100/1000ボタン、または数字をタップして直接入力。
              </li>
              <li>
                <b>確率は常時表示</b>: 各役に「総回転数 ÷ カウント数」を 1/x.x 形式で自動表示します。
              </li>
              <li>
                <b>合算確率</b>: 下部で役を2つ以上選ぶと合算した確率が出ます。
              </li>
              <li>
                <b>シーンA/B/C</b>: 通常時・ボーナス中などを別々に数えたいとき切り替えます。
              </li>
            </ul>
          </section>

          <section className="helpSection">
            <h3 className="helpH3">🌺 設定推測タブ</h3>
            <ul className="helpList">
              <li>
                <b>まず機種を選択</b>: プルダウンで機種を選ぶと、その機種の確率・示唆の仕様に切り替わります。
              </li>
              <li>
                <b>BIG / REG / BIG中スイカ</b>をタップで記録。BIG中スイカの確率はBIG回数×24G換算で出します。
              </li>
              <li>
                <b>ベル</b>はカウンタータブの「ベル」カウンターと自動連動します。
              </li>
              <li>
                <b>示唆ランプ</b>: 機種ごとの示唆（サイドランプ・フェザーランプ・パネルフラッシュ等）を
                色・種類別に記録します。ボタン下の説明に各色の意味が書いてあります。
              </li>
              <li>
                記録すると下部に<b>設定1〜6の期待度</b>がバーで表示されます。
              </li>
            </ul>
          </section>

          <section className="helpSection">
            <h3 className="helpH3">🧮 推測の仕組み</h3>
            <p className="helpP">
              入力された小役・ボーナスの出現数と示唆から、<b>ベイズ推定</b>で「今の挙動が各設定だった場合の
              尤（もっと）もらしさ」を計算し、設定1〜6の期待度（％）に変換しています。
            </p>
            <ul className="helpList">
              <li>
                <b>確率系（BIG/REG/ベル/BIG中スイカ）</b>: 各設定の理論確率に対して、実際の出現数が
                どれだけ起こりやすいかを二項分布で評価します。回せば回すほど精度が上がります。
              </li>
              <li>
                <b>確定演出の示唆</b>（例: REG後ランプ緑=設定4以上）: 条件を満たさない設定を
                <b>除外</b>します（バーが「除外」になります）。
              </li>
              <li>
                <b>示唆の傾向</b>（例: サイドランプの色で奇数/偶数寄り）: 該当設定の期待度を
                <b>上げ下げ</b>します。
              </li>
            </ul>
            <p className="helpNote">
              ⚠️ ボーナス確率は各機種の公表値、ベル・BIG中スイカ・ランプの振り分けは解析サイトの
              実戦値をもとにした<b>目安</b>です。推測結果は参考値であり、設定を保証するものではありません。
            </p>
          </section>

          <section className="helpSection">
            <h3 className="helpH3">🎰 対応機種</h3>
            <ul className="helpList">
              {MACHINES.map((m) => (
                <li key={m.id}>{m.name}</li>
              ))}
            </ul>
            <p className="helpNote">
              機種を増やす・数値を直すのは1ファイル（machines.ts）で対応できます。追加希望や
              修正があれば製作者にお伝えください。
            </p>
          </section>

          <section className="helpSection">
            <h3 className="helpH3">💾 データ・その他</h3>
            <ul className="helpList">
              <li>カウント・示唆・機種選択は端末内に自動保存され、閉じても続きから使えます。</li>
              <li>設定からデータのリセット（シーン単位／全体）ができます。</li>
              <li>ホーム画面に追加すると全画面でオフライン起動できます（PWA）。</li>
            </ul>
          </section>

          <p className="helpDisclaimer">
            本アプリはオリジナルのカウンターツールであり、実在の製品・メーカーとは一切関係ありません。
          </p>
        </div>

        <button type="button" className="closeBtn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
