# 潮谱 Tideline

浏览器里的 MIDI 钢琴卷帘工作室。多轨编排、实时合成器试听、导入导出标准 `.mid` 文件。工程保存在本机浏览器，不需要账号和数据库。

## 本地运行

需要 [Node.js 22](https://nodejs.org/)。

```bash
npm install
npm run dev
```

浏览器打开终端里提示的本地地址。第一次点播放时，浏览器会向你要音频权限。

```bash
npm run build      # 生产构建
npm run typecheck  # 类型检查
```

## 部署到 Vercel

1. 把本仓库推到 GitHub
2. 在 [Vercel](https://vercel.com) 用 GitHub 导入这个仓库
3. 不用配环境变量、不用数据库

构建命令是 `npm run build`，框架是 TanStack Start（Vite + Nitro / Vercel）。

也可以部署到任何能跑 Node 22 的主机。建议使用 HTTPS，否则部分浏览器会拦截音频和 MIDI 设备。

## 功能

- 钢琴卷帘：绘制、选择、擦除、拉伸音符
- 多轨：钢琴 / 铺底 / 贝斯 / 鼓，静音与独奏
- 力度条、量化、循环区间、节拍器
- 电脑键盘输入（A–L），Z / X 换八度，空格播放
- 导入 / 导出标准 MIDI
- 工程库（浏览器本地）

## 许可

源码由作者保留。未另作声明前，请勿作为独立产品再分发。
