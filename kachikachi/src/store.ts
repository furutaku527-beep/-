import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type BonusData,
  type ColorKey,
  type SceneId,
  type SceneData,
  SCENE_IDS,
  createAllScenes,
  createBonus,
  createHints,
  increment,
  decrement,
  resetCell,
  resetScene,
  setGames,
  addGames,
  setLabel,
  addBonus,
  addHint,
} from './logic/counter'
import { DEFAULT_MACHINE_ID } from './logic/machines'

interface Prefs {
  sound: boolean
  vibrate: boolean
  keepAwake: boolean
}

export type ViewId = 'counter' | 'estimate'

interface CounterStore {
  scenes: Record<SceneId, SceneData>
  active: SceneId
  view: ViewId
  /** 選択中の機種ID（machines.ts） */
  machineId: string
  /** 合算パネルで選択中の色 */
  combine: ColorKey[]
  prefs: Prefs

  incrementCell: (key: ColorKey) => void
  decrementCell: (key: ColorKey) => void
  resetCellCount: (key: ColorKey) => void
  renameCell: (key: ColorKey, label: string) => void
  setGamesValue: (games: number) => void
  addGamesValue: (delta: number) => void
  addBonusValue: (key: keyof BonusData, delta: number) => void
  addHintValue: (section: string, key: string, delta: number) => void
  setActiveScene: (id: SceneId) => void
  setView: (view: ViewId) => void
  setMachine: (id: string) => void
  toggleCombine: (key: ColorKey) => void
  resetActiveScene: () => void
  resetAll: () => void
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
}

function updateActive(
  state: Pick<CounterStore, 'scenes' | 'active'>,
  fn: (scene: SceneData) => SceneData,
): Pick<CounterStore, 'scenes'> {
  return {
    scenes: { ...state.scenes, [state.active]: fn(state.scenes[state.active]) },
  }
}

export const useCounterStore = create<CounterStore>()(
  persist(
    (set) => ({
      scenes: createAllScenes(),
      active: 'A',
      view: 'counter',
      machineId: DEFAULT_MACHINE_ID,
      combine: [],
      prefs: { sound: true, vibrate: true, keepAwake: false },

      incrementCell: (key) => set((s) => updateActive(s, (sc) => increment(sc, key))),
      decrementCell: (key) => set((s) => updateActive(s, (sc) => decrement(sc, key))),
      resetCellCount: (key) => set((s) => updateActive(s, (sc) => resetCell(sc, key))),
      renameCell: (key, label) => set((s) => updateActive(s, (sc) => setLabel(sc, key, label))),
      setGamesValue: (games) => set((s) => updateActive(s, (sc) => setGames(sc, games))),
      addGamesValue: (delta) => set((s) => updateActive(s, (sc) => addGames(sc, delta))),
      addBonusValue: (key, delta) => set((s) => updateActive(s, (sc) => addBonus(sc, key, delta))),
      addHintValue: (section, key, delta) =>
        set((s) => updateActive(s, (sc) => addHint(sc, section, key, delta))),
      setActiveScene: (id) => set({ active: id }),
      setView: (view) => set({ view }),
      setMachine: (id) => set({ machineId: id }),
      toggleCombine: (key) =>
        set((s) => ({
          combine: s.combine.includes(key)
            ? s.combine.filter((k) => k !== key)
            : [...s.combine, key],
        })),
      resetActiveScene: () => set((s) => updateActive(s, resetScene)),
      resetAll: () => set({ scenes: createAllScenes(), combine: [] }),
      setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
    }),
    {
      name: 'kachikachi-store',
      version: 3,
      // v1（ジャグラー向け初期版）→ v2（ハナハナ天翔）→ v3（複数機種対応）
      migrate: (persisted, version) => {
        const state = persisted as {
          scenes?: Record<SceneId, SceneData>
          machineId?: string
        } & Record<string, unknown>

        if (version < 2 && state.scenes) {
          // v1: bonus/hintsフィールドを補い、未変更のデフォルトラベルをハナハナ用に置換
          const v1Labels: Record<ColorKey, string> = {
            white: 'ぶどう',
            red: 'チェリー',
            green: 'スイカ',
            yellow: 'ベル',
          }
          const v2Labels: Record<ColorKey, string> = {
            white: 'ベル',
            red: 'スイカ',
            green: 'チェリー',
            yellow: 'その他',
          }
          for (const id of SCENE_IDS) {
            const scene = state.scenes[id]
            if (!scene) continue
            scene.bonus ??= createBonus()
            scene.hints ??= createHints()
            for (const key of Object.keys(v1Labels) as ColorKey[]) {
              if (scene.cells[key].label === v1Labels[key]) {
                scene.cells[key].label = v2Labels[key]
              }
            }
          }
        }
        // v2→v3: hintsは同じネスト構造（天翔のsection id/colorキーがそのまま使える）。
        // machineIdだけ補う。
        if (version < 3) {
          state.machineId ??= DEFAULT_MACHINE_ID
        }
        return state
      },
    },
  ),
)
