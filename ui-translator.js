/* ui-translator.js  离线版 */
function getTextNodes(root) {
  if (!root || root.nodeType === undefined) return [];
  const walk = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );
  const texts = [];
  let n;
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim();
    if (t && t.length > 1 && !n.parentElement.closest('.message, .trans-bar')) {
      texts.push({ node: n, text: t });
    }
  }
  return texts;
}

async function translateOneOffline(text) {
  const UI_LANG = localStorage.getItem('uiLang') || 'en';
  return LANG[UI_LANG]?.[text] ?? LANG.en[text] ?? text;
}

(async function initUITranslation() {
  const UI_LANG = localStorage.getItem('uiLang') || 'zh';        // 目标语言
  if (UI_LANG === 'zh') return;                                  // 中文界面跳过

  const cache = JSON.parse(localStorage.getItem('uiTransCache') || '{}');

  function getTextNodes(node) {
  if (!node || node.nodeType === undefined) return []; // ✅ 安全判断
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  const texts = [];
  let n;
  while (n = walk.nextNode()) {
    const t = n.textContent.trim();
    if (t && t.length > 1 && !n.parentElement.closest('.message, .trans-bar')) {
      texts.push({ node: n, text: t });
    }
  }
  return texts;
}

  /* 单句翻译 */
 async function translateOne(text) {
  const key = text.trim();
  const UI_LANG = localStorage.getItem('uiLang') || 'en';
  // 本地语言包直接返回
  return LANG[UI_LANG]?.[key] ?? LANG.en[key] ?? text;
}


  /* 批量翻译 */
  const nodes = getTextNodes(document.body);
  for (const item of nodes) {
    const translated = await translateOne(item.text);
    item.node.textContent = translated;
  }
})();
// 收集所有 input|textarea 的 placeholder
document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
  const txt = el.placeholder.trim();
  if (!txt) return;
  translateOne(txt).then(t => { el.placeholder = t; });
});

/* 监听用户手动切换界面语言 */
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('uiLangSelect');
  if (!sel) return;
  sel.value = localStorage.getItem('uiLang') || 'en';
  sel.addEventListener('change', e => {
    localStorage.setItem('uiLang', e.target.value);
    location.reload(); // 刷新后重新翻译
  });
});
