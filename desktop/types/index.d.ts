// elapsed: how far through its time window the meter is, 0-100 (rate limits only).
export type Meter = { label: string; percent: number; note: string; elapsed?: number; resetIn?: string; resetAt?: string }
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Hud = {
  model: string
  dir: string
  cost: string
  context: Meter | null
  week: Meter | null
  repo: string
  turns: number
  startedAt: number
  tokens: Tokens | null
}
// 1 dashboard, 2 single row, 3 cards.
export type Layout = 1 | 2 | 3

declare module 'claude-code' {
  interface PluginState {
    'hud-desktop': { snap: Hud | null; running: string | null; total: Tokens | null; agents: string[]; layout: Layout }
  }
}
