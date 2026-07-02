import type { Symbol } from '../game/types'

/**
 * リール図柄のSVGスプライト定義。App直下に一度だけマウントし、
 * 各図柄は <use> で参照する（グラデーションID重複を避けるため）。
 * すべて手描きのオリジナルデザイン。
 */
export function SymbolDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="g-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3ae" />
          <stop offset="0.45" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#e07b00" />
        </linearGradient>
        <linearGradient id="g-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ecbff" />
          <stop offset="0.5" stopColor="#2979d8" />
          <stop offset="1" stopColor="#0d47a1" />
        </linearGradient>
        <radialGradient id="g-grape" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#e3b3ff" />
          <stop offset="0.5" stopColor="#a04fe0" />
          <stop offset="1" stopColor="#5c1a9e" />
        </radialGradient>
        <radialGradient id="g-cherry" cx="0.35" cy="0.3" r="0.95">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="0.55" stopColor="#e53946" />
          <stop offset="1" stopColor="#8e0e1f" />
        </radialGradient>
        <linearGradient id="g-bell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0b3" />
          <stop offset="0.55" stopColor="#f5b800" />
          <stop offset="1" stopColor="#c07800" />
        </linearGradient>
        <linearGradient id="g-replay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#80ffea" />
          <stop offset="1" stopColor="#00acc1" />
        </linearGradient>
        <linearGradient id="g-hat-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a7a" />
          <stop offset="1" stopColor="#c62828" />
        </linearGradient>
        <linearGradient id="g-hat-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ab8ff" />
          <stop offset="1" stopColor="#1e5bb8" />
        </linearGradient>
        <linearGradient id="g-hat-yellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe98a" />
          <stop offset="1" stopColor="#f0a000" />
        </linearGradient>

        {/* ボーナス図柄：光沢のある星 */}
        <symbol id="sym-STAR" viewBox="0 0 64 64">
          <polygon
            points="32,4 38.8,22.7 58.6,23.3 42.9,35.6 48.5,54.7 32,43.5 15.5,54.7 21.1,35.6 5.4,23.3 25.2,22.7"
            fill="url(#g-star)"
            stroke="#9a4a00"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="26" cy="18" rx="7" ry="4" fill="#fff" opacity="0.65" transform="rotate(-20 26 18)" />
        </symbol>

        {/* REG用図柄：メタリックBARブロック */}
        <symbol id="sym-BAR" viewBox="0 0 64 64">
          <rect x="7" y="17" width="50" height="30" rx="7" fill="url(#g-bar)" stroke="#092c5c" strokeWidth="2.5" />
          <rect x="10.5" y="20" width="43" height="9" rx="4.5" fill="#fff" opacity="0.3" />
          <text
            x="32"
            y="41.5"
            textAnchor="middle"
            fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="18"
            fill="#fff"
            stroke="#092c5c"
            strokeWidth="0.6"
          >
            BAR
          </text>
        </symbol>

        {/* ぶどう */}
        <symbol id="sym-GRAPE" viewBox="0 0 64 64">
          <path d="M33,8 C31,14 31,18 32,23" stroke="#5d4023" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="41" cy="13" rx="9" ry="4.5" fill="#4caf50" stroke="#2e7031" strokeWidth="1.5" transform="rotate(-18 41 13)" />
          {[
            [24, 27], [40, 27],
            [16, 37], [32, 37], [48, 37],
            [24, 47], [40, 47],
            [32, 56],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill="url(#g-grape)" stroke="#42106e" strokeWidth="1.4" />
          ))}
          <circle cx="21.5" cy="24.5" r="2.4" fill="#fff" opacity="0.7" />
          <circle cx="29.5" cy="34.5" r="2.2" fill="#fff" opacity="0.55" />
        </symbol>

        {/* チェリー */}
        <symbol id="sym-CHERRY" viewBox="0 0 64 64">
          <path d="M22,42 C24,28 32,17 45,11" stroke="#4e7a1e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M43,44 C43,30 44,19 45,11" stroke="#4e7a1e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="11" rx="8" ry="4" fill="#66bb3a" stroke="#3d7a1a" strokeWidth="1.5" transform="rotate(-14 50 11)" />
          <circle cx="21" cy="46" r="11" fill="url(#g-cherry)" stroke="#6e0715" strokeWidth="1.8" />
          <circle cx="43" cy="48" r="11" fill="url(#g-cherry)" stroke="#6e0715" strokeWidth="1.8" />
          <ellipse cx="17.5" cy="42" rx="3.4" ry="2.2" fill="#fff" opacity="0.75" transform="rotate(-25 17.5 42)" />
          <ellipse cx="39.5" cy="44" rx="3.4" ry="2.2" fill="#fff" opacity="0.75" transform="rotate(-25 39.5 44)" />
        </symbol>

        {/* ベル */}
        <symbol id="sym-BELL" viewBox="0 0 64 64">
          <circle cx="32" cy="12" r="4" fill="url(#g-bell)" stroke="#8a5600" strokeWidth="1.6" />
          <path
            d="M18,42 C18,24 23,14 32,14 C41,14 46,24 46,42 L51,48 L13,48 Z"
            fill="url(#g-bell)"
            stroke="#8a5600"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="53" r="4.5" fill="#c07800" stroke="#8a5600" strokeWidth="1.6" />
          <ellipse cx="25" cy="24" rx="3.2" ry="6.5" fill="#fff" opacity="0.5" transform="rotate(12 25 24)" />
        </symbol>

        {/* ピエロ（道化師の帽子） */}
        <symbol id="sym-CLOWN" viewBox="0 0 64 64">
          <path d="M28,44 C20,40 10,32 11,19 C20,24 26,32 30,42 Z" fill="url(#g-hat-blue)" stroke="#0c2f66" strokeWidth="2" strokeLinejoin="round" />
          <path d="M36,44 C44,40 54,32 53,19 C44,24 38,32 34,42 Z" fill="url(#g-hat-red)" stroke="#6e0715" strokeWidth="2" strokeLinejoin="round" />
          <path d="M26,44 C27,26 29,14 32,8 C35,14 37,26 38,44 Z" fill="url(#g-hat-yellow)" stroke="#8a5600" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="11" cy="18" r="4.2" fill="#fff" stroke="#b8b8b8" strokeWidth="1.2" />
          <circle cx="53" cy="18" r="4.2" fill="#fff" stroke="#b8b8b8" strokeWidth="1.2" />
          <circle cx="32" cy="7.5" r="4.2" fill="#fff" stroke="#b8b8b8" strokeWidth="1.2" />
          <rect x="17" y="44" width="30" height="10" rx="5" fill="url(#g-hat-red)" stroke="#6e0715" strokeWidth="2" />
        </symbol>

        {/* リプレイ（循環矢印） */}
        <symbol id="sym-REPLAY" viewBox="0 0 64 64">
          <path
            d="M15,26 A19,19 0 0 1 49,26"
            fill="none"
            stroke="url(#g-replay)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <polygon points="42,20 58,25 46,35" fill="#00bcd4" />
          <path
            d="M49,38 A19,19 0 0 1 15,38"
            fill="none"
            stroke="url(#g-replay)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <polygon points="22,44 6,39 18,29" fill="#00bcd4" />
        </symbol>
      </defs>
    </svg>
  )
}

interface SlotSymbolProps {
  symbol: Symbol
  size?: number
}

/** リール図柄1つを描画する */
export function SlotSymbol({ symbol, size = 54 }: SlotSymbolProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <use href={`#sym-${symbol}`} />
    </svg>
  )
}
