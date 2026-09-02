<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Tideline" />
</p>

<h1 align="center">潮谱 Tideline</h1>

<p align="center">
  <strong>浏览器里的 MIDI 钢琴卷帘工作室</strong><br />
  <em>A quiet MIDI piano-roll studio in the browser</em>
</p>

<p align="center">
  <a href="https://tideline-sooty.vercel.app"><img src="https://img.shields.io/badge/demo-live-8EB8B4?style=flat-square" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/node-22+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 22" />
  <img src="https://img.shields.io/badge/typescript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/copyright-MT-111111?style=flat-square" alt="Copyright MT" />
</p>

<p align="center">
  <a href="https://tideline-sooty.vercel.app"><strong>打开演示 · Open Demo →</strong></a>
</p>

---

## 演示 Demo

在线体验，无需安装：

**[https://tideline-sooty.vercel.app](https://tideline-sooty.vercel.app)**

第一次按下播放时，浏览器会请求音频权限。工程保存在本机浏览器，不上传云端。

Try it in the browser with no install. The first time you press play, the browser will ask for audio permission. Projects stay on this device and never leave the browser.

---

## 关于 About

潮谱是一台写在网页里的 MIDI 工作室。你可以在钢琴卷帘上绘制音符、编排多轨、用合成器即时试听，并导入或导出标准 `.mid` 文件。没有账号，没有数据库——打开就能写。

Tideline is a MIDI studio that lives in the web. Draw notes on a piano roll, arrange multiple tracks, audition with a built-in synth, and import or export standard `.mid` files. No accounts, no database — open it and write.

---

## 功能 Features

| 中文 | English |
| --- | --- |
| 钢琴卷帘：绘制、选择、擦除、拉伸音符 | Piano roll: draw, select, erase, resize notes |
| 多轨编排，静音 / 独奏 | Multi-track arrange with mute and solo |
| 三角钢琴、电钢、暖垫、贝斯、鼓组等音色 | Piano, e-piano, pad, bass, drums and more |
| 力度条、量化网格、循环区间、节拍器 | Velocity lane, snap grid, loop region, metronome |
| 电脑键盘演奏（A–L），Z / X 换八度 | Computer-keyboard input; Z / X change octave |
| 导入 / 导出标准 MIDI（GM） | Import / export standard MIDI (GM) |
| 工程库保存在浏览器本地 | Project library in local browser storage |
| 撤销 / 重做，复制粘贴 | Undo / redo, copy and paste |

---

## 快捷键 Keyboard

| 按键 Key | 作用 Action |
| --- | --- |
| `Space` | 播放 / 暂停 · Play / pause |
| `Home` | 回到开头并停止 · Return to start |
| `1` / `2` / `3` | 绘制 / 选择 / 橡皮 · Draw / select / erase |
| `Delete` | 删除选中音符 · Delete selected notes |
| `Ctrl` `Z` / `Y` | 撤销 / 重做 · Undo / redo |
| `Ctrl` `A` / `D` | 全选 / 复制一份 · Select all / duplicate |
| `Ctrl` `C` / `V` | 复制 / 粘贴 · Copy / paste |
| `Ctrl` `Q` | 量化到当前网格 · Quantize to grid |
| `Ctrl` `S` | 保存工程 · Save project |
| `←` `→` `↑` `↓` | 移动选中音符 · Nudge selected notes |
| `L` / `M` / `R` | 循环 / 节拍器 / 录音 · Loop / metronome / record |
| `Z` / `X` | 键盘八度 · Keyboard octave |
| `A` `W` `S` `D` … | 电脑键盘演奏 · Play with computer keys |
| 滚轮 · Scroll | 平移；`Ctrl` 缩放 · Pan; Ctrl to zoom |
| `Alt` + 拖拽 | 抓手平移卷帘 · Hand-pan the roll |

---

## 快速开始 Getting Started

需要 [Node.js 22](https://nodejs.org/) 或更高版本。

Requires [Node.js 22](https://nodejs.org/) or later.

```bash
git clone https://github.com/Cunhe/tideline.git
cd tideline
npm install
npm run dev
```

浏览器打开终端里提示的本地地址。第一次点播放时，允许音频即可。

Open the local URL printed in the terminal. Allow audio the first time you press play.

```bash
npm run build      # 生产构建 · production build
npm run typecheck  # 类型检查 · type check
```

---

## 技术栈 Stack

| 层 Layer | 选用 Choice |
| --- | --- |
| 界面 UI | React 19, TanStack Start, Tailwind CSS |
| 状态 State | Zustand（含撤销栈 · with undo stack） |
| 音频 Audio | Web Audio API, Tone.js 调度 |
| MIDI | `@tonejs/midi` |
| 构建 Build | Vite, Nitro（可部署到 Vercel） |

全程在客户端运行。无需环境变量，无需数据库。

The app is fully client-side. No environment variables. No database.

---

## 部署 Deploy

已上线演示：[tideline-sooty.vercel.app](https://tideline-sooty.vercel.app)

Live demo: [tideline-sooty.vercel.app](https://tideline-sooty.vercel.app)

自行部署到 [Vercel](https://vercel.com)：用 GitHub 导入本仓库即可。构建命令为 `npm run build`。不需要配置环境变量或数据库。

To deploy your own copy on [Vercel](https://vercel.com), import this repository from GitHub. Build command is `npm run build`. No env vars or database required.

也可部署到任何能跑 Node 22 的主机。建议使用 HTTPS，否则部分浏览器会拦截音频与 MIDI 设备。

It also runs on any Node 22 host. HTTPS is recommended — some browsers block audio and MIDI on insecure origins.

---

## 版权 Copyright

**Copyright © 2026 MT. All rights reserved.**

版权所有 © 2026 **MT**。保留所有权利。

未经版权持有人书面许可，不得将本软件及其源码作为独立产品复制、修改、分发或用于商业用途。

This software and its source code may not be copied, modified, redistributed, or used as a standalone product for commercial purposes without prior written permission from the copyright holder.

---

<p align="center">
  潮谱 Tideline · made by MT
</p>
