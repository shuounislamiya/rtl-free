/**
 * RTL Free — Service Worker
 * إدارة القائمة السياقية والإشعارات والشارة
 */

const STORAGE_KEY = 'rtlfree_settings';

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

const FONT_CYCLE = [
  'system-ui', 'Tajawal', 'Amiri', 'IBM Plex Sans Arabic', 'Vazirmatn'
];

async function getSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

async function getActiveHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).hostname.toLowerCase();
  } catch { return null; }
}

// ============================================================
// إنشاء القائمة السياقية
// ============================================================

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'rtlfree-toggle-site',
      title: 'تفعيل/تعطيل RTL Free على هذا الموقع',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-cycle-font',
      title: 'تبديل الخط العربي',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-separator',
      type: 'separator',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-increase',
      title: 'تكبير الخط',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-decrease',
      title: 'تصغير الخط',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-reset-size',
      title: 'إعادة الحجم الافتراضي',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-separator2',
      type: 'separator',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'rtlfree-options',
      title: 'الإعدادات المتقدمة',
      contexts: ['page']
    });
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  createContextMenus();
  if (details.reason === 'install') {
    await saveSettings(DEFAULTS);
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

// ============================================================
// معالج القائمة السياقية
// ============================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const settings = await getSettings();

  switch (info.menuItemId) {
    case 'rtlfree-toggle-site':
      await toggleSite();
      break;
    case 'rtlfree-cycle-font':
      await cycleFont();
      break;
    case 'rtlfree-increase':
      await changeSize(10);
      break;
    case 'rtlfree-decrease':
      await changeSize(-10);
      break;
    case 'rtlfree-reset-size':
      await setSize(100);
      break;
    case 'rtlfree-options':
      chrome.runtime.openOptionsPage();
      break;
  }
});

// ============================================================
// الإجراءات
// ============================================================

async function toggleSite() {
  const host = await getActiveHost();
  if (!host) return;
  const settings = await getSettings();
  const enabled = new Set(settings.enabledSites || []);
  if (enabled.has(host)) enabled.delete(host);
  else enabled.add(host);
  await saveSettings({ ...settings, enabledSites: [...enabled] });
  await updateBadge();
}

async function cycleFont() {
  const settings = await getSettings();
  const idx = FONT_CYCLE.indexOf(settings.fontFamily);
  const next = FONT_CYCLE[(idx + 1) % FONT_CYCLE.length];
  await saveSettings({ ...settings, fontFamily: next });
  await showToast(`الخط: ${next}`);
}

async function changeSize(delta) {
  const settings = await getSettings();
  const size = Math.max(60, Math.min(200, settings.fontSize + delta));
  await saveSettings({ ...settings, fontSize: size });
  await showToast(`الحجم: ${size}%`);
}

async function setSize(size) {
  const settings = await getSettings();
  await saveSettings({ ...settings, fontSize: size });
  await showToast(`الحجم: ${size}%`);
}

async function toggleForceRTL() {
  const settings = await getSettings();
  const forceRTL = !settings.forceRTL;
  await saveSettings({ ...settings, forceRTL });
  await showToast(forceRTL ? 'تم فرض RTL' : 'تم إلغاء فرض RTL');
}

async function showToast(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg) => {
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = `
          position:fixed;top:20px;left:50%;transform:translateX(-50%);
          background:#1e293b;color:#fff;padding:12px 20px;
          border-radius:12px;font-size:14px;font-family:system-ui;
          z-index:2147483647;box-shadow:0 10px 40px rgba(0,0,0,.3);
          direction:rtl;opacity:0;transition:opacity .2s;
          border:1px solid rgba(255,255,255,.1);
        `;
        document.documentElement.appendChild(t);
        requestAnimationFrame(() => t.style.opacity = '1');
        setTimeout(() => {
          t.style.opacity = '0';
          setTimeout(() => t.remove(), 250);
        }, 1500);
      },
      args: [text]
    });
  } catch (e) { /* بعض الصفحات لا تسمح */ }
}

// ============================================================
// شارة الأيقونة
// ============================================================

async function updateBadge(tabId) {
  const settings = await getSettings();
  const tabs = tabId ? [{ id: tabId, url: (await chrome.tabs.get(tabId)).url }] : await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!tab.url || !tab.id) continue;
    let host;
    try { host = new URL(tab.url).hostname.toLowerCase(); } catch { continue; }

    const active = (settings.enabledSites || []).some(d => host === d || host.endsWith('.' + d));

    const badge = active ? 'ON' : '';
    const color = active ? '#22c55e' : '#ef4444';

    try {
      await chrome.action.setBadgeText({ tabId: tab.id, text: badge });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color });
    } catch { /* تجاهل */ }
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete') updateBadge(tabId);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) updateBadge();
});

// ============================================================
// الرسائل من الصفحات
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.type) return;
  if (msg.type === 'rtlfree:open-options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  } else if (msg.type === 'rtlfree:get-defaults') {
    sendResponse({ defaults: DEFAULTS });
  }
});
