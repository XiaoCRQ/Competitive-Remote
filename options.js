const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = '10044';

// 页面加载时：读取已保存的地址和端口
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ host: DEFAULT_HOST, port: DEFAULT_PORT }, (items) => {
    document.getElementById('host').value = items.host;
    document.getElementById('port').value = items.port;
  });
});

// 点击保存时：写入 storage
document.getElementById('save').addEventListener('click', () => {
  const host = document.getElementById('host').value.trim() || DEFAULT_HOST;
  const port = document.getElementById('port').value.trim() || DEFAULT_PORT;

  // 简单的格式校验：清理用户可能误填的 ws:// 前缀
  const cleanHost = host.replace(/^wss?:\/\//, '');

  chrome.storage.local.set({ host: cleanHost, port: port }, () => {
    const status = document.getElementById('status');
    status.textContent = '设置已保存，正在尝试重连...';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});
