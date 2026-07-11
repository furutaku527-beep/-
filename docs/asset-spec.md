# ピカピカスロット 素材仕様書（AI画像生成用）

このゲームのUIを有料ゲーム品質にするための素材リストです。
各パーツのプロンプトをAI画像生成ツール（ChatGPT / Midjourney 等）に貼って生成し、
できたPNGをチャットに添付してください。切り抜き・縮小・組み込みはすべて開発側で行います。

---

## 共通ルール（重要）

1. **1パーツ = 1画像。** 画面全体の完成イメージは作らない（切り貼りになって前回のように失敗します）
2. **背景は透過PNG。** 透過が出せないツールの場合は真っ黒や白ではなく **単色の緑（#00FF00）** 背景で生成（こちらで除去します）。背景画像（No.1）だけは透過不要
3. **文字・数字・ロゴを画像に入れない。** ボタンの「STOP」等の文字はゲーム側で描画します
4. **指定サイズの2倍程度で大きめに生成**（縮小はこちらでやります）
5. 実在パチスロ機（ジャグラー等）に似せる指示は入れない（商標・意匠の問題を避けるため）

## 共通スタイル指定文（全プロンプトの先頭にコピペ）

```
Glossy premium mobile slot-game UI asset, deep purple and gold carnival casino theme,
soft light from above, subtle bevel and glass highlights, clean polished finish,
single object only, centered, isolated on transparent background,
no text, no letters, no numbers, no logo
```

スタイルがブレてきたら、うまくできたパーツの画像を「この雰囲気に合わせて」と参照画像として渡すと揃います。

---

## パーツ一覧

### 【優先度：高】まずこの5つで見た目が大きく変わります

#### 1. メイン背景
- 用途: 画面全体の背景 ／ サイズ: 縦長 1080×1920 ／ 透過: 不要
```
Luxurious casino hall background for a vertical mobile game, deep purple velvet
and warm golden bokeh lights, dark vignette at edges, blurred and calm so UI
stays readable, no machines, no people, no text
```

#### 2. リール筐体ベゼル（リール窓を囲う金属フレーム）
- 用途: 3連リールの外枠 ／ サイズ: 横長 1000×700、**中央は空洞（透過）**
```
Ornate gold metallic rectangular bezel frame for a slot machine reel window,
wide horizontal orientation, rounded corners, rivets and engraved trim,
the center is completely empty and transparent, front view, symmetrical
```

#### 3. STOPボタン（丸ボタン）
- 用途: リール停止ボタン ／ サイズ: 512×512 ／ 1枚でOK（押下・無効状態はこちらでCSS加工）
```
Big round glossy red arcade push button, chrome ring base, strong specular
highlight, front view, blank surface with no markings
```

#### 4. BETボタン（角丸ボタン）
- 用途: MAX BET / 1BET ／ サイズ: 512×256 ／ 1枚でOK（色違い・状態はこちらで加工）
```
Rounded rectangle glossy golden arcade button, chrome trim, soft inner glow,
front view, blank surface with no markings
```

#### 5. 表示パネル枠（CREDIT / WIN 用）
- 用途: 数字表示部の外枠 ／ サイズ: 512×256、**中央は黒くくぼんだ空パネル**
```
Small rectangular display bezel for a slot machine counter, gold metallic frame
with a dark recessed empty screen inside, screws in corners, front view
```

### 【優先度：中】

#### 6. レバー
- 用途: スタートレバー ／ サイズ: 縦長 384×640
```
Slot machine start lever with a glossy red ball knob on a chrome stick and
metal base, side-front view, single lever only
```

#### 7. 上部看板の装飾枠（マーキー）
- 用途: GOGOランプ周りの飾り枠 ／ サイズ: 横長 1024×400、**中央は空洞（透過）**
```
Decorative golden marquee frame for the top of a slot machine, carnival light
bulbs along the border, wide horizontal orientation, the center is completely
empty and transparent
```

#### 8. 汎用パネル枠（9-slice用）
- 用途: データカウンター等の枠 ／ サイズ: 512×512、**中央は空洞（透過）**、四隅と辺の装飾が均等
```
Square ornamental gold frame with even border thickness on all four sides,
corner decorations identical, the center is completely empty and transparent,
flat front view
```

#### 9. 丸ランプ（点灯・消灯の2枚）
- 用途: 状態ランプ ／ サイズ: 各128×128
```
（点灯）Small round amber indicator lamp, glowing bright, chrome rim, front view
（消灯）Small round indicator lamp turned off, dark amber glass, chrome rim, front view
```

### 【優先度：低】（コード側の演出でも代用可能）

#### 10. メダル（コイン）1枚
- サイズ: 256×256
```
Golden slot machine coin with a star emblem, slight 3D tilt, shiny
```

#### 11. キラキラ（スパークル）1枚
- サイズ: 256×256
```
Single four-pointed golden sparkle star with soft glow
```

---

## 生成のコツ

- 1回で完璧を狙わず、**同じパーツを3〜4枚生成して一番良いものを選ぶ**
- 「中央が空洞」のパーツ（2・7・8）はAIが苦手なことがあります。中央が埋まってしまっても、**中身がシンプルなら開発側でくり抜けるので、そのまま添付してOK**
- 全部そろわなくても大丈夫です。**届いた分から順次組み込みます**

## 納品方法

できたPNGをこのチャットにそのまま添付してください。
複数まとめてでも、1枚ずつでも構いません。
