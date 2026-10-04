import type { SessionUsage } from 'claude-code'
import type { Hud, Layout, Tokens } from '../types'

const toMs = (at: string | number | undefined): number =>
  at === undefined ? NaN : typeof at === 'number' || /^\d+$/.test(at) ? Number(at) * 1000 : Date.parse(at)

// Milliseconds in plain Chinese: 6天17小时, 2小时13分钟, 45分钟.
export const span = (ms: number): string => {
  const m = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `${d}天${h}小时` : h ? `${h}小时${m % 60}分钟` : `${m}分钟`
}

export const left = (at: string | number | undefined, now: number): string => {
  const t = toMs(at)
  return Number.isNaN(t) ? '' : span(t - now)
}

// Share of a window of `windowMs` already gone, 0-100; undefined when the reset is unknown.
export const elapsed = (at: string | number | undefined, now: number, windowMs: number): number | undefined => {
  const t = toMs(at)
  return Number.isNaN(t) ? undefined : Math.min(100, Math.max(0, Math.round(100 - ((t - now) / windowMs) * 100)))
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

// Reset moment in local time: 10月11日 16点，星期日 (minutes shown when not :00).
// offsetMin is the host's UTC offset; the hook runtime's own clock zone is not trusted.
export const resetAt = (at: string | number | undefined, offsetMin: number): string => {
  const t = toMs(at)
  if (Number.isNaN(t)) return ''
  const d = new Date(t + offsetMin * 60000)
  const m = d.getUTCMinutes()
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}点${m ? `${m}分` : ''}，星期${WEEK[d.getUTCDay()]}`
}

// Token counts the Chinese way: 927, 1.2万, 3.4亿.
export const num = (n: number): string =>
  n >= 1e8 ? `${(n / 1e8).toFixed(1)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}万` : String(n)

// claude-opus-5-5 -> Opus 5.5; anything else unchanged.
export const pretty = (model: string): string => {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(.*)$/.exec(model)
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}${m[4]}` : model
}

// Cache read over everything sent as input, 0-100.
export const hitRate = (t: Tokens): number => {
  const all = t.cacheRead + t.cacheWrite + t.input
  return all ? Math.round((t.cacheRead / all) * 100) : 0
}

export const add = (a: Tokens | null, b: Tokens): Tokens => ({
  input: (a?.input ?? 0) + b.input,
  output: (a?.output ?? 0) + b.output,
  cacheRead: (a?.cacheRead ?? 0) + b.cacheRead,
  cacheWrite: (a?.cacheWrite ?? 0) + b.cacheWrite,
})

export type Extra = Pick<Hud, 'version' | 'repo' | 'turns'> & { offsetMin: number }

export const snapshot = (model: string, cwd: string, u: SessionUsage, now: number, x: Extra): Hud => {
  const c = u.context
  const w = u.rateLimits.find(r => r.kind === 'seven_day')
  const a = c.breakdown?.apiUsage
  return {
    model: pretty(model),
    dir: cwd.split('/').pop() || cwd,
    cost: u.cost ? `$${u.cost.usd.toFixed(2)}` : '',
    context: c.percent === undefined ? null : { label: '上下文', percent: c.percent, note: `${num(c.tokens ?? 0)} / ${num(c.window)}` },
    week: w ? { label: '每周额度', percent: Math.round(w.percentUsed), note: '', resetIn: left(w.resetsAt, now), resetAt: resetAt(w.resetsAt, x.offsetMin), elapsed: elapsed(w.resetsAt, now, 7 * 86400000) } : null,
    version: x.version,
    repo: x.repo,
    turns: x.turns,
    startedAt: u.startedAt,
    tokens: a ? { input: a.input_tokens, output: a.output_tokens, cacheRead: a.cache_read_input_tokens, cacheWrite: a.cache_creation_input_tokens } : null,
  }
}

export const LAYOUTS: Record<Layout, string> = { 1: '仪表盘', 2: '单行', 3: '卡片' }

// `/hud` argument to a layout: 1-3 picks one, empty cycles, anything else is null.
export const pickLayout = (arg: string, current: Layout): Layout | null => {
  const a = arg.trim()
  if (!a) return ((current % 3) + 1) as Layout
  return a === '1' || a === '2' || a === '3' ? (Number(a) as Layout) : null
}

// Subagent dots: centers of r=3 circles 4px apart, 10px between groups of 4.
export const dots = (n: number): { xs: number[]; width: number } => {
  const xs = Array.from({ length: n }, (_, i) => 3 + i * 10 + Math.floor(i / 4) * 6)
  return { xs, width: n ? xs[n - 1]! + 3 : 0 }
}
