chrome.runtime.onMessage.addListener((msg) => {
  const { url, code, language } = msg;
  if (!url) return;

  console.log('Content script received:', msg);

  if (url.includes('luogu.com.cn')) handleLuogu(code, language);
  else if (url.includes('codeforces.com')) handleCodeforce({ code: code.source, language, problem: code.problem });
  else if (url.includes('nowcoder.com')) handleNowcoder(code, language);
  else console.log('Default action:', msg);
});


async function handleLuogu(code, language) {
  console.log('Executing Luogu handler with language:', language);

  const editorSelector = 'div.cm-content.cm-lineWrapping[contenteditable="true"]';
  const submitBtnSelector = 'button.solid.lform-size-middle[type="button"][style*="margin-top: 1em"]';
  const languageDropdownSelector = 'div[data-v-dbc33c63].dropdown';
  const MAX_WAIT = 15000;
  const startTime = Date.now();

  const langMap = {
    c: "C",
    cpp: "C++23",
    python: "Python 3",
    lua: "Lua",
    javascript: "Node.js LTS",
    typescript: "TypeScript",
    java: "Java 8",
    rust: "Rust",
    go: "Go",
  };

  const targetLang = langMap[(language || "").toLowerCase()] || "自动识别语言";

  // --- 工具：延迟函数 ---
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // --- 工具：清空 + 写入并触发事件 ---
  function setEditorContent(editor, value) {
    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    const lines = value.split('\n');
    lines.forEach((line, index) => {
      document.execCommand('insertText', false, line);
      if (index !== lines.length - 1) {
        document.execCommand('insertLineBreak');
      }
    });

    // 【关键修复】手动触发 input 事件，让框架感知到内容变化
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // --- 工具：选择语言 ---
  async function selectLanguage() {
    const dropdown = document.querySelector(languageDropdownSelector);
    if (!dropdown) return false;

    // 模拟点击打开下拉菜单（有些组件需要先点击父级）
    dropdown.click();
    await sleep(200); // 等待下拉列表渲染

    const items = dropdown.querySelectorAll('li');
    for (const li of items) {
      if (li.textContent.trim() === targetLang) {
        li.click();
        console.log('Selected language:', targetLang);
        return true;
      }
    }
    console.warn('Language not found');
    return false;
  }

  // --- 提交主逻辑 ---
  async function trySubmit(editor, submitBtn, observer) {
    if (observer) observer.disconnect(); // 防止重复触发

    // 1. 输入代码
    setEditorContent(editor, code);
    await sleep(300); // 给编辑器状态同步留出时间

    // 2. 选择语言
    await selectLanguage();
    await sleep(300); // 给语言选择留出同步时间

    // 3. 再次检查内容（可选，兜底方案）
    if (editor.textContent.length < 5) {
      console.error("Editor content seems empty, retrying...");
      return;
    }

    // 4. 执行提交
    submitBtn.click();
    console.log('Clicked submit button ✅');
  }

  // --- 观察器 ---
  const observer = new MutationObserver(async () => {
    if (Date.now() - startTime > MAX_WAIT) {
      observer.disconnect();
      return;
    }

    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor && submitBtn) {
      // 停止观察，进入提交流程
      observer.disconnect();
      await trySubmit(editor, submitBtn, null);
    }
  });

  const body = document.querySelector('body');
  if (body) {
    observer.observe(body, { childList: true, subtree: true });
  }

  // 立即检测一次
  const initialEditor = document.querySelector(editorSelector);
  const initialBtn = document.querySelector(submitBtnSelector);
  if (initialEditor && initialBtn) {
    await trySubmit(initialEditor, initialBtn, observer);
  }
}


function handleNowcoder(code, language) {
  const escapedCode = code
    .replace(/\\/g, '\\\\') // 额外处理转义符
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const NOWCODER_LANG_MAP = {
    c: 'C(gcc 10)',
    cpp: 'C++（clang++18）',
    python: 'Python3',
    lua: 'Lua',
    javascript: 'JavaScript Node',
    typescript: 'TypeScript',
    java: 'Java',
    rust: 'Rust',
    go: 'Go',
  };

  const targetLang = NOWCODER_LANG_MAP[language?.toLowerCase()] || '自动识别语言';

  console.log('Mapped language →', targetLang);

  const scriptContent = `
    (async function() {
      console.log('Nowcoder handler start');

      const sleep = (ms) => new Promise(res => setTimeout(res, ms));

      /* ---------------- 1. 等待并获取 CodeMirror ---------------- */
      async function getCM() {
        for (let i = 0; i < 20; i++) { // 最多等待 4s
          const cmContainers = document.querySelectorAll('.CodeMirror');
          if (cmContainers.length) {
            const cm = cmContainers[0].CodeMirror || cmContainers[0].nextSibling?.CodeMirror;
            if (cm) return cm;
          }
          await sleep(200);
        }
        return null;
      }

      const cm = await getCM();
      if (!cm) {
        console.error('CodeMirror API not found');
        return;
      }

      /* ---------------- 2. 设置代码 ---------------- */
      cm.setValue(\`${escapedCode}\`);
      console.log('Inserted code via CM');
      // 触发一次变化事件，确保 UI 刷新
      cm.refresh(); 
      await sleep(300); 

      /* ---------------- 3. 选择语言 ---------------- */
      const langBtn = document.querySelector('.language-select');
      if (langBtn) {
        langBtn.click();
        console.log('Language dropdown opened');

        // 【关键修复】等待下拉列表 DOM 生成
        await sleep(400); 

        const dropdownItems = document.querySelectorAll('.language-list li');
        let matched = false;

        for (const li of dropdownItems) {
          if (li.innerText.trim().includes('${targetLang}')) {
            li.click();
            console.log('Language selected →', li.innerText.trim());
            matched = true;
            break;
          }
        }
        if (!matched) console.warn('Language not found, fallback to default');
      }

      // 给框架留出时间同步 state
      await sleep(500);

      /* ---------------- 4. 点击提交 ---------------- */
      const submitBtn = document.querySelector('button.btn-submit') || 
                        document.querySelector('.nc-req-btn') || 
                        document.querySelector('button[class*="submit"]');

      if (submitBtn) {
        // 确保按钮是启用状态
        if(submitBtn.disabled) {
           console.log('Waiting for button to be enabled...');
           await sleep(500);
        }
        submitBtn.click();
        console.log('Clicked submit button ✅');
      } else {
        console.error('Submit button not found');
      }
    })();
  `;

  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

async function handleCodeforce(payload) {
  console.log('Executing Codeforces handler');

  const { code, problem, language } = payload;
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // ----------------- 1. 语言映射 (增强容错) -----------------
  const CF_LANG_MAP = {
    c: 'GNU GCC C11',
    cpp: 'GNU G++23',
    python: 'Python 3',
    java: 'Java 8',
    rust: 'Rust',
    go: 'Go',
    javascript: 'Node.js',
    typescript: 'Node.js',
  };

  const targetLangFragment = CF_LANG_MAP[language?.toLowerCase()] || null;

  // ----------------- 2. 工具函数 -----------------
  async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) return el; // 确保元素可见
      await sleep(200);
    }
    throw new Error(`Timeout waiting for ${selector}`);
  }

  function selectLanguageOption(fragment) {
    if (!fragment) return;
    const select = document.querySelector('select[name="programTypeId"]');
    if (!select) return;

    const option = Array.from(select.options).find(o =>
      o.text.trim().includes(fragment)
    );

    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('Language selected →', option.text);
    }
  }

  // ----------------- 3. 主流程 -----------------
  try {
    // A. 选择题号 (支持直接输入或下拉选)
    const probSelect = document.querySelector('select[name="submittedProblemIndex"]');
    const probInput = document.querySelector('input[name="submittedProblemCode"]');

    if (probSelect) {
      probSelect.value = problem;
      probSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (probInput) {
      probInput.value = problem;
      probInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // B. 选择语言
    selectLanguageOption(targetLangFragment);
    await sleep(300);

    // C. 切换并等待编辑器准备就绪
    const toggle = await waitForElement('#toggleEditorCheckbox');
    if (!toggle.checked) {
      toggle.click();
      console.log('Toggled to textarea mode');
      // 关键：切换模式后 DOM 会重建，必须等待
      await sleep(500);
    }

    // D. 填充代码 (强制刷新 DOM 状态)
    const textarea = await waitForElement('#sourceCodeTextarea');
    textarea.focus();
    textarea.value = code;

    // 触发一系列事件确保 CF 的脚本抓取到值
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));

    console.log('Code inserted into textarea');
    await sleep(500); // 给浏览器留出渲染和同步的时间

    // E. 提交前的最终检查
    if (textarea.value.length < 5) {
      throw new Error("Code was not properly inserted into textarea.");
    }

    // F. 执行提交
    const submitBtn = await waitForElement('input.submit[type="submit"], #singlePageSubmitButton');
    console.log('Submitting...');
    submitBtn.click();

    console.log('Submission triggered ✅');

  } catch (err) {
    console.error('Codeforces handler failed:', err);
  }
}
