# UI/UX 优化验证记录

> 状态：已完成自动化、截图和构建验收
>
> 验证日期：2026-08-17
>
> 依据：`docs/ui-ux-redesign.md` 与 `docs/ui-ux-polish-v2.md`

本文只记录实际结果和未解决风险。验证范围以当前 `config.yaml` 为准：11 个分类、119 个网址。

## 1. 构建与数据完整性

| 检查 | 结果 |
| --- | --- |
| 固定依赖 | `build.sh` 两次执行 `bun install --frozen-lockfile` 均通过，未修改锁文件；devDependencies 全部为精确版本 |
| 正常构建 | `./build.sh` 退出码 0，报告 11 个分类、119 个网址 |
| 确定性构建 | 连续两次 `index.html` SHA-256 均为 `df906e1d5ea4541219da1f1552bfe0cdaa0741a42983e77787b3145d2e379a35` |
| 生成文件同步 | 连续重建不会进一步改变 `index.html`，Pug 源文件与生成结果同步 |
| 内容一致性 | 页面与当前 `config.yaml` 一致：11 个分类、119 个网址，名称、顺序、归属和 URL 保持配置顺序 |
| 离线入口 | `file://` 直接打开可用；Playwright 功能和视觉测试均使用 `file://` |
| 外链安全 | 119 个网址条目均有 `target="_blank"` 与 `rel="noopener noreferrer"` |

构建仍产生 1 条既有提醒：`navigation.groups[0].items[7].url` 的 `password` 查询参数可能包含凭据。该提醒不阻止构建，本次没有借 UI 改造修改该 URL。

### 体积记录

`1 KiB = 1024B`。

| 指标 | 当前约束 | 实测 |
| --- | ---: | ---: |
| 生成 HTML（未压缩） | 120 KiB | 104,012B |
| CSS（未压缩） | 无硬上限 | 22,764B |
| JavaScript（未压缩） | 无硬上限 | 14,416B |
| Lucide 内联 sprite | 20 KiB | 1,505B，6 个唯一 symbol |

CSS 与 JavaScript 不再设置 20 KiB / 12 KiB 硬上限；仍记录未压缩体积，以便发现无意的显著增长。本次保持可读源码，没有为满足旧上限进行压缩或拆分规避。

## 2. 搜索样本

全量测试按当前 `config.yaml` 断言以下固定样本：

| 查询 | 期望 | 实测 |
| --- | ---: | ---: |
| `github` | 10 | 10 |
| `luogu` | 6 | 6 |
| `graphviz` | 2 | 2 |
| `工具` | 38 | 38 |
| `AI` | 7 | 7 |
| `不存在的网址` | 0 | 0 |
| `github 教程` | 0 | 0 |

空查询与纯空白查询恢复 119 个网址和 11 个分类。`ＧＩＴＨＵＢ`、`GITHUB` 与大小写混合查询按 NFKC 得到相同结果；多关键词严格使用 AND 语义并保持配置顺序；恶意查询文本不会形成 HTML 节点或执行脚本。

## 3. 视觉与响应式

`tests/baseline/` 保存浅色 / 深色 × 手机 / 平板 / 桌面 / 超宽桌面的 8 张全页截图。液态玻璃候选图先在 `/tmp/liquid-*.png` 人工检查，确认无重叠、空白画布、横向溢出、过曝或异常换行后，才运行 `bun run test:visual:update`。

| 基线 | 视口 | 已验证结构 |
| --- | --- | --- |
| `phone-{light,dark}.png` | 390 × 844 | 112px 两行 Workbar、48px 分类栏、单列、72px 卡片 |
| `tablet-{light,dark}.png` | 768 × 1024 | 112px Workbar、48px 分类栏、双列、72px 卡片 |
| `desktop-{light,dark}.png` | 1440 × 1000 | 64px Workbar、208px 侧栏、4 列、76px 卡片 |
| `wide-{light,dark}.png` | 1920 × 1080 | 内容宽度不超过 1680px、208px 侧栏、5 列、76px 卡片 |

每个视口还断言 36 × 36px 图标框、无分类/分区装饰图标、无页面级横向滚动、页面背景无渐变。LinkCard 使用主题独立的半透明表面、内侧边缘高光、径向/线性折射层和浅阴影；其他页面区域仍保持实色。14px 背景模糊只在单张卡片 hover 或键盘聚焦时启用，避免 119 个常驻模糊层。桌面品牌与侧栏左边缘对齐，搜索框与目录左边缘对齐。精细指针 hover 使用 700px 透视、上移 3px、缩放 1.01，并根据指针位置动态设置最大 ±9deg 的 `rotateX`、最大 ±5deg 的 `rotateY` 与玻璃高光坐标。触摸设备保留静态玻璃材质但不启用跟随效果，减少动画模式下不发生倾斜、缩放或位移。

桌面浅色/深色 hover、移动端深色、平板浅色和超宽深色截图已人工检查。玻璃高光没有遮挡文字，浅阴影没有造成卡片重叠，触摸布局没有出现悬停残留；临时截图不作为默认视觉基线提交。

8 张液态玻璃基线的组合 SHA-256 为 `0c2a561e124d84a52a3e9819f56945722e021f15c1a1b42ef62eaedb9696d5a3`。更新后执行只读 `bun run test:visual` 通过，基线没有继续变化。

## 4. Lighthouse

`bun run audit:lighthouse` 使用本地 HTTP 服务、Headless Chromium 和 Lighthouse 13.4.1。V2 初始验收结果如下：

| 样本 | Performance | Accessibility | LCP | FCP | CLS | TBT |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 95 | 100 | 2.86s | 1.41s | 0.000 | 0ms |
| 2 | 100 | 100 | 1.39s | 1.36s | 0.000 | 0ms |
| 3 | 100 | 100 | 1.38s | 1.34s | 0.000 | 0ms |

液态玻璃实现后重新采样，并保留优化前后及波动结果：

| 样本 | 实现状态 | Performance | Accessibility | LCP | FCP | CLS | TBT |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 119 张卡片常驻模糊 | 85 | 100 | 4.22s | 1.59s | 0.000 | 0ms |
| 2 | 模糊改为单卡 hover/focus | 88 | 100 | 3.77s | 1.65s | 0.000 | 4ms |
| 3 | 同一优化实现复采 | 100 | 100 | 1.46s | 1.44s | 0.000 | 0ms |
| 4 | 同一优化实现复采 | 99 | 100 | 1.96s | 1.65s | 0.000 | 10ms |

常驻背景模糊已删除，只在当前 hover 或键盘聚焦卡片上启用 14px 模糊。后两次复采达到 Performance / Accessibility 不低于 95 和 LCP 不高于 2.5s 的目标；四次 CLS 均为 0。失败样本仍记录在此，不能用单次最好结果掩盖本机模拟波动。LCP 元素为搜索框占位文字，不是卡片。最新报告文件为 `.lighthouse/report.json`，该临时文件不入库。

## 5. axe 与对比度

`bun run test:axe` 的 5 个项目全部通过：Chromium 桌面/移动 × 浅色/深色，以及 Firefox 桌面。默认状态和搜索过滤状态均无 critical 或 serious 问题。

V2 验收发现浅色当前分类的钴蓝文字与浅蓝背景对比度为 4.47:1，略低于 AA 的 4.5:1。将 `--color-accent-soft` 从 `#e7efff` 微调为 `#e8f0ff` 后，全项目 axe 通过；色相和视觉方向未改变。既有的深色图标回退前景问题也继续由自动化覆盖。

## 6. 交互与故障状态

`tests/navigation.spec.mjs` 覆盖并通过：

- 搜索、清空、零结果、计数同步、安全高亮、NFKC 和多关键词 AND。
- `/`、`Ctrl+K`、`Esc`、`ArrowDown`、原生 `Tab`/`Shift+Tab` 与完整键盘流程。
- 首次查询滚动、IME composition、分类点击、scrollspy、过滤后观察目标重建。
- 页面底部的 scrollspy 统一以最后一个可见分类为准，避免 Firefox 中滚动监听与 IntersectionObserver 竞争。
- 移动分类栏绝对滚动定位、双侧渐隐和活动项自动滚入可见区域。
- 图标加载失败和缺失配置的同尺寸回退，不产生布局偏移。
- 系统主题、主题持久化、`localStorage` 读写失败和减少动画偏好。
- 返回顶部阈值、键盘触发、320px 重排和 Chromium 200% 缩放。
- V2 两位分类编号、`LINKS` 元数据、6-symbol sprite、36px 图标框和灰色外链图标。
- 深色卡片/背景与卡片/边框层级，以及指针在左上、中心、右下时的倾斜方向、`rotateX` ±9deg 和 `rotateY` ±5deg 上限。
- 卡片液态玻璃的径向高光和默认浅阴影、单卡 hover/focus 背景模糊，以及高光坐标随指针从左上、中心移动到右下。
- 卡片 3D hover 的 700px 透视、上移 3px、缩放 1.01、指针离开统一清理四个变量，以及减少动画回退。

## 7. 浏览器范围

| 浏览器 | 状态 |
| --- | --- |
| Chromium（Chrome/Edge 同引擎） | 桌面 + 移动、浅色 + 深色全量通过 |
| Firefox | 桌面核心交互与 axe 通过；Firefox 不支持当前 CDP 缩放模拟，因此 200% 缩放断言只在 Chromium 执行 |
| WebKit（Safari 引擎） | 未运行：本机缺少 `libicudata.so.74`；需在 macOS 或依赖匹配的机器补做 |

## 8. 未解决风险与人工项

- 本地 Lighthouse 模拟节流有明显波动：本轮 LCP 为 2.86s / 1.39s / 1.38s。CI 或发布环境应持续采样，不应以单次结果判断趋势。
- Lighthouse 无真实交互样本时不提供 INP；需使用 DevTools Performance 交互 trace 单独验证。
- VoiceOver + Safari 与 NVDA + Firefox 的真实朗读尚未在本机执行。
- 10 项首次使用任务与 5 秒第一印象测试需要真人参与，自动化不能替代。
- WebKit 因系统运行库不匹配未覆盖。
- 119 个外站图标仍可能因网络或站点策略加载失败；同尺寸首字符回退已经覆盖。

## 9. 最终命令

```sh
bun run test                  # 139 passed / 11 skipped
bun run test:visual           # 1 passed / 4 skipped，遍历并比较 8 张基线
bun run test:visual:update    # 仅在人工检查候选图后执行
bun run test:axe              # 5 passed
bun run audit:lighthouse      # 本轮连续采样 3 次
./build.sh                    # 连续两次 SHA-256 一致
git diff --check              # 通过
```

11 个跳过项由项目范围决定：移动分类栏定位测试在 3 个非移动项目跳过；视觉用例只在 `desktop-light` 项目运行一次并在内部遍历 8 个组合，其余 4 个项目跳过；深色 hover 矩阵测试只在 `desktop-dark` 运行，其余 4 个项目跳过。
