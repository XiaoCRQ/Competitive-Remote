chrome.runtime.onMessage.addListener((msg) => {
  const { url, code, language } = msg;
  if (!url) return;

  console.log('Content script received:', msg);

  if (url.includes('luogu.com.cn')) handleLuogu(code, language);
  else if (url.includes('codeforces.com')) handleCodeforce({ code: code.source, language, problem: code.problem });
  else if (url.includes('nowcoder.com')) handleNowcoder(code, language);
  else console.log('Default action:', msg);
});


function handleLuogu(code, language) {
  console.log('Executing Luogu handler with language:', language);

  const editorSelector =
    'div.cm-content.cm-lineWrapping[contenteditable="true"]';

  const submitBtnSelector =
    'button.solid.lform-size-middle[type="button"][style*="margin-top: 1em"]';

  const languageDropdownSelector =
    'div[data-v-dbc33c63].dropdown'; // 语言选择框根节点
  const MAX_WAIT = 15000; // 最长等待 15s
  const startTime = Date.now();

  // ---------------- 语言映射 ----------------
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

  // ---------------- 工具：清空 + 写入 ----------------
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
  }

  // ---------------- 工具：选择语言 ----------------
  function selectLanguage() {
    const dropdown = document.querySelector(languageDropdownSelector);
    if (!dropdown) return false;

    const items = dropdown.querySelectorAll('li');
    for (const li of items) {
      if (li.textContent.trim() === targetLang) {
        li.click();
        console.log('Selected language:', targetLang);
        return true;
      }
    }
    console.warn('Language not found, defaulting to auto');
    return false;
  }

  // ---------------- 提交函数 ----------------
  function trySubmit(editor, submitBtn, observer) {
    if (!editor || !submitBtn) return;

    setEditorContent(editor, code);
    selectLanguage();

    submitBtn.click();
    console.log('Clicked submit button ✅');

    observer.disconnect();
  }

  // ---------------- MutationObserver ----------------
  const observer = new MutationObserver(() => {
    if (Date.now() - startTime > MAX_WAIT) {
      console.warn('Luogu handler timeout, aborting');
      observer.disconnect();
      return;
    }

    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor && submitBtn) {
      trySubmit(editor, submitBtn, observer);
    }
  });

  const body = document.querySelector('body');
  if (body) {
    observer.observe(body, {
      childList: true,
      subtree: true,
    });
  } else {
    console.error('Body not found!');
  }

  // ---------------- 兜底立即检测一次 ----------------
  setTimeout(() => {
    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor && submitBtn) {
      trySubmit(editor, submitBtn, observer);
    }
  }, 500);
}


function handleNowcoder(code, language) {
  const escapedCode = code
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  // 牛客语言映射表
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

  const targetLang =
    NOWCODER_LANG_MAP[language?.toLowerCase()] ||
    '自动识别语言';

  console.log('Mapped language →', targetLang);

  const scriptContent = `
    (function() {
      console.log('Nowcoder handler start');

      /* ---------------- 找到 CodeMirror ---------------- */
      const cmContainers = document.querySelectorAll('.CodeMirror');
      if (!cmContainers.length) {
        console.warn('No CodeMirror instance found');
        return;
      }

      const cmContainer = cmContainers[0];
      const cm = cmContainer.CodeMirror || cmContainer.nextSibling?.CodeMirror;
      if (!cm) {
        console.warn('CodeMirror API not found');
        return;
      }

      /* ---------------- 语言选择 ---------------- */
      const langBtn = document.querySelector('.language-select');
      if (langBtn) {
        langBtn.click();
        console.log('Language dropdown opened');

        const dropdownItems = document.querySelectorAll('.language-list li');
        let matched = false;

        dropdownItems.forEach(li => {
          const text = li.innerText.trim();
          if (text === '${targetLang}') {
            li.click();
            console.log('Language selected →', text);
            matched = true;
          }
        });

        if (!matched) {
          console.warn('Language not found, fallback auto');
        }
      } else {
        console.warn('Language button not found');
      }

      /* ---------------- 设置代码 ---------------- */
      cm.setValue('');
      console.log('Cleared existing code in CodeMirror');
      cm.setValue(\`${escapedCode}\`);
      console.log('Inserted new code via CodeMirror API');

      /* ---------------- 点击提交 ---------------- */
      const submitBtn = document.querySelector('button.btn-submit');
      if (submitBtn) {
        submitBtn.click();
        console.log('Clicked "保存并提交" button');
      } else {
        console.warn('Submit button not found');
      }
    })();
  `;

  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function handleCodeforce(payload) {
  console.log('Executing Codeforces handler');

  const { code, problem, language } = payload;

  // ----------------- Codeforces 语言映射 -----------------
  const CF_LANG_MAP = {
    c: 'GNU GCC C11 5.1.0',
    cpp: 'GNU G++23 14.2 (64 bit, msys2)',
    python: 'Python 3.13.2',
    java: 'Java 8 32bit',
    rust: 'Rust 1.89.0 (2024)',
    go: 'Go 1.22.2',
    csharp: 'C# Mono 6.8',
    javascript: 'Node.js 15.8.0 (64bit)',
    typescript: 'Node.js 15.8.0 (64bit)',
    lua: 'Lua',
    ruby: 'Ruby 3.2.2',
  };

  const targetLang = CF_LANG_MAP[language?.toLowerCase()] || null;
  console.log('Mapped language →', targetLang);

  // ----------------- 工具函数 -----------------
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

  function setTextareaValue(el, value) {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Textarea cleared and new code inserted');
  }

  function selectLanguageOption(value) {
    if (!value) return;
    const select = document.querySelector('select[name="programTypeId"]');
    if (select) {
      const option = Array.from(select.options).find(
        (o) => o.text.trim() === value
      );
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('Language selected →', value);
      } else {
        console.warn('Language option not found →', value);
      }
    } else {
      console.warn('Language select not found');
    }
  }

  // ----------------- 主流程 -----------------
  (async () => {
    try {
      // 1️⃣ 选择题号
      let problemSelected = false;
      const select = document.querySelector('select[name="submittedProblemIndex"]');
      if (select) {
        const option = select.querySelector(`option[value="${problem}"]`);
        if (option) {
          select.value = problem;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          problemSelected = true;
          console.log('Problem selected via select:', problem);
        }
      }
      if (!problemSelected) {
        const input = document.querySelector('input[name="submittedProblemCode"]');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.value = problem;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          problemSelected = true;
          console.log('Problem filled via input:', problem);
        }
      }
      if (!problemSelected) console.warn('Problem selector not found');

      // 2️⃣ 选择语言
      selectLanguageOption(targetLang);

      // 3️⃣ 切换 textarea 编辑器
      const toggle = await waitForElement('#toggleEditorCheckbox');
      if (!toggle.checked) {
        toggle.click();
        console.log('Editor toggled to textarea mode');
      }

      // 4️⃣ 写入代码
      const textarea = await waitForElement('#sourceCodeTextarea');
      setTextareaValue(textarea, code);

      // 5️⃣ 点击提交
      const submitBtn = await waitForElement('#singlePageSubmitButton');
      console.log('Submit button found, submitting...');
      submitBtn.click();
      console.log('Submission triggered ✅');
    } catch (err) {
      console.error('Codeforces handler error:', err);
    }
  })();
}

