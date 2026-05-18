# 科技选题雷达

面向科技/数码内容创作者的选题监测后台。第一阶段聚焦雷达闭环：配置信息源、定时监测视频、去重入库、翻译标题、生成中文摘要、初步评分、卡片展示、状态池管理，并预留研究任务和飞书推送结构。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- yt-dlp
- Minimax API

## 本地配置

复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

配置 `.env`：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/techv?schema=public"
MINIMAX_API_KEY="你的 Minimax API Key"
MINIMAX_GROUP_ID=""
YTDLP_COOKIES_BROWSER="edge"
```

`YTDLP_COOKIES_BROWSER` 可填 `edge`、`chrome`、`firefox`。用于 Instagram 等平台读取本机浏览器登录态；不需要时留空。

## 数据库

安装 PostgreSQL 后，创建数据库 `techv`，然后运行：

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

## 开发

```powershell
npm.cmd run dev
```

打开：

```text
http://localhost:3000
```

## 监测任务

本地 Windows 定时任务可以调用：

```powershell
npm.cmd run monitor
```

当前规则：

- 普通账号：北京时间 08:00
- 重要账号：北京时间 00:00 / 04:00 / 08:00 / 12:00 / 16:00 / 20:00

## 第一阶段平台边界

- YouTube：主支持，使用 yt-dlp 抓频道/视频信息
- Instagram：有限支持，依赖公开内容或浏览器 cookies
- TikTok：仅支持手动提交视频链接
- Twitter/X：下一阶段

## 已看规则

点击卡片的“原始链接”按钮后，系统会把内容标记为已看。已看但未标记的内容显示为灰色卡片，提醒继续选择“备选 / 已做 / 待定 / 不做”。7 天以前的内容默认折叠。
