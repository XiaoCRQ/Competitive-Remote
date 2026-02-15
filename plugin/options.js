document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('wsUrl');
  const saveBtn = document.getElementById('saveBtn');

  // 加载已保存的值
  chrome.storage.local.get({ wsUrl: 'ws://127.0.0.1:10044' }, (data) => {
    input.value = data.wsUrl;
  });

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) return alert('请输入 WebSocket 地址');

    chrome.storage.local.set({ wsUrl: url }, () => {
      alert('保存成功！');
    });
  });
});
