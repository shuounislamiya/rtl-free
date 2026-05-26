/**
 * RTL Free — Content Script
 * محرك إصلاح الاتجاه العربي الذكي
 *
 * يعمل على جميع المواقع ويكتشف النصوص العربية تلقائيًا
 * مع دعم Shadow DOM والمحتوى الديناميكي
 */

(() => {
  'use strict';

  if (window.__RTL_FREE_LOADED__) return;
  window.__RTL_FREE_LOADED__ = true;

  const STORAGE_KEY = 'rtlfree_settings';
  const STYLE_ID = 'rtlfree-styles';
  const FONT_LINK_ID = 'rtlfree-font-link';
  const DATA_ATTR = 'data-rtlfree';

  const DEFAULTS = {
    autoDetect: true,
    forceRTL: false,
    fontFamily: 'site',
    customFontName: '',
    fontSize: 100,
    lineHeight: 1.8,
    letterSpacing: 0,
    fontWeight: 400,
    convertNumerals: 'none',
    hideTashkeel: false,
    fixInputs: true,
    fixCode: false,
    smoothFonts: true,
    enabledSites: [],
    siteProfiles: {}
  };

  const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const RTL_STRONG_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  const LTR_STRONG_REGEX = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;
  const TASHKEEL_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME',
    'SVG', 'PATH', 'CANVAS', 'VIDEO', 'AUDIO', 'MAP',
    'OBJECT', 'EMBED', 'META', 'LINK', 'HEAD'
  ]);

  const CODE_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'TT', 'VAR']);

  // عناصر كتليّة تستحق معاملة خاصة (عناوين، فقرات، قوائم، خلايا)
  // حتى لو كان نصها العربي داخل <span> أو <a> أو عنصر داخلي
  const BLOCK_RTL_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD',
    'TD', 'TH', 'TR', 'THEAD', 'TBODY', 'TABLE',
    'BLOCKQUOTE', 'FIGCAPTION', 'SUMMARY', 'DETAILS',
    'LABEL', 'LEGEND', 'CAPTION'
  ]);

  const GOOGLE_FONTS = new Set([
    'Tajawal', 'Amiri', 'IBM Plex Sans Arabic', 'Vazirmatn'
  ]);

  const ARABIC_TO_HINDI = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const HINDI_TO_ARABIC = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};

  const hostname = location.hostname.toLowerCase();

  let settings = { ...DEFAULTS };
  let observer = null;
  let scanQueue = new Set();
  let scanScheduled = false;
  let pageScanned = false;

  // ============================================================
  // إدارة الإعدادات
  // ============================================================

  function loadSettings() {
    return new Promise(resolve => {
      try {
        chrome.storage.sync.get(STORAGE_KEY, data => {
          const stored = data[STORAGE_KEY] || {};
          const profile = (stored.siteProfiles || {})[hostname] || {};
          settings = { ...DEFAULTS, ...stored, ...profile };
          resolve(settings);
        });
      } catch (e) {
        resolve(settings);
      }
    });
  }

  function matchPattern(pattern, host) {
    const clean = pattern.trim().toLowerCase().replace(/^\*\./, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return false;
    return host === clean || host.endsWith('.' + clean);
  }

  function isActiveHere() {
    if (!hostname) return false;
    return (settings.enabledSites || []).some(p => matchPattern(p, hostname));
  }

  function isDisabledHere() {
    return !isActiveHere();
  }

  // ============================================================
  // حقن الأنماط والخطوط
  // ============================================================

  function sanitizeFontName(name) {
    // يمنع أي محاولة CSS injection — يسمح فقط بأحرف آمنة
    return String(name || '').replace(/[^\p{L}\p{N} \-_]/gu, '').trim().slice(0, 80);
  }

  function resolveFont() {
    if (settings.fontFamily === '__custom__') {
      return sanitizeFontName(settings.customFontName);
    }
    if (settings.fontFamily === 'site' || settings.fontFamily === 'system-ui') return '';
    return sanitizeFontName(settings.fontFamily);
  }

  function injectFontLink(fontFamily) {
    const existing = document.getElementById(FONT_LINK_ID);
    if (existing && existing.dataset.font === fontFamily) return;
    if (existing) existing.remove();

    if (!GOOGLE_FONTS.has(fontFamily)) return;

    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.dataset.font = fontFamily;
    const family = fontFamily.replace(/ /g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800&display=swap`;
    (document.head || document.documentElement).appendChild(link);
  }

  function buildCSS(options = {}) {
    const {
      fontSize, lineHeight, letterSpacing,
      fontWeight, smoothFonts, hideTashkeel, forceRTL,
      fixInputs, fixCode
    } = settings;

    const font = resolveFont();
    // إن لم يُحدَّد خط → نترك خط الموقع كما هو (لا نُضيف font-family)
    const fontRule = font ? `font-family: "${font}", "Segoe UI Arabic", "Tahoma", "Arial", system-ui, sans-serif !important;` : '';
    const scale = fontSize / 100;

    // داخل Shadow DOM لا يوجد html، لذا نستخدم بادئة فارغة
    // خارجها نُقيّد الأنماط بالعلامة على html (للأمان إذا تمّ التعطيل)
    const hostPrefix = options.forShadow ? '' : `html[${DATA_ATTR}-active="1"] `;
    const rtlSel = `[${DATA_ATTR}="rtl"]`;
    const inputSel = `[${DATA_ATTR}-input="1"]`;

    let css = `
/* RTL Free — أنماط مضافة */

${hostPrefix}${rtlSel} {
  ${fontRule}
  line-height: ${lineHeight} !important;
  letter-spacing: ${letterSpacing}em !important;
  font-weight: ${fontWeight};
  font-size: ${scale}em;
  /* محاذاة صحيحة: start تتبع direction (تصير يمينًا للـ RTL) */
  text-align: start !important;
  unicode-bidi: plaintext !important;
  ${smoothFonts ? '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;' : ''}
}

${hostPrefix}${inputSel} {
  unicode-bidi: plaintext !important;
  text-align: start !important;
  ${fontRule}
}

${hideTashkeel ? `
${hostPrefix}${rtlSel} {
  font-feature-settings: "mark" 0, "mkmk" 0;
}
` : ''}

${forceRTL ? `
${hostPrefix}body {
  direction: rtl !important;
}
${hostPrefix}body * :not([${DATA_ATTR}-ltr]) {
  unicode-bidi: plaintext;
}
` : ''}

${!fixCode ? `
${hostPrefix}code,
${hostPrefix}pre,
${hostPrefix}kbd,
${hostPrefix}samp,
${hostPrefix}tt,
${hostPrefix}var,
${hostPrefix}[class*="code"],
${hostPrefix}[class*="Code"],
${hostPrefix}.hljs,
${hostPrefix}.prism-code {
  direction: ltr !important;
  unicode-bidi: embed !important;
  text-align: left !important;
  font-family: "SF Mono", "Monaco", "Menlo", "Consolas", "Courier New", monospace !important;
}
` : ''}

/* حشوة أفضل للقوائم */
${hostPrefix}${rtlSel} ul,
${hostPrefix}${rtlSel} ol {
  padding-inline-start: 1.5em;
}

`;

    return css;
  }

  function injectStyles() {
    const css = buildCSS();
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = css;
    if (GOOGLE_FONTS.has(settings.fontFamily)) {
      injectFontLink(settings.fontFamily);
    } else {
      document.getElementById(FONT_LINK_ID)?.remove();
    }
    document.documentElement.setAttribute(`${DATA_ATTR}-active`, '1');
  }

  function removeStyles() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(FONT_LINK_ID)?.remove();
    document.documentElement.removeAttribute(`${DATA_ATTR}-active`);
    document.querySelectorAll(`[${DATA_ATTR}]`).forEach(el => {
      el.removeAttribute(DATA_ATTR);
      // امسح inline styles التي ضبطناها
      el.style.direction = '';
      el.style.textAlign = '';
      el.style.paddingRight = '';
      el.style.paddingLeft = '';
      el.style.marginRight = '';
      el.style.marginLeft = '';
      el.style.listStylePosition = '';
      // أرجع dir الأصلي
      if (el.dataset.rtlfreeDir) {
        el.setAttribute('dir', el.dataset.rtlfreeDir);
        delete el.dataset.rtlfreeDir;
      } else {
        el.removeAttribute('dir');
      }
    });
  }

  // ============================================================
  // محرك كشف الاتجاه
  // ============================================================

  function analyzeText(text) {
    if (!text || text.length < 2) return null;
    const rtlMatch = text.match(RTL_STRONG_REGEX);
    if (!rtlMatch) return null;
    const ltrMatch = text.match(LTR_STRONG_REGEX);
    const rtlCount = rtlMatch.length;
    const ltrCount = ltrMatch ? ltrMatch.length : 0;
    return rtlCount >= ltrCount ? 'rtl' : 'mixed';
  }

  function hasDirectTextWithRTL(element) {
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (text && RTL_REGEX.test(text) && text.trim().length > 0) return true;
      }
    }
    return false;
  }

  function shouldProcess(element) {
    if (!element || !element.tagName) return false;
    if (SKIP_TAGS.has(element.tagName)) return false;
    if (!settings.fixCode && CODE_TAGS.has(element.tagName)) return false;
    const dir = element.getAttribute('dir');
    if (dir === 'ltr' && !settings.forceRTL) return false;
    return true;
  }

  function applyRTL(element) {
    if (!shouldProcess(element)) return;
    if (element.getAttribute(DATA_ATTR) === 'rtl') return;

    // احفظ الـ dir الأصلي لإمكانية الإرجاع
    if (!element.dataset.rtlfreeDir && element.hasAttribute('dir')) {
      element.dataset.rtlfreeDir = element.getAttribute('dir');
    }

    // === inline styles (أعلى أولوية من CSS الموقع) ===
    // مطلوب لأن مواقع مثل AI Studio تفرض text-align: left بقواعد CSS يصعب تجاوزها
    element.setAttribute('dir', 'rtl');
    element.style.direction = 'rtl';
    element.style.textAlign = 'right';

    element.setAttribute(DATA_ATTR, 'rtl');

    // معالجة خاصة للقوائم: إذا كانت العنصر <li>، طبّق على الأب ul/ol أيضًا
    const tag = element.tagName;
    if (tag === 'LI') {
      const parent = element.parentElement;
      if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) {
        if (parent.getAttribute(DATA_ATTR) !== 'rtl-list') {
          parent.setAttribute('dir', 'rtl');
          parent.style.direction = 'rtl';
          parent.style.paddingRight = '24px';
          parent.style.paddingLeft = '0';
          parent.style.marginRight = '0';
          parent.style.marginLeft = '0';
          parent.setAttribute(DATA_ATTR, 'rtl-list');
        }
      }
      element.style.listStylePosition = 'outside';
    } else if (tag === 'UL' || tag === 'OL') {
      element.style.paddingRight = '24px';
      element.style.paddingLeft = '0';
      element.style.marginRight = '0';
      element.style.marginLeft = '0';
    }
  }

  function applyInputFix(element) {
    if (!settings.fixInputs) return;
    if (element.getAttribute(`${DATA_ATTR}-input`) === '1') return;
    element.setAttribute(`${DATA_ATTR}-input`, '1');
    if (!element.hasAttribute('dir')) {
      element.setAttribute('dir', 'auto');
    }
  }

  function convertNumerals(root) {
    if (settings.convertNumerals === 'none') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        if (CODE_TAGS.has(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const original = node.textContent;
      let converted = original;
      if (settings.convertNumerals === 'hindi') {
        converted = original.replace(/[0-9]/g, d => ARABIC_TO_HINDI[d]);
      } else if (settings.convertNumerals === 'arabic') {
        converted = original.replace(/[٠-٩]/g, d => HINDI_TO_ARABIC[d] || d);
      }
      if (converted !== original) node.textContent = converted;
    }
  }

  function walkAndProcess(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement && RTL_REGEX.test(root.textContent)) {
        applyRTL(root.parentElement);
      }
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = root.tagName;
    if (tag && SKIP_TAGS.has(tag)) return;

    // معالجة العنصر نفسه
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (hasDirectTextWithRTL(root)) {
        applyRTL(root);
      } else if (BLOCK_RTL_TAGS.has(tag) && RTL_REGEX.test(root.textContent || '')) {
        // عناصر كتليّة (عناوين، فقرات، ...) حتى لو كان النص داخل span أو عنصر داخلي
        applyRTL(root);
      } else if (
        // Custom Elements (ms-*, mat-*, ...) التي تحوي نصًا عربيًا
        // نعطيها dir=auto ليُساعد على الإخراج الصحيح
        tag && tag.includes('-') &&
        RTL_REGEX.test(root.textContent || '') &&
        !root.hasAttribute('dir')
      ) {
        root.setAttribute('dir', 'auto');
      }
    }

    // معالجة حقول الإدخال
    if (settings.fixInputs && root.nodeType === Node.ELEMENT_NODE) {
      const inputs = root.matches?.('input, textarea, [contenteditable]')
        ? [root]
        : [];
      const found = root.querySelectorAll?.('input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') || [];
      [...inputs, ...found].forEach(applyInputFix);
    }

    // المرور على الأطفال
    const children = root.children || [];
    for (const child of children) {
      walkAndProcess(child);
    }

    // دعم Shadow DOM
    if (root.shadowRoot) {
      walkAndProcess(root.shadowRoot);
    }
  }

  // ============================================================
  // المراقب الذكي للمحتوى الديناميكي
  // ============================================================

  const idleRun = (typeof requestIdleCallback === 'function')
    ? (fn) => requestIdleCallback(fn, { timeout: 200 })
    : (fn) => setTimeout(fn, 50);

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    idleRun(processQueue);
  }

  function processQueue() {
    scanScheduled = false;
    const items = Array.from(scanQueue);
    scanQueue.clear();
    for (const item of items) {
      try {
        walkAndProcess(item);
      } catch (e) { /* تجاهل */ }
    }
  }

  function enqueue(target) {
    if (!target) return;
    scanQueue.add(target);
    scheduleScan();
  }

  function startObserver() {
    stopObserver();
    observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              enqueue(node);
            } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              if (RTL_REGEX.test(node.textContent)) {
                applyRTL(node.parentElement);
              }
            }
          }
        } else if (m.type === 'characterData') {
          const node = m.target;
          if (node.parentElement && RTL_REGEX.test(node.textContent || '')) {
            applyRTL(node.parentElement);
          }
        } else if (m.type === 'attributes' && m.attributeName === 'dir') {
          const el = m.target;
          if (el && el.getAttribute('dir') !== 'auto' && el.getAttribute(DATA_ATTR) === 'rtl' && !settings.forceRTL) {
            if (RTL_REGEX.test(el.textContent || '')) {
              el.setAttribute('dir', 'auto');
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['dir']
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ============================================================
  // تطبيق الإعدادات على Shadow Roots
  // ============================================================

  function injectIntoShadowRoots(root = document) {
    // نبحث عن جميع العناصر التي لها shadowRoot مفتوح
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of elements) {
      if (el.shadowRoot) {
        const shadow = el.shadowRoot;
        // نُعيد حقن الستايل في كل مرة لضمان تحديث الإعدادات
        let style = shadow.getElementById(STYLE_ID);
        if (!style) {
          style = document.createElement('style');
          style.id = STYLE_ID;
          shadow.appendChild(style);
        }
        // بادئة shadow: لا تستخدم html[...] لأنه غير موجود داخل Shadow DOM
        style.textContent = buildCSS({ forShadow: true });
        walkAndProcess(shadow);
        injectIntoShadowRoots(shadow);
      }
    }
  }

  // ============================================================
  // التشغيل والتحديث
  // ============================================================

  function fullScan() {
    if (!document.body) return;
    walkAndProcess(document.body);
    injectIntoShadowRoots(document);
    if (settings.convertNumerals !== 'none') convertNumerals(document.body);
    pageScanned = true;
  }

  // فحص دوري خفيف للمواقع التي تحمّل محتوى ديناميكيًا داخل Shadow DOM
  // (AI Studio، Angular Material، Web Components)
  let periodicTimer = null;
  function startPeriodicRescan() {
    if (periodicTimer) return;
    periodicTimer = setInterval(() => {
      if (!isActiveHere() || !pageScanned) return;
      try {
        injectIntoShadowRoots(document);
      } catch (e) { /* تجاهل */ }
    }, 2500);
  }
  function stopPeriodicRescan() {
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
  }

  async function init() {
    await loadSettings();
    stopObserver();
    stopPeriodicRescan();

    if (isDisabledHere()) {
      removeStyles();
      return;
    }

    injectStyles();

    const run = () => {
      fullScan();
      startObserver();
      startPeriodicRescan();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  // ============================================================
  // الاستماع للرسائل
  // ============================================================

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[STORAGE_KEY]) {
        init();
      }
    });
  } catch (e) { /* sandbox */ }

  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case 'rtlfree:get-status':
          sendResponse({
            active: isActiveHere(),
            hostname,
            settings
          });
          break;
        case 'rtlfree:rescan':
          fullScan();
          sendResponse({ ok: true });
          break;
        case 'rtlfree:reload':
          init().then(() => sendResponse({ ok: true }));
          return true;
        case 'rtlfree:toggle-site': {
          const enabled = new Set(settings.enabledSites || []);
          if (enabled.has(hostname)) enabled.delete(hostname);
          else enabled.add(hostname);
          const newSettings = { ...settings, enabledSites: [...enabled] };
          chrome.storage.sync.set({ [STORAGE_KEY]: newSettings }, () => {
            sendResponse({ ok: true, active: enabled.has(hostname) });
          });
          return true;
        }
      }
    });
  } catch (e) { /* sandbox */ }

  // ============================================================
  // البدء
  // ============================================================

  init();
})();
