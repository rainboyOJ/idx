# Third-Party Licenses

本项目的生成页面内联了以下第三方图标资源。图标数据来自锁定的 npm 依赖，构建期写入本地 HTML，运行时不从 CDN 或图标 API 加载。

## Lucide Icons

- 来源: <https://lucide.dev>
- npm 包: `@iconify-json/lucide@1.2.123`（Iconify JSON 格式）
- 许可: ISC（完整文本如下）

Lucide 的图标数据通过构建脚本（`scripts/build.mjs` 中的白名单）嵌入生成的 `index.html`。白名单固定为以下 17 个图标：

`globe`, `list-checks`, `users`, `square-code`, `book-open`, `notebook-pen`, `wrench`, `archive`, `bot`, `package-open`, `network`, `search`, `x`, `sun`, `moon`, `arrow-up`, `external-link`

### ISC License

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather-derived icons (MIT)

Lucide 许可文本中声明，部分图标由 Feather 项目派生（本页面使用的 `external-link`、`moon`、`search`、`x` 与 `arrow-up` 属于该清单）。Feather 使用 MIT 许可：

```
The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
