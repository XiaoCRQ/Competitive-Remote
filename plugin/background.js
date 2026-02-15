const wsManager = {
  ws: null,
  wsUrl: 'ws://127.0.0.1:10044',
  connecting: false,
  reconnectTimer: null,

  init() {
    // 从 storage 读取用户配置
    chrome.storage.local.get({ wsUrl: this.wsUrl }, (data) => {
      this.wsUrl = data.wsUrl;
      this.connect();
    });

    // 动态监听 wsUrl 改变
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.wsUrl) {
        this.wsUrl = changes.wsUrl.newValue;
        this.reconnect(true);
      }
    });
  },

  connect() {
    if (this.ws || this.connecting) return; // 已经有连接或正在连接
    this.connecting = true;

    console.log('[wsManager] Connecting to', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('[wsManager] WebSocket connected', this.wsUrl);
      this.connecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received JSON:', data);
        handleOJ(data.url, data.code);
      } catch (err) {
        console.error('[wsManager] Failed to parse message:', event.data, err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[wsManager] WebSocket error', err);
      // 错误会触发 onclose，不用重复处理
    };

    this.ws.onclose = () => {
      console.log('[wsManager] WebSocket disconnected, retrying in 1s...');
      this.ws = null;
      this.connecting = false;
      this.scheduleReconnect();
    };
  },

  scheduleReconnect() {
    if (this.reconnectTimer) return; // 已经有重连计划
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000); // 固定 1 秒重连
  },

  reconnect(force = false) {
    // 强制断开当前连接并立即连接新地址
    if (this.ws) {
      this.ws.onclose = null; // 防止触发旧的 reconnect
      this.ws.close();
      this.ws = null;
    }
    this.connecting = false;
    this.connect();
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[wsManager] Cannot send, WebSocket not open');
    }
  },
};

// ---------------- OJ 分发逻辑 ----------------

function handleOJ(url, code) {
  if (url.includes('luogu.com.cn')) {
    openTabAndSendMessage(url + '#submit', code);
  } else if (url.includes('codeforces.com')) {
    let submitUrl = '';
    let problemId = '';
    if (url.includes('/contest/')) {
      const match = url.match(/\/contest\/(\d+)\/problem\/([A-Z])/);
      if (match) {
        const contestId = match[1];
        const problemLetter = match[2];
        submitUrl = `https://codeforces.com/contest/${contestId}/submit`;
        problemId = problemLetter;
      }
    } else if (url.includes('/problemset/')) {
      const match = url.match(/\/problemset\/problem\/(\d+)\/([A-Z])/);
      if (match) {
        const problemNumber = match[1];
        const problemLetter = match[2];
        submitUrl = `https://codeforces.com/problemset/submit`;
        problemId = problemNumber + problemLetter;
      }
    }
    if (submitUrl && problemId) openTabAndSendMessage(submitUrl, { code, problem: problemId });
    else console.warn('Could not parse Codeforces URL:', url);
  } else if (url.includes('nowcoder.com')) {
    openTabAndSendMessage(url, code);
  } else {
    console.log('Default action:', { url, code });
  }
}

function openTabAndSendMessage(url, code) {
  chrome.tabs.create({ url }, (tab) => {
    const tabId = tab.id;

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, { url, code });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ---------------- 初始化 ----------------
wsManager.init();

