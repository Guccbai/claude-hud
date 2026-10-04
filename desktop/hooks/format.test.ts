import { test, expect } from 'claude-code/testing'
import { add, dots, elapsed, hitRate, left, num, pickLayout, pretty, resetAt, snapshot } from './format'

test('format helpers', async () => {
  const now = Date.parse('2026-10-04T13:30:00Z')
  expect(left('2026-10-04T16:50:00Z', now)).toBe('3小时20分钟')
  expect(left(String(Date.parse('2026-10-11T08:00:00Z') / 1000), now)).toBe('6天18小时')
  expect(left('garbage', now)).toBe('')
  expect(elapsed('2026-10-11T08:00:00Z', now, 7 * 86400000)).toBe(3)
  expect(resetAt('2026-10-11T08:00:00Z', 480)).toBe('10月11日 16点，星期日')
  expect(resetAt('2026-10-11T07:59:00Z', 480)).toBe('10月11日 15点59分，星期日')
  expect(pretty('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(num(927)).toBe('927')
  expect(num(206900)).toBe('20.7万')
  const t = add(add(null, { input: 2, output: 5, cacheRead: 90, cacheWrite: 8 }), { input: 0, output: 1, cacheRead: 0, cacheWrite: 0 })
  expect(t).toEqual({ input: 2, output: 6, cacheRead: 90, cacheWrite: 8 })
  expect(hitRate(t)).toBe(90)
  const s = snapshot('claude-opus-5-5', '/Users/x/Code/wecode', {
    startedAt: 0,
    context: { tokens: 206900, window: 1000000, percent: 21 },
    rateLimits: [{ kind: 'seven_day', percentUsed: 1, resetsAt: '2026-10-11T08:00:00Z' }],
    cost: { usd: 5.01 },
  }, now, { version: '2.1.286', repo: '', turns: 14, offsetMin: 480 })
  expect(s.context).toEqual({ label: '上下文', percent: 21, note: '20.7万 / 100.0万' })
  expect(s.week?.resetIn).toBe('6天18小时')
  expect(s.week?.resetAt).toBe('10月11日 16点，星期日')
  expect(s.cost).toBe('$5.01')
  expect(s.tokens).toBe(null)
})

test('subagent dots', async () => {
  expect(dots(0)).toEqual({ xs: [], width: 0 })
  expect(dots(1)).toEqual({ xs: [3], width: 6 })
  expect(dots(6)).toEqual({ xs: [3, 13, 23, 33, 49, 59], width: 62 })
})

test('layout switch', async () => {
  expect(pickLayout('', 3)).toBe(1)
  expect(pickLayout('', 1)).toBe(2)
  expect(pickLayout(' 2 ', 3)).toBe(2)
  expect(pickLayout('4', 3)).toBe(null)
  expect(pickLayout('卡片', 1)).toBe(null)
})
