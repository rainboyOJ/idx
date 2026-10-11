# Rainboy 导航

一个由 YAML 配置和 Pug 模板生成的静态网址导航。生成后的页面无框架、无后端依赖，可以直接打开，也可以部署到任意静态文件服务器。

## 环境要求

- [Bun](https://bun.sh/) 1.3.14

项目使用 `bun.lock` 固定 Pug 和 YAML 解析器版本。

## 修改内容

所有站点信息和导航数据都在 `config.yaml` 中：

```yaml
site:
  title: Rainboy 导航
  description: 学习、竞赛与常用工具
  metaDescription: Rainboy 常用网址导航

navigation:
  updatedAt: '2026-08-16'
  groups:
    - id: '1'
      title: 网站
      description: 可选的分类简介，显示在分类标题下方
      items:
        - title: ROJ
          url: https://roj.ac.cn
          description: roj
          icon: assets/icons/example.png
```

分类 `id` 用于页面锚点，必须唯一。分类数、网址数和每组数量会在构建时自动计算。

## 构建页面

```bash
./build.sh
```

脚本会按照 `bun.lock` 安装依赖、校验配置和图标路径，然后通过 `index.pug` 生成格式化的 `index.html`。不要直接修改 `index.html`。

依赖已经安装时，也可以只运行页面构建：

```bash
bun run build
```

配置缺少必要字段、分类 ID 重复、URL 无效或本地图标不存在时，构建会失败。URL 查询参数疑似包含密码或 token 时，构建会输出提醒，但不会中断。

## 本地预览

可以直接在浏览器中打开 `index.html`。也可以启动静态文件服务器：

```bash
python3 -m http.server 8080
```

然后访问 `http://127.0.0.1:8080/`。

## Nginx

```nginx
server {
    listen 80;
    server_name nav.example.com;
    root /var/www/idx_roj_ac_cn;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(?:css|js|svg|png|jpg|jpeg|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

部署时同步 `index.html`、`app.js`、`styles.css`、`favicon.svg` 和 `assets/` 即可。

## 公开部署提醒

静态页面中的 URL 对访问者完全可见。当前配置中有一个 URL 带有 `password` 查询参数；公开部署前应确认该凭据可以公开。
