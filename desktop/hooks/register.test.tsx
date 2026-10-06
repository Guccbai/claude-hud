import { test, expect, mock } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } } as const

test('/hud switches layouts; the terminal gets no band', async ($, on) => {
  on('session.start', ($, e) => e as any)
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-04T13:30:00Z') } as any)
  const a = on as any
  a('session.cwd', () => ({ value: '/tmp/x' }))
  a('session.model', () => ({ value: 'claude-opus-5-5' }))
  a('session.repo', () => ({ value: null }))
  a('session.turns', () => ({ value: 3 }))
  a('process.run', () => ({ value: ({ exitCode: 1, stdout: '', stderr: '' }) }))
  a('command.register', (_$: unknown, e: { name: string }) => ({ value: { command: e.name } }))
  a('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  a('ui.render', ($: any, e: any) => { const { Box } = $.ui.resolve(e); return <Box /> })
  a('session.usage', () => ({ value: {
    startedAt: 0,
    context: { tokens: 206900, window: 1000000, percent: 21, breakdown: { apiUsage: { input_tokens: 5, output_tokens: 300, cache_read_input_tokens: 90000, cache_creation_input_tokens: 1200 } } },
    rateLimits: [{ kind: 'seven_day', percentUsed: 1, resetsAt: '2026-10-11T08:00:00Z' }],
    cost: { usd: 5.01 },
  } }))
  await ($.session as any).start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  const text = async (args: string) => (await $.command.run({ command: 'hud', args } as any)).text
  // [args, name, text only that layout shows, text it must not show]
  for (const [args, name, has, lacks] of [['1', '仪表盘', /最近一次请求/, /^读取 /], ['2', '单行', /20\.7万/, /星期日/], ['', '两行', /星期日/, /最近一次请求/]] as const) {
    expect(await text(args)).toBe(`HUD 已切换为「${name}」`)
    const ui = await $.ui.mount({ plugin: 'hud-desktop', surface: 'desktop', ...BAND })
    expect([name, !!(await ui.find({ type: 'Text', text: has }))]).toEqual([name, true])
    expect(await ui.find({ type: 'Text', text: lacks })).toBeUndefined()
    expect(await ui.find({ key: 'agents' })).toBeUndefined()
    await ui.unmount()
  }
  expect(await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'd', subagentType: 'general-purpose' } as any)).toEqual({ model: 'haiku', agentId: 'a1' })
  const ui = await $.ui.mount({ plugin: 'hud-desktop', surface: 'desktop', ...BAND })
  expect(((await ui.find({ key: 'agents' }))?.children[0] as any)?.props.alt).toBe('1 个子代理运行中')
  await ui.unmount()
  await $.turn.complete({ agentId: 'a1', reason: 'end_turn', answer: 'done' } as any).catch(() => {})
  const after = await $.ui.mount({ plugin: 'hud-desktop', surface: 'desktop', ...BAND })
  expect(await after.find({ key: 'agents' })).toBeUndefined()
  await after.unmount()
  expect(await text('9')).toMatch(/^用法/)
  const term = await $.ui.mount({ plugin: 'hud-desktop', surface: 'terminal', ...BAND })
  expect(await term.find({ type: 'Text', text: /20\.7万/ })).toBeUndefined()
  await term.unmount()
})
