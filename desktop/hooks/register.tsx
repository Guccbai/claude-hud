import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import type { Layout, Meter, Tokens } from '../types'
import { add, dots, hitRate, LAYOUTS, num, pickLayout, pie, PURPLE, snapshot, span } from './format'
import { ICONS, type IconName } from './icons'

const snap = atom({ plugin: 'hud-desktop', key: 'snap' } as const, null)
const running = atom({ plugin: 'hud-desktop', key: 'running' } as const, null)
const total = atom({ plugin: 'hud-desktop', key: 'total' } as const, null)
// Ids of subagents started and not yet finished.
const agents = atom({ plugin: 'hud-desktop', key: 'agents' } as const, [] as string[])
// Mirrors $.store 'layout' so the band redraws when /hud changes it.
const layout = atom({ plugin: 'hud-desktop', key: 'layout' } as const, 3 as Layout)

// Host UTC offset in minutes, from `date +%z` (e.g. +0800 -> 480); read once.
let offset: number | undefined
const utcOffset = async ($: EngineInterface): Promise<number> => {
  if (offset !== undefined) return offset
  const r = await $.process.run(['date', '+%z']).catch(() => null)
  const m = /^([+-])(\d\d)(\d\d)/.exec(r?.stdout.trim() ?? '')
  offset = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
  return offset
}

// Meters already warned about, so a toast fires once per crossing of 80%.
const warned = new Set<string>()

const refresh = async ($: EngineInterface) => {
  const cwd = await $.session.cwd()
  const [model, usage, now, repo, turns] = await Promise.all([
    $.session.model(),
    $.session.usage({ breakdown: 'summary' }),
    $.clock.now(),
    $.session.repo(),
    $.session.turns(),
  ])
  const next = snapshot(model, cwd, usage, now, { repo: repo?.name ?? '', turns, offsetMin: await utcOffset($) })
  for (const m of [next.context, next.week]) {
    if (!m) continue
    if (m.percent >= 80 && !warned.has(m.label)) {
      warned.add(m.label)
      $.ui.toast(`${m.label}已用 ${m.percent}%`)
    } else if (m.percent < 80) warned.delete(m.label)
  }
  await update($, snap, () => next)
}

// Green under 50%, amber under 80%, red above.
const tone = (p: number) => (p < 50 ? 'green' : p < 80 ? 'yellow' : 'red')
const HEX = { green: '#4ade80', yellow: '#facc15', red: '#f87171', magenta: '#e879f9' } as const
const GRAY = '#8f8d86'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const saved = Number(await $.store.get('layout'))
    if (saved === 1 || saved === 2 || saved === 3) await update($, layout, () => saved)
    await $.command.register({ name: 'hud', description: '切换 HUD 布局：1 仪表盘，2 单行，3 两行；不带参数则轮换', argumentHint: '[1|2|3]', immediate: true })
    await refresh($).catch(() => {})
    return r
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const l = pickLayout(e.args, await read($, layout))
    if (l === null) return { text: '用法：/hud 1（仪表盘）、/hud 2（单行）、/hud 3（两行），不带参数则轮换' }
    await update($, layout, () => l)
    await $.store.set('layout', l)
    return { text: `HUD 已切换为「${LAYOUTS[l]}」` }
  })

  // Fires after each main turn and when a rate-limit window moves.
  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    await refresh($).catch(() => {})
    return r
  })

  on('tool.call', async ($, e, next) => {
    await update($, running, () => e.tool)
    try {
      return await next(e)
    } finally {
      await update($, running, () => null)
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = r.agentId
    if (id) await update($, agents, prev => [...prev, id])
    return r
  })

  // Main turns and subagent turns both count toward the session total.
  // A subagent's loop runs as one turn, so its turn.complete means it finished.
  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) await update($, agents, prev => prev.filter(a => a !== id))
    const u = e.usage
    if (u) {
      const t: Tokens = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens }
      await update($, total, prev => add(prev, t))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The terminal has the Rust statusline; this band is for the desktop.
    if (e.surface === 'terminal') return next(e)
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null) return next(e)
    const [tool, sum, now, mode, subs] = await Promise.all([read($, running), read($, total), $.clock.now(), read($, layout), read($, agents)])
    const { Box, Text, Svg } = $.ui.resolve(e)

    const icon = (name: IconName, color: keyof typeof HEX | 'gray' = 'gray') =>
      <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color === 'gray' ? GRAY : HEX[color]}" d="${ICONS[name].path}"/></svg>`} alt={name.replace(/_/g, ' ')} width={15} height={15} />
    const row = (...children: unknown[]) => <Box flexDirection="row" alignItems="center" columnGap={1}>{children}</Box>
    const gauge = (m: Meter) =>
      <Svg source={pie(m.percent, HEX[tone(m.percent)], m.elapsed)} alt={`${m.label}已用 ${m.percent}%`} width={16} height={16} />
    const pct = (m: Meter) => <Text bold color={tone(m.percent)}>{m.percent}%</Text>
    const dim = (s: string) => <Text dimColor>{s}</Text>
        const d = dots(subs.length)
    const dir = row(
      icon('folder_outline'),
      <Text>{s.dir}</Text>,
      subs.length > 0 && <Box key="agents"><Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="6" viewBox="0 0 ${d.width} 6">${d.xs.map(x => `<circle cx="${x}" cy="3" r="3" fill="${PURPLE}"/>`).join('')}</svg>`} alt={`${subs.length} 个子代理运行中`} width={d.width} height={6} /></Box>,
    )
    const cost = row(icon('currency_usd', 'yellow'), <Text color="yellow">{s.cost.replace('$', '') || '—'}</Text>)
    const hit = (x: Tokens) => <Text bold color={hitRate(x) >= 80 ? 'green' : 'yellow'}>{hitRate(x)}%</Text>
    const tokens = (x: Tokens) => dim(`输入 ${num(x.input)}，输出 ${num(x.output)}，缓存读取 ${num(x.cacheRead)}，缓存写入 ${num(x.cacheWrite)}`)
    const activity = [
      row(icon('repeat'), <Text>第 {s.turns} 轮</Text>),
      row(icon('clock_outline'), <Text>{span(now - s.startedAt)}</Text>),
      tool ? row(icon('play', 'magenta'), <Text color="magenta">正在运行 {tool}</Text>) : row(icon('sleep'), dim('空闲')),
    ]
    const line = (...children: unknown[]) => <Box flexDirection="row" alignItems="center" columnGap={2} paddingX={1} flexWrap="wrap">{children}</Box>
    // Left part wraps when narrow; the right part (hit rate, cost) never leaves the right edge.
    const split = (left: unknown[], right: unknown[]) => (
      <Box flexDirection="row" alignItems="center" columnGap={2} paddingX={1}>
        <Box flexDirection="row" alignItems="center" columnGap={2} flexWrap="wrap" flexGrow={1} flexShrink={1}>{left}</Box>
        <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={0}>{right}</Box>
      </Box>
    )
    const right = [sum && row(icon('database_outline'), dim('命中率'), hit(sum)), cost]

    if (mode === 1) return (
      <Box flexDirection="column">
        {line(dir, <Box flexGrow={1} />, cost)}
        {(s.context || s.week) && line(
          s.context && row(icon('brain'), gauge(s.context), pct(s.context), dim(s.context.note)),
          s.week && row(icon('calendar_week'), gauge(s.week), pct(s.week), dim(s.week.resetIn), s.week.resetAt && <Text color={PURPLE}>{s.week.resetAt}</Text>),
        )}
        {line(...activity)}
        {sum && line(row(icon('database_outline'), dim('本次会话累计'), tokens(sum), dim('缓存命中率'), hit(sum)))}
        {s.tokens && line(row(icon('swap_vertical'), dim('最近一次请求'), tokens(s.tokens)))}
      </Box>
    )

    if (mode === 2) return split([
      dir,
      s.context && row(icon('brain'), gauge(s.context), pct(s.context), dim(s.context.note)),
      s.week && row(icon('calendar_week'), gauge(s.week), pct(s.week), dim(s.week.resetIn)),
      activity[1],
      tool && activity[2],
    ], right)

    return (
      <Box flexDirection="column">
        {split([
          dir,
          s.context && row(icon('brain'), gauge(s.context), pct(s.context), dim(s.context.note)),
          s.week && row(icon('calendar_week'), gauge(s.week), pct(s.week), dim(s.week.resetIn)),
        ], right)}
        {line(...activity, <Box flexGrow={1} />, s.week?.resetAt && <Text color={PURPLE}>{s.week.resetAt}</Text>)}
      </Box>
    )
  })
}
