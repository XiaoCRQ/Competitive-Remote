const WebSocket = require("ws");

// 创建 WebSocket 服务器（普通 WS，不加密）
const wss = new WebSocket.Server({ port: 2333, host: "127.0.0.1" });

wss.on("connection", (ws, req) => {
  console.log("客户端已连接:", req.socket.remoteAddress);

  // 接收到客户端消息时触发
  ws.on("message", (message) => {
    console.log("收到数据:", message.toString());

    let data;
    try {
      data = JSON.parse(message.toString());
      console.log("解析后的 JSON:", data);
    } catch (err) {
      console.error("不是合法 JSON:", err);
      return;
    }

    // 广播给所有客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("error", (err) => console.error("WebSocket 错误:", err));
});

console.log("ws://127.0.0.1:2333 已启动");

