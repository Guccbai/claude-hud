import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import type { Layout, Meter, Tokens } from '../types'
import { add, dots, hitRate, LAYOUTS, num, pickLayout, snapshot, span } from './format'
import { ICONS, type IconName } from './icons'

const snap = atom({ plugin: 'hud-desktop', key: 'snap' } as const, null)
const turn = atom({ plugin: 'hud-desktop', key: 'turn' } as const, null)
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
  const [model, usage, now, version, repo, turns] = await Promise.all([
    $.session.model(),
    $.session.usage({ breakdown: 'summary' }),
    $.clock.now(),
    $.session.version(),
    $.session.repo(),
    $.session.turns(),
  ])
  const next = snapshot(model, cwd, usage, now, { version: version.version, repo: repo?.name ?? '', turns, offsetMin: await utcOffset($) })
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
const PURPLE = '#a78bfa'
const clamp = (p: number) => Math.min(100, Math.max(0, p))

// Rounded usage bar; with `time`, a purple hairline under it shows how far
// through its window the limit is.
const svgBar = (p: number, width: number, time?: number) => {
  const w = Math.round((clamp(p) / 100) * width)
  const h = time === undefined ? 6 : 10
  const usage = `<rect width="${width}" height="6" rx="3" fill="#8884"/>${w ? `<rect width="${Math.max(w, 6)}" height="6" rx="3" fill="${HEX[tone(p)]}"/>` : ''}`
  const window = time === undefined ? '' : `<rect y="8.5" width="${width}" height="1.5" rx="0.75" fill="#8883"/><rect y="8.5" width="${Math.round((clamp(time) / 100) * width)}" height="1.5" rx="0.75" fill="${PURPLE}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">${usage}${window}</svg>`
}

export const register: Register = on => {
  let turnStart = 0
  let tools = 0

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const saved = Number(await $.store.get('layout'))
    if (saved === 1 || saved === 2 || saved === 3) await update($, layout, () => saved)
    await $.command.register({ name: 'hud', description: '切换 HUD 布局：1 仪表盘，2 单行，3 卡片；不带参数则轮换', argumentHint: '[1|2|3]', immediate: true })
    await refresh($).catch(() => {})
    return r
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const l = pickLayout(e.args, await read($, layout))
    if (l === null) return { text: '用法：/hud 1（仪表盘）、/hud 2（单行）、/hud 3（卡片），不带参数则轮换' }
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

  on('prompt.submit', async ($, e, next) => {
    turnStart = await $.clock.now()
    tools = 0
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    tools += 1
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
    if (e.agentId === undefined) {
      const seconds = Math.round(((await $.clock.now()) - turnStart) / 1000)
      await update($, turn, () => ({ seconds, tools }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The terminal has the Rust statusline; this band is for the desktop.
    if (e.surface === 'terminal') return next(e)
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null) return next(e)
    const [t, tool, sum, now, mode, subs] = await Promise.all([read($, turn), read($, running), read($, total), $.clock.now(), read($, layout), read($, agents)])
    const { Box, Text, Svg } = $.ui.resolve(e)

    const icon = (name: IconName, color: keyof typeof HEX | 'gray' = 'gray') =>
      <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color === 'gray' ? GRAY : HEX[color]}" d="${ICONS[name].path}"/></svg>`} alt={name.replace(/_/g, ' ')} width={15} height={15} />
    const row = (...children: unknown[]) => <Box flexDirection="row" alignItems="center" columnGap={1}>{children}</Box>
    const gauge = (m: Meter, width: number) =>
      <Svg source={svgBar(m.percent, width, m.elapsed)} alt={`${m.label}已用 ${m.percent}%`} width={width} height={m.elapsed === undefined ? 6 : 10} />
    const pct = (m: Meter) => <Text bold color={tone(m.percent)}>{m.percent}%</Text>
    const dim = (s: string) => <Text dimColor>{s}</Text>
    const card = (key: string, body: unknown) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderDimColor paddingX={1} flexGrow={1}>
        {body}
      </Box>
    )
    const d = dots(subs.length)
    const dir = row(
      icon('folder_outline'),
      <Text>{s.dir}</Text>,
      subs.length > 0 && <Box key="agents"><Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="6" viewBox="0 0 ${d.width} 6">${d.xs.map(x => `<circle cx="${x}" cy="3" r="3" fill="${PURPLE}"/>`).join('')}</svg>`} alt={`${subs.length} 个子代理运行中`} width={d.width} height={6} /></Box>,
    )
    const version = row(icon('tag_outline'), dim(`Claude Code ${s.version}`))
    const cost = row(icon('currency_usd', 'yellow'), <Text color="yellow">{s.cost.replace('$', '') || '—'}</Text>)
    const hit = (x: Tokens) => <Text bold color={hitRate(x) >= 80 ? 'green' : 'yellow'}>{hitRate(x)}%</Text>
    const tokens = (x: Tokens) => dim(`输入 ${num(x.input)}，输出 ${num(x.output)}，缓存读取 ${num(x.cacheRead)}，缓存写入 ${num(x.cacheWrite)}`)
    const activity = [
      row(icon('repeat'), <Text>第 {s.turns} 轮</Text>),
      row(icon('clock_outline'), <Text>{span(now - s.startedAt)}</Text>),
      t && row(icon('lightning_bolt_outline'), dim(`上一轮 ${t.seconds} 秒，工具 ${t.tools} 次`)),
      tool ? row(icon('play', 'magenta'), <Text color="magenta">正在运行 {tool}</Text>) : row(icon('sleep'), dim('空闲')),
    ]
    const line = (...children: unknown[]) => <Box flexDirection="row" alignItems="center" columnGap={2} paddingX={1} flexWrap="wrap">{children}</Box>

    if (mode === 1) return (
      <Box flexDirection="column" rowGap={1}>
        {line(dir, <Box flexGrow={1} />, cost, version)}
        {(s.context || s.week) && line(
          s.context && row(icon('brain'), gauge(s.context, 140), pct(s.context), dim(s.context.note)),
          s.week && row(icon('calendar_week'), gauge(s.week, 140), pct(s.week), dim(`${s.week.resetIn}后重置`), s.week.resetAt && <Text color={PURPLE}>{s.week.resetAt}</Text>),
        )}
        {line(...activity)}
        {sum && line(row(icon('database_outline'), dim('本次会话累计'), tokens(sum), dim('缓存命中率'), hit(sum)))}
        {s.tokens && line(row(icon('swap_vertical'), dim('最近一次请求'), tokens(s.tokens)))}
      </Box>
    )

    if (mode === 2) return line(
      dir,
      s.context && row(icon('brain'), gauge(s.context, 80), pct(s.context)),
      s.week && row(icon('calendar_week'), gauge(s.week, 80), pct(s.week), dim(`${s.week.resetIn}后重置`)),
      <Box flexGrow={1} />,
      cost,
      version,
    )

    return (
      <Box flexDirection="column" rowGap={1}>
        {line(dir, <Box flexGrow={1} />, version)}
        <Box flexDirection="row" columnGap={1} flexWrap="wrap">
          {s.context && card('ctx', <>
            {row(icon('brain'), gauge(s.context, 120))}
            {row(pct(s.context), dim(s.context.note))}
          </>)}
          {s.week && card('week', <>
            {row(icon('calendar_week'), gauge(s.week, 120))}
            {row(pct(s.week), dim(`${s.week.resetIn}后重置`))}
            {s.week.resetAt && <Text color={PURPLE}>{s.week.resetAt}</Text>}
          </>)}
          {card('cost', <>
            {cost}
            {sum && row(icon('database_outline'), <Text>命中率</Text>, hit(sum))}
            {sum && dim(`读取 ${num(sum.cacheRead)}，写入 ${num(sum.cacheWrite)}`)}
          </>)}
          {card('act', <>
            {row(activity[0], dim('·'), activity[1])}
            {activity[2]}
            {activity[3]}
          </>)}
        </Box>
      </Box>
    )
  })
}
