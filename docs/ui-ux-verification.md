# UI/UX 优化验证记录

> 状态：依据 `docs/ui-ux-redesign.md` 的 QA Matrix 实施并记录。本文档只记录实际测试结果、截图基线和未解决风险，不改变产品范围。

## 1. 构建与数据完整性

| 检查 | 结果 |
| --- | --- |
| 固定依赖 | `bun install --frozen-lockfile` 通过，未修改锁文件；devDependencies 全部为精确版本 |
| 正常构建 | `./build.sh` 退出码 0，报告 11 个分类、119 个网址 |
| 确定性构建 | 连续两次 `sha256sum index.html` 均为 `481ba1a6d8a849b50d753b388b42d82c931d9e2202c23184dccdca458872e335` |
| 生成文件同步 | 构建后 `git diff --exit-code -- index.html` 无差异 |
| 内容守恒 | 11 个分类、119 个网址，名称、顺序、归属和 URL 均未改变 |
| 离线入口 | `file://` 直接打开可用；全部自动化测试均在 `file://` 协议下通过 |
| 外链安全 | 全部 119 个网址条目保留 `target="_blank"` 与 `rel="noopener noreferrer"` |

构建仍产生一条既有的“URL 查询参数可能包含凭据”提醒（`navigation.groups[0].items[7].url` 的 `password` 参数），属于改造前已存在的提醒，未借此修改网址数据，构建未失败。

### 体积预算（7.3）

| 指标 | 上限 | 实测 |
| --- | --- | --- |
| 生成 HTML（未压缩） | 120KB | 108,128B |
| CSS（未压缩） | 20KB | 20,032B |
| JavaScript（未压缩） | 12KB | 12,277B |
| Lucide SVG（17 个唯一图标定义） | 20KB | 5,101B |
| Lucide 使用实例 | — | 147（`<use>` 引用，定义只出现一次） |

## 2. 搜索样本（8.3）

全部以 `config.yaml` 固定样本为准，自动化测试逐项断言通过：

| 查询 | 期望 | 实测 |
| --- | ---: | ---: |
| `github` | 10 | 10 |
| `luogu` | 6 | 6 |
| `graphviz` | 2 | 2 |
| `工具` | 38 | 38 |
| `AI` | 7 | 7 |
| `不存在的网址` | 0 | 0 |
| `github 教程` | 0 | 0 |

额外覆盖：空查询与纯空白查询恢复 119 个网址、11 个分类及原始计数；`ＧＩＴＨＵＢ`（全角）与 `GITHUB`、`LuOgU` 按 NFKC 得到相同结果；多关键词严格 AND 且保持 `config.yaml` 顺序；`<img src=x onerror=alert(1)>` 等输入不形成 HTML 节点、不执行脚本、不触发 dialog。

## 3. 视觉回归截图基线（8.2）

`tests/baseline/` 下的 8 张全页截图（浅色 / 深色 × 手机 / 平板 / 桌面 / 超宽桌面），由 `tests/navigation.visual.spec.mjs` 生成：

| 文件 | 视口 | 通过的结构断言 |
| --- | --- | --- |
| `phone-{light,dark}.png` | 390 × 844 | 两行工作栏（120px）、横向分类栏、单列、无页面级横向滚动 |
| `tablet-{light,dark}.png` | 768 × 1024 | 窄屏工作栏、横向分类栏、双列条目 |
| `desktop-{light,dark}.png` | 1440 × 1000 | 64px 单行工作栏、208px 侧栏、4 列、卡片高 76–84px |
| `wide-{light,dark}.png` | 1920 × 1080 | 内容最大宽度约 1680px、最多 5 列、无页面级横向滚动 |

每张截图均断言：`body` 无渐变背景、卡片默认无阴影、无页面级水平滚动；结构断言全部通过。字体为系统字体，未使用远程字体或 `vw/clamp` 缩放。

## 4. Lighthouse（7.3、8.5）

`bun run audit:lighthouse`（本地 HTTP 服务 + Headless Chromium，Lighthouse 13.4.1）：

| 指标 | 目标 | 实测 |
| --- | --- | --- |
| Performance | ≥ 95 | 98 |
| Accessibility | ≥ 95 | 100 |
| LCP | ≤ 2.5s | 1.97s |
| CLS | ≤ 0.1 | 0.000 |
| TBT | — | 47ms |

报告文件：`.lighthouse/report.json`（忽略，不入库）。

## 5. axe（8.5）

`tests/navigation.axe.spec.mjs` 在 390 × 844 与 1440 × 1000、浅色与深色主题（4 个 Chromium 项目 + Firefox）下运行，阻断级别（critical / serious）为 0。同时覆盖搜索过滤后的页面状态。

发现并修复的问题：配置指定的近黑图标底色（`#020202DE`）在深色主题下与深色前景对比度仅 1.05:1，已改为自定义底色回退始终使用白色前景。

## 6. 交互与故障状态（8.4）

全部由 `tests/navigation.spec.mjs` 自动覆盖（Chromium 桌面/移动 × 浅色/深色 + Firefox 桌面）：

- `/` 与 `Ctrl+K`：在可编辑区域不拦截，其他位置聚焦搜索框。
- `Esc`：第一次清空查询，空查询下第二次移出焦点。
- 搜索框 `ArrowDown` 聚焦第一个可见网址；`Enter` 不自动打开结果；原生 `Tab`/`Shift+Tab` 顺序正确，隐藏分类从 Tab 顺序移除。
- 首个非空查询只滚动一次到目录顶部；同一轮后续输入不重复滚动；清空不强制回到页面顶部。
- IME：`isComposing` 期间不更新列表，提交后只更新一次。
- 分类点击与 scrollspy 的 `aria-current` 一致；移动端活动分类自动滚入可视区域且不带动整页水平滚动；搜索后重建观察目标、清空后恢复全部可见分类且不保留失效活动分类。
- 模拟图标加载失败与配置缺失：同尺寸首字符回退，无布局偏移（CLS 为 0）。
- 主题首次跟随系统、手动切换刷新后保留、`localStorage` 写失败时当前会话仍可切换。
- 返回顶部按钮阈值前后正确显示/隐藏、键盘可触发、减少动画模式下即时滚动。

## 7. 浏览器范围（8.5）

| 浏览器 | 状态 |
| --- | --- |
| Chromium（Chrome/Edge 同引擎） | 桌面 + 移动全量通过 |
| Firefox | 桌面 22 项核心任务测试通过（Firefox 不支持 CDP 缩放模拟，200% 缩放测试仅在 Chromium 执行） |
| WebKit（Safari 引擎） | 未运行：系统缺少 `libicudata.so.74`（已安装 ICU 78），安装旧版 ICU 需 sudo 且可能破坏系统；需在 macOS 或具备正确依赖的机器上补做 |

## 8. 未解决风险与人工项

- **INP**：Lighthouse 在无真实交互样本时可能不提供 INP；需通过 DevTools Performance 交互 trace 单独验证（TBT 47ms 为间接参考）。
- **屏幕阅读器人工抽查**（VoiceOver + Safari / NVDA + Firefox）：本环境无 macOS / NVDA，尚未人工朗读验证。
- **可用性任务测试**（8.6 的 10 项任务与 5 秒第一印象）：需要真人测试者执行，自动化无法替代；阈值（搜索 ≤5s、分类 ≤8s、移动 ≤10s、无误点、第一印象回答正确）待人工验收。
- **浏览器滚动锚定**：清空搜索后页面展开时，浏览器可能依据原生滚动锚定调整滚动位置；这是浏览器默认行为，符合“清空不强制回到顶部”的要求，未做 `overflow-anchor: none` 禁用。
- **外站网站图标**：119 个条目中的外部图标可能因网络或站点因素加载失败，回退机制覆盖（同尺寸首字符 + 钴蓝底）；不影响主任务。

## 9. 自动化测试命令

```sh
bun test                      # 全部 Playwright 测试（116 通过 / 4 跳过）
bun test:visual               # 仅视觉基线截图
bun test:axe                  # 仅 axe 扫描
bun run audit:lighthouse      # Lighthouse 审计
./build.sh                    # 重建 index.html（确定性）
```

跳过项说明：`navigation.visual.spec.mjs` 只在 `desktop-light` 项目执行，其余项目跳过以避免重复截图。