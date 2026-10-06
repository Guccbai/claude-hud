# hud-desktop

Claude 桌面版 Code 页的 HUD。HUD 是输入框上方的一条信息栏。

它显示：文件夹、运行中的子代理（圆点）、上下文用量、每周额度、费用、缓存、活动。
终端里不显示，终端用 Rust 版状态栏。

插件名是 `hud-desktop`。`claude-hud` 不能用：`claude-` 开头的名字被 Claude Code 保留。

## 布局

| 编号 | 名字 | 样子 |
| --- | --- | --- |
| 1 | 仪表盘 | 五行，没有卡片。多了累计 token 和最近一次请求 |
| 2 | 单行 | 一行：用量、正在运行的工具、费用、命中率；窗口窄时会折行 |
| 3 | 两行 | 两行：第一行是用量和费用，第二行是活动和重置时间（默认） |

子代理：每个运行中的子代理一个圆点，四个一组。没有子代理时不显示。

## 切换

- `/hud 1`、`/hud 2`、`/hud 3`：选一个布局。
- `/hud`：不带参数，轮换到下一个。

选择存在 `$.store` 里，下次会话还在。

## 加载

把本目录装到 `~/.claude/claude-hud/desktop`，再在 `~/.claude/settings.json` 的 `env` 里加：

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/claude-hud/desktop" } }
```

## 检查

```sh
claude plugin validate .
claude plugin test .
```
