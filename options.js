const DEFAULT_WS_URL = 'ws://127.0.0.1:10044';

// 页面加载时：读取已保存的地址
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ wsUrl: DEFAULT_WS_URL }, (items) => {
    document.getElementById('wsUrl').value = items.wsUrl;
  });
});

// 点击保存时：写入 storage
document.getElementById('save').addEventListener('click', () => {
  const wsUrl = document.getElementById('wsUrl').value.trim();

  // 简单的格式校验
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    alert('请输入有效的 WebSocket 地址 (以 ws:// 或 wss:// 开头)');
    return;
  }

  chrome.storage.local.set({ wsUrl: wsUrl }, () => {
    const status = document.getElementById('status');
    status.textContent = '设置已保存，正在尝试重连...';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});
