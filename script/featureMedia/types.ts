export interface ScenarioContext {
  /** Opens clips from the clips folder (several go to the batch list) */
  open: (...clips: string[]) => Promise<void>,
  /** Runs a keyboard action (see the Keyboard & mouse shortcuts dialog for names), optionally with arguments */
  action: (name: string, args?: unknown) => Promise<void>,
  /** Presses keys with xdotool, e.g. 'Return' to confirm a dialog that an action opened (start the action without awaiting it) */
  key: (keys: string) => Promise<void>,
  /** Types text with xdotool */
  type: (text: string) => Promise<void>,
  /** Clicks at a position in the 1280×800 window (find it in a screenshot) */
  click: (x: number, y: number) => Promise<void>,
  /** Saves a screenshot as <scenario>-<name>.png */
  shot: (name: string) => Promise<void>,
  wait: (ms: number) => Promise<void>,
}

export interface Scenario {
  description: string,
  /** File names of the clips it needs, from the clips folder or downloaded */
  clips: string[],
  /** Settings to start with (see src/main/configStore.ts), e.g. to show an export mode */
  config?: Record<string, unknown>,
  run: (ctx: ScenarioContext) => Promise<void>,
}
