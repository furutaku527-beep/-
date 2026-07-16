import { SCENE_IDS, type SceneData } from '../logic/counter'
import { useCounterStore } from '../store'

function hasData(scene: SceneData): boolean {
  return scene.games > 0 || Object.values(scene.cells).some((c) => c.count > 0)
}

/** A/B/Cシーン切替（実機の3モード相当。通常時/ボーナス中などを独立カウント） */
export function SceneTabs() {
  const scenes = useCounterStore((s) => s.scenes)
  const active = useCounterStore((s) => s.active)
  const setActiveScene = useCounterStore((s) => s.setActiveScene)

  return (
    <div className="sceneTabs" role="tablist" aria-label="シーン切替">
      {SCENE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`sceneTab${active === id ? ' is-active' : ''}`}
          onClick={() => setActiveScene(id)}
        >
          シーン{id}
          {hasData(scenes[id]) && <span className="sceneDot" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
