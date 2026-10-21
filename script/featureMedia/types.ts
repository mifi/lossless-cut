export interface ScenarioContext {
  /** Opens a clip from the clips folder */
  open: (clip: string) => Promise<void>,
  /** Runs a keyboard action (see the Keyboard & mouse shortcuts dialog for names), optionally with arguments */
  action: (name: string, args?: unknown) => Promise<void>,
  /** Saves a screenshot as <scenario>-<name>.png */
  shot: (name: string) => Promise<void>,
  wait: (ms: number) => Promise<void>,
}

export interface Scenario {
  description: string,
  /** File names of the clips it needs, from the clips folder or downloaded from FEATURE_MEDIA_CLIPS_URL */
  clips: string[],
  run: (ctx: ScenarioContext) => Promise<void>,
}
