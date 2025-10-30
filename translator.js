/* translator.js  离线版 */
// 不再访问 MyMemory
async function translateText(original, sourceLang, targetLang) {
  if (!original.trim()) return '';
  // 本地正则检测
  if (sourceLang === 'auto') {
    sourceLang = regexDetect(original);   // 沿用原来的正则
  }
  // 直接读 lang.js
  const key = original.trim();
  // 先找目标语言包，没有再回落到英文
  return LANG[targetLang]?.[key] ?? LANG.en[key] ?? key;
}

/* 渲染翻译条（保持不变） */
async function appendTranslation(msgBubble, originalText) {
  if (!originalText) return;
  let bar = msgBubble.querySelector('.trans-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'trans-bar';
    msgBubble.appendChild(bar);
  }
  // 离线翻译
  const translated = await translateText(originalText, 'auto', localStorage.getItem('userLanguage') || 'en');
  if (translated && translated !== originalText) {
    bar.textContent = `翻译：${translated}`;
    bar.classList.add('show');
  }
}

/* 对外暴露不变 */
window.translateMessage = async (msgDiv) => {
  const bubble = msgDiv.querySelector('.message-bubble');
  const textEl = bubble.querySelector('.message-text');
  if (!textEl) return;
  const original = textEl.textContent.trim();
  if (!original) return;
  await appendTranslation(bubble, original);
};
