/**
 * 配置项
 */
const CONFIG = {
  defaultWsUrl: 'ws://127.0.0.1:10044',
  reconnectInterval: 1000, // 1秒重连
  heartbeatInterval: 25000, // 25秒心跳
  msgExpiry: 10000 // 消息有效期
};

/**
 * WebSocket 管理器
 */
const wsManager = {
  ws: null,
  url: CONFIG.defaultWsUrl,
  lockReconnect: false,

  async init() {
    const data = await chrome.storage.local.get('wsUrl');
    this.url = data.wsUrl || CONFIG.defaultWsUrl;

    // 监听配置变化
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.wsUrl) {
        this.url = changes.wsUrl.newValue;
        this.reconnect();
      }
    });

    this.connect();
  },

  connect() {
    if (this.ws || this.lockReconnect) return;
    this.lockReconnect = true;

    console.log(`[WS] 尝试连接: ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[WS] 已连接');
      this.lockReconnect = false;
      this.send({ type: 'hello', client: 'chrome-extension' });
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;
        if (data.url && data.code) {
          console.log(`[WS] 获取到题目: ${data.url}`);
          handleOJ(data);
        }
      } catch (err) {
        console.error('[WS] 消息解析失败', err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.lockReconnect = false;
      console.warn(`[WS] 断开，${CONFIG.reconnectInterval}ms 后重连...`);
      setTimeout(() => this.connect(), CONFIG.reconnectInterval);
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  },

  reconnect() {
    if (this.ws) {
      this.ws.onclose = null; // 屏蔽自带重连
      this.ws.close();
      this.ws = null;
    }
    this.lockReconnect = false;
    this.connect();
  },

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
};

/**
 * 消息队列与注入逻辑
 */
const messageQueue = new Map();

async function injectAndSend(tabId, payload) {
  try {
    // 确保 content_script 已注入 (MV3 推荐做法)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content_script.js']
    }).catch(() => { /* 已注入则会忽略 */ });

    // 发送消息
    chrome.tabs.sendMessage(tabId, payload, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[Queue] 发送失败，重试中...');
      }
    });
  } catch (err) {
    console.error('[Queue] 注入失败', err);
  }
}

/**
 * OJ 分发逻辑 (保留核心逻辑并优化)
 */
function handleOJ({ url, code, language = 'text', problem }) {
  const tasks = [];

  // 1. 洛谷
  if (url.includes('luogu.com.cn')) {
    tasks.push({ targetUrl: url + '#submit', payload: { url, code, language } });
  }
  // 2. Codeforces
  else if (url.includes('codeforces.com')) {
    let submitUrl = '', problemId = '';
    const contestMatch = url.match(/\/contest\/(\d+)\/problem\/([A-Z0-9]+)/);
    const psetMatch = url.match(/\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/);

    if (contestMatch) {
      submitUrl = `https://codeforces.com/contest/${contestMatch[1]}/submit`;
      problemId = contestMatch[2];
    } else if (psetMatch) {
      submitUrl = `https://codeforces.com/problemset/submit`;
      problemId = psetMatch[1] + psetMatch[2];
    }

    if (submitUrl) {
      tasks.push({
        targetUrl: submitUrl,
        payload: { url: submitUrl, code: { source: code, problem: problem || problemId, language }, language }
      });
    }
  }
  // 3. 牛客
  else if (url.includes('nowcoder.com')) {
    tasks.push({ targetUrl: url, payload: { url, code, language } });
  }

  // 执行跳转与发送
  tasks.forEach(task => {
    chrome.tabs.create({ url: task.targetUrl }, (tab) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // 延迟一点确保 DOM 准备就绪
          setTimeout(() => injectAndSend(tab.id, task.payload), 500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

/**
 * --- 核心保活机制 (Manifest V3) ---
 * 解决 Service Worker 自动休眠问题
 */
function keepAlive() {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // 1. 维持 WS 连接
    if (!wsManager.ws || wsManager.ws.readyState !== WebSocket.OPEN) {
      wsManager.connect();
    } else {
      wsManager.send({ type: 'ping' });
    }
    // 2. 产生一次浅层 API 调用，重置 SW 的 30 秒休眠倒计时
    chrome.runtime.getPlatformInfo(() => { });
  }
});

// 启动
wsManager.init();
keepAlive();

// 监听安装/启动事件
chrome.runtime.onStartup.addListener(() => wsManager.connect());
chrome.runtime.onInstalled.addListener(() => wsManager.connect());
