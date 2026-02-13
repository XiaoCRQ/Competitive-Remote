chrome.runtime.onMessage.addListener((msg) => {
  const { url, code } = msg;
  if (!url) return;

  console.log('Content script received:', msg);

  if (url.includes('luogu.com.cn')) handleLuogu(code);
  else if (url.includes('codeforces.com')) handleCodeforce(code);
  else if (url.includes('nowcoder.com')) handleNowcoder(code);
  else console.log('Default action:', msg);
});


function handleLuogu(code) {
  console.log('Executing Luogu handler');

  // 等待页面渲染完成并插入代码
  const editorSelector = 'div.cm-content.cm-lineWrapping[contenteditable="true"]';
  const submitBtnSelector = 'button.solid.lform-size-middle[type="button"][style*="margin-top: 1em"]';

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver(() => {
    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor) {
      editor.textContent = code;
      console.log('Code inserted into editor.');
    }

    if (submitBtn && editor) {
      submitBtn.click();
      console.log('Clicked submit button.');
      observer.disconnect(); // 完成操作后停止观察
    }
  });

  // 监听 body 下的所有变化
  const body = document.querySelector('body');
  if (body) {
    observer.observe(body, { childList: true, subtree: true });
  } else {
    console.error('Body not found!');
  }
}

function handleNowcoder(code) {
  const scriptContent = `
    (function() {
      // 找到页面上的 CodeMirror 实例
      const cmContainers = document.querySelectorAll('.CodeMirror');
      if (!cmContainers.length) return;

      // 取第一个 CodeMirror 实例
      const cm = cmContainers[0].CodeMirror || cmContainers[0].nextSibling.CodeMirror;
      if (cm) {
        cm.setValue(\`${code.replace(/`/g, '\\`')}\`);
        console.log('Code inserted via page CodeMirror API');
      }

      const submitBtn = document.querySelector('button.btn-submit');
      if (submitBtn) submitBtn.click();
      console.log('Clicked "保存并提交" button');
    })();
  `;

  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function handleCodeforce(payload) {
  console.log('Executing Codeforces handler');

  const { code, problem } = payload;

  /* ---------------- 工具：等待元素 ---------------- */
  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const interval = 200;
      let elapsed = 0;

      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
        }

        elapsed += interval;
        if (elapsed >= timeout) {
          clearInterval(timer);
          reject(`Timeout waiting for ${selector}`);
        }
      }, interval);
    });
  }

  (async () => {
    try {
      /* ---------------- 1️⃣ 选择题号 ---------------- */

      let problemSelected = false;

      // select 模式
      const select = document.querySelector(
        'select[name="submittedProblemIndex"]'
      );

      if (select) {
        const option = select.querySelector(
          `option[value="${problem}"]`
        );

        if (option) {
          select.value = problem;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          problemSelected = true;
          console.log('Problem selected via select:', problem);
        }
      }

      // input 模式
      if (!problemSelected) {
        const input = document.querySelector(
          'input[name="submittedProblemCode"]'
        );

        if (input) {
          input.value = problem;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          problemSelected = true;
          console.log('Problem filled via input:', problem);
        }
      }

      if (!problemSelected) {
        console.warn('Problem selector not found');
      }

      /* ---------------- 2️⃣ 切换 textarea 编辑器 ---------------- */

      const toggle = await waitForElement(
        '#toggleEditorCheckbox'
      );

      if (!toggle.checked) {
        toggle.click();
        console.log('Editor toggled');
      }

      /* ---------------- 3️⃣ 写入代码 ---------------- */

      const textarea = await waitForElement(
        '#sourceCodeTextarea'
      );

      textarea.value = code;

      textarea.dispatchEvent(
        new Event('input', { bubbles: true })
      );
      textarea.dispatchEvent(
        new Event('change', { bubbles: true })
      );

      console.log('Code inserted');

      /* ---------------- 4️⃣ 点击提交 ---------------- */

      const submitBtn = await waitForElement(
        '#singlePageSubmitButton'
      );

      console.log('Submit button found, submitting...');

      submitBtn.click();

      console.log('Submission triggered ✅');

    } catch (err) {
      console.error('Codeforces handler error:', err);
    }
  })();
}

