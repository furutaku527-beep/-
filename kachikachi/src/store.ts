import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type ColorKey,
  type SceneId,
  type SceneData,
  createAllScenes,
  increment,
  decrement,
  resetCell,
  resetScene,
  setGames,
  addGames,
  setLabel,
} from './logic/counter'

interface Prefs {
  sound: boolean
  vibrate: boolean
  keepAwake: boolean
}

interface CounterStore {
  scenes: Record<SceneId, SceneData>
  active: SceneId
  /** 合算パネルで選択中の色 */
  combine: ColorKey[]
  prefs: Prefs

  incrementCell: (key: ColorKey) => void
  decrementCell: (key: ColorKey) => void
  resetCellCount: (key: ColorKey) => void
  renameCell: (key: ColorKey, label: string) => void
  setGamesValue: (games: number) => void
  addGamesValue: (delta: number) => void
  setActiveScene: (id: SceneId) => void
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
      combine: [],
      prefs: { sound: true, vibrate: true, keepAwake: false },

      incrementCell: (key) => set((s) => updateActive(s, (sc) => increment(sc, key))),
      decrementCell: (key) => set((s) => updateActive(s, (sc) => decrement(sc, key))),
      resetCellCount: (key) => set((s) => updateActive(s, (sc) => resetCell(sc, key))),
      renameCell: (key, label) => set((s) => updateActive(s, (sc) => setLabel(sc, key, label))),
      setGamesValue: (games) => set((s) => updateActive(s, (sc) => setGames(sc, games))),
      addGamesValue: (delta) => set((s) => updateActive(s, (sc) => addGames(sc, delta))),
      setActiveScene: (id) => set({ active: id }),
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
      version: 1,
    },
  ),
)
