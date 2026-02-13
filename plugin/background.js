const wsUrl = 'ws://127.0.0.1:2333';
let ws = null;

// 创建 WebSocket 并自动重连
function createWebSocket(url) {
  ws = new WebSocket(url);

  ws.onopen = () => console.log('WebSocket connected to', url);

  ws.onclose = () => {
    console.log('WebSocket disconnected, retry in 1s...');
    ws = null;
    setTimeout(() => createWebSocket(url), 1000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
    ws.close();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const { url, code } = data;
      console.log('Received JSON:', data);

      if (url.includes('luogu.com.cn')) {
        openTabAndSendMessage(url + '#submit', code);
      } else if (url.includes('codeforces.com')) {
        // Codeforces 特殊处理
        let submitUrl = '';
        let problemId = '';

        if (url.includes('/contest/')) {
          // 例：https://codeforces.com/contest/2197/problem/A
          const match = url.match(/\/contest\/(\d+)\/problem\/([A-Z])/);
          if (match) {
            const contestId = match[1];
            const problemLetter = match[2];
            submitUrl = `https://codeforces.com/contest/${contestId}/submit`;
            problemId = problemLetter;
          }
        } else if (url.includes('/problemset/')) {
          // 例：https://codeforces.com/problemset/problem/4/A
          const match = url.match(/\/problemset\/problem\/(\d+)\/([A-Z])/);
          if (match) {
            const problemNumber = match[1];
            const problemLetter = match[2];
            submitUrl = `https://codeforces.com/problemset/submit`;
            problemId = problemNumber + problemLetter;
          }
        }

        // 传入 Codeforces content script
        if (submitUrl && problemId) {
          openTabAndSendMessage(submitUrl, { code, problem: problemId });
        } else {
          console.warn('Could not parse Codeforces URL:', url);
        }

      } else if (url.includes('nowcoder.com')) {
        openTabAndSendMessage(url, code);
      } else {
        console.log('Default action:', data);
      }
    } catch (err) {
      console.error('Failed to parse message:', event.data, err);
    }
  };

}

// 打开新标签页，并在页面加载完成后发送消息
function openTabAndSendMessage(url, code) {
  chrome.tabs.create({ url }, (tab) => {
    const tabId = tab.id;

    // 页面可能还没加载完，所以用 onUpdated 监听
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, { url, code });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// 启动 WebSocket
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    console.log('Trying to connect WebSocket...');
    createWebSocket(wsUrl);
  }
}, 1000);

