/**
 * translator.js – 多语言翻译核心
 * 支持 MyMemory 免费接口 + 可选 Google 语言检测
 * 直接替换原有文件即可运行
 */

/* ==========  用户配置  ========== */
const USE_GOOGLE_DETECT = false;   // true=Google 检测，false=本地正则
const USER_LANG         = localStorage.getItem('userLanguage') || 'zh-CN';
const TRANS_CACHE       = JSON.parse(localStorage.getItem('transCache') || '{}');

/* ==========  语言元数据  ========== */
const LANG_INFO = {
  zh:  { name: '中文',        flag: '🇨🇳', code: 'zh-CN', color: '#dc2626' },
  ru:  { name: '俄语',        flag: '🇷🇺', code: 'ru-RU', color: '#2563eb' },
  de:  { name: '德语',        flag: '🇩🇪', code: 'de-DE', color: '#059669' },
  en:  { name: '英语',        flag: '🇺🇸', code: 'en-US', color: '#7c3aed' },
  ka:  { name: '格鲁吉亚文',  flag: '🇬🇪', code: 'ka-GE', color: '#d97706' },
  auto:{ name: '自动检测',    flag: '🌐', code: '',      color: '#6b7280' }
};

/* ==========  翻译核心  ========== */
async function translateText(original, sourceLang, targetLang) {
  if (!original.trim()) return '';

  // 自动检测
  if (sourceLang === 'auto') {
    sourceLang = USE_GOOGLE_DETECT ? await googleDetect(original) : regexDetect(original);
  }

  const key = `${original}::${sourceLang}->${targetLang}`;
  if (TRANS_CACHE[key]) return TRANS_CACHE[key];

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(original)}&langpair=${sourceLang}|${targetLang}`;
  const r   = await fetch(url);
  const j   = await r.json();

  if (j.responseStatus === 200 && j.responseData) {
    TRANS_CACHE[key] = j.responseData.translatedText;
    localStorage.setItem('transCache', JSON.stringify(TRANS_CACHE));
    return j.responseData.translatedText;
  }
  throw new Error(j.responseDetails || 'MyMemory 翻译失败');
}

/* ==========  语言检测  ========== */
// 1. 本地正则（零成本）
function regexDetect(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[ა-ჰ]/.test(text))       return 'ka';
  if (/[а-яА-Я]/.test(text))   return 'ru';
  if (/[äöüßÄÖÜ]/.test(text))  return 'de';
  if (/[a-zA-Z]/.test(text))   return 'en';
  return 'en'; // 兜底
}

// 2. Google 检测（免费，需联网）
async function googleDetect(text) {
  try {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=ld&q=${encodeURIComponent(text)}`;
    const r = await fetch(u);
    const j = await r.json();
    return j[2] || 'en';
  } catch {
    return 'en'; // 网络失败时回落
  }
}

/* ==========  渲染翻译条（不破坏原文）  ========== */
async function appendTranslation(msgBubble, originalText) {
  if (!originalText) return;
  let bar = msgBubble.querySelector('.trans-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'trans-bar';
    msgBubble.appendChild(bar);
  }
  const translated = await translateText(originalText, 'auto', USER_LANG);
  if (translated) {
    bar.textContent = `翻译：${translated}`;
    bar.classList.add('show');
  }
}

// 对外暴露
window.translateMessage = async (msgDiv) => {
  const bubble = msgDiv.querySelector('.message-bubble');
  const textEl = bubble.querySelector('.message-text');
  if (!textEl) return;
  const original = textEl.textContent.trim();
  if (!original) return;
  await appendTranslation(bubble, original);
};
