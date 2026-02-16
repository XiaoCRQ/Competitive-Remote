// ============================================================
// background.js
// WebSocket Manager + 消息队列 + OJ分发（支持 code + language + problem）
// ============================================================

const wsManager = {
  ws: null,
  wsUrl: 'ws://127.0.0.1:10044',
  connecting: false,
  reconnectTimer: null,
  heartbeatTimer: null,
  lastPongTime: 0,

  // ---------- 初始化 ----------
  init() {
    // 从本地存储读取 wsUrl
    chrome.storage.local.get({ wsUrl: this.wsUrl }, (data) => {
      this.wsUrl = data.wsUrl;
      this.connect();
    });

    // 监听 wsUrl 改变
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.wsUrl) {
        this.wsUrl = changes.wsUrl.newValue;
        this.reconnect(true);
      }
    });

    // 定时器保活
    this.initKeepAliveAlarm();

    // 页面载入完成时尝试连接（可探测服务器已启动）
    chrome.runtime.onStartup.addListener(() => this.connect());
    chrome.runtime.onInstalled.addListener(() => this.connect());
  },

  // ---------- 连接 ----------
  connect() {
    if (this.ws || this.connecting) return;

    this.connecting = true;
    console.log('[wsManager] Connecting →', this.wsUrl);

    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log('[wsManager] Connected');
      this.connecting = false;
      this.lastPongTime = Date.now();
      this.startHeartbeat();
    };

    ws.onmessage = (event) => this.handleMessage(event.data);

    ws.onerror = (err) => {
      console.error('[wsManager] Error', err);
    };

    ws.onclose = () => {
      console.warn('[wsManager] Closed → retry in 1s');
      this.stopHeartbeat();
      this.ws = null;
      this.connecting = false;
      this.scheduleReconnect();
    };
  },

  // ---------- 收消息 ----------
  handleMessage(raw) {
    let data;
    try { data = JSON.parse(raw); }
    catch {
      console.error('[wsManager] JSON parse failed:', raw);
      return;
    }

    // 心跳 pong
    if (data.type === 'pong') {
      this.lastPongTime = Date.now();
      return;
    }

    const { url, code, language, problem } = data;
    if (!url || !code) return console.warn('[wsManager] Invalid payload', data);

    handleOJ(url, code, language || 'text', problem);
  },

  // ---------- 心跳 ----------
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    console.log('[wsManager] Heartbeat started');
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      this.ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));

      // pong 超时
      if (Date.now() - this.lastPongTime > 60000) {
        console.warn('[wsManager] Pong timeout → reconnect');
        this.reconnect(true);
      }
    }, 30000);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[wsManager] Heartbeat stopped');
    }
  },

  // ---------- 重连 ----------
  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  },

  reconnect(force = false) {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.connecting = false;
    this.connect();
  },

  // ---------- 发送 ----------
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  },

  // ---------- Alarm 保活 ----------
  initKeepAliveAlarm() {
    chrome.alarms.create('ws_keepalive', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'ws_keepalive') {
        if (!this.ws) {
          console.log('[Alarm] WS not connected → connect');
          this.connect();
        }
      }
    });
  }
};

// ============================================================
// 消息队列
// ============================================================
const messageQueue = new Map();

function enqueueMessage(tabId, msg) {
  if (!messageQueue.has(tabId)) messageQueue.set(tabId, []);
  messageQueue.get(tabId).push({ msg, timestamp: Date.now() });
}

function flushQueue(tabId) {
  const queue = messageQueue.get(tabId);
  if (!queue || queue.length === 0) return;

  const validMsgs = queue.filter(item => Date.now() - item.timestamp <= 10000);
  if (validMsgs.length === 0) { messageQueue.delete(tabId); return; }

  chrome.scripting.executeScript(
    { target: { tabId }, files: ['content_script.js'] },
    () => {
      validMsgs.forEach(item => {
        chrome.tabs.sendMessage(tabId, item.msg, () => {
          if (chrome.runtime.lastError) console.warn('[Queue] send failed:', chrome.runtime.lastError.message);
        });
      });
    }
  );

  messageQueue.delete(tabId);
}

// ============================================================
// OJ 分发逻辑
// ============================================================
function handleOJ(url, code, language, problem) {
  const submitInfo = [];

  if (url.includes('luogu.com.cn')) {
    submitInfo.push({ url: url + '#submit', code, language });
  } else if (url.includes('codeforces.com')) {
    let submitUrl = '', problemId = '';

    if (url.includes('/contest/')) {
      const match = url.match(/\/contest\/(\d+)\/problem\/([A-Z0-9]+)/);
      if (match) { submitUrl = `https://codeforces.com/contest/${match[1]}/submit`; problemId = match[2]; }
    } else if (url.includes('/problemset/')) {
      const match = url.match(/\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/);
      if (match) { submitUrl = `https://codeforces.com/problemset/submit`; problemId = match[1] + match[2]; }
    }

    if (submitUrl && problemId) submitInfo.push({ url: submitUrl, code: { source: code, problem: problem || problemId, language }, language });
  } else if (url.includes('nowcoder.com')) {
    submitInfo.push({ url, code, language });
  } else {
    console.log('[OJ] Default action:', { url, code, language, problem });
  }

  submitInfo.forEach(info => openTabAndSendMessage(info.url, info.code, info.language));
}

// ============================================================
// 打开标签页并发送消息
// ============================================================
function openTabAndSendMessage(url, code, language) {
  chrome.tabs.create({ url }, (tab) => {
    const tabId = tab.id;
    const payload = { url, code, language };

    function trySend() { enqueueMessage(tabId, payload); flushQueue(tabId); }

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        trySend();
        chrome.tabs.onUpdated.removeListener(listener);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(trySend, 800); // 防止 content_script 延迟注入
  });
}

// ============================================================
// 启动
// ============================================================
wsManager.init();

