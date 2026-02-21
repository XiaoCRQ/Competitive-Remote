# Faster-OJ

**Faster-OJ** 是一款专为算法竞赛（Competitive Programming）设计的自动化提交工具。它通过 WebSocket 协议将本地开发环境（如 VSCode, Vim, 或本地脚本）与浏览器无缝连接，实现代码的“一键闪送”提交。

## 🚀 工作流程

1. **启动服务端**：在本地运行开启 WebSocket 服务（默认 `ws://127.0.0.1:10044`）的脚本或工具。
2. **自动连接**：本插件启动后会自动维持与本地服务器的连接。
3. **发送任务**：向服务器推送包含以下格式的 JSON 数据：

```json
{
  "url": "https://www.luogu.com.cn/problem/P1001",
  "code": "/* Your Code Here */",
  "language": "cpp",
}

```

1. **自动提交**：插件接收数据后，自动识别 OJ 平台，开启新标签页并完成**代码填充、语言选择、点击提交**。

## 🛠️ 核心特性

* **实时响应**：毫秒级重连机制，确保 WebSocket 始终可用。
* **智能分发**：根据 URL 自动匹配不同的 OJ 提交逻辑。
* **零手动操作**：自动处理页面跳转、代码注入与语言配置。
* **轻量保活**：基于 Manifest V3 的后台保活机制，防止 Service Worker 意外休眠。

## 📊 OJ 平台适配矩阵

| 平台 |  自动选语言 | 自动提交 |
| --- |  --- | --- |
| **洛谷 (Luogu)** |  ✅ | ✅ |
| **Codeforces** |  ✅ | ✅ |
| **牛客网 (Nowcoder)** |  ✅ | ✅ |
| ... |    |  |  

## 📦 安装与构建

* [Releases](https://github.com/XiaoCRQ/Faster-OJ/releases) 处下载最新版本安装至浏览器即可

## 🖥️ 配套插件

* [Faster-OJ.nvim](https://github.com/XiaoCRQ/Faster-OJ.nvim)

## 📜 开源协议

本项目采用 [GNU GPL v3](https://www.google.com/search?q=https://www.gnu.org/licenses/gpl-3.0) 协议。
