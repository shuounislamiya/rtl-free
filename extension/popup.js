/**
 * RTL Free — Popup Logic
 */

const STORAGE_KEY = 'rtlfree_settings';

const DEFAULTS = {
  enabled: true,
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
  'site', 'IBM Plex Sans Arabic', 'Tajawal', 'Amiri', 'Vazirmatn'
];

const PREVIEW_FONTS = ['IBM Plex Sans Arabic', 'Tajawal', 'Amiri', 'Vazirmatn'];

// قائمة شاملة لخطوط عربية محتملة على نظام المستخدم
const SYSTEM_ARABIC_FONTS = [
  // ويندوز
  'Sakkal Majalla', 'Traditional Arabic', 'Simplified Arabic',
  'Arabic Typesetting', 'Aldhabi', 'Andalus', 'Urdu Typesetting',
  'Microsoft Uighur', 'Microsoft Sans Serif',
  'Segoe UI', 'Segoe UI Arabic', 'Segoe UI Historic',
  'Tahoma', 'Arial', 'Arial Unicode MS', 'Times New Roman',
  'Courier New', 'Georgia', 'Verdana', 'Calibri',
  'Dubai', 'Dubai Light', 'Dubai Medium', 'Dubai Bold',
  // ماك
  'Geeza Pro', 'Baghdad', 'Al Bayan', 'Damascus', 'DecoType Naskh',
  'Farah', 'Farisi', 'Kufi Standard GK', 'Mishafi', 'Muna',
  'Nadeem', 'Nader Book', 'Sana', 'Scheherazade', 'KufiStandardGK',
  'GeezaPro', 'AlBayan', 'Helvetica', 'Helvetica Neue',
  // لينكس
  'DejaVu Sans', 'Liberation Sans', 'Noto Sans', 'Noto Sans Arabic',
  'Noto Naskh Arabic', 'Noto Kufi Arabic', 'Noto Nastaliq Urdu',
  'Droid Arabic Naskh', 'Droid Arabic Kufi',
  'KacstOne', 'KacstBook', 'KacstTitle', 'KacstArt',
  // Google Fonts (إذا كان مثبّت على النظام)
  'Cairo', 'Tajawal', 'Amiri', 'IBM Plex Sans Arabic', 'Vazirmatn',
  'Almarai', 'Readex Pro', 'Reem Kufi', 'Changa', 'Mada',
  'Alexandria', 'El Messiri', 'Markazi Text', 'Harmattan',
  'Scheherazade New', 'Lateef', 'Aref Ruqaa', 'Amiri Quran',
  'Mirza', 'Jomhuria', 'Lalezar', 'Rakkas', 'Gulzar',
  'Katibeh', 'Kufam', 'Lemonada', 'Blaka', 'Qahiri', 'ReemKufi'
];

let settings = { ...DEFAULTS };
let currentHost = '';
let saveTimer = null;

// ============================================================
// التهيئة
// ============================================================

async function init() {
  await loadSettings();
  await detectCurrentSite();
  bindUI();
  renderAll();
  loadPreviewFonts();
}

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(STORAGE_KEY, data => {
      settings = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
      resolve();
    });
  });
}

function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }, 120);
}

async function detectCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try {
      currentHost = new URL(tab.url).hostname.toLowerCase();
    } catch { currentHost = ''; }
  }
}

// ============================================================
// ربط الواجهة
// ============================================================

function $(id) { return document.getElementById(id); }

function bindUI() {
  $('mainToggle').addEventListener('click', toggleCurrentSite);

  $('fontFamily').addEventListener('change', e => {
    settings.fontFamily = e.target.value;
    toggleCustomFont();
    saveSettings();
    updatePreview();
  });

  $('customFontName').addEventListener('input', e => {
    settings.customFontName = e.target.value.trim();
    saveSettings();
    updatePreview();
    highlightActiveChip();
  });

  $('btnDetectFonts').addEventListener('click', detectSystemFonts);

  $('fontShuffle').addEventListener('click', () => {
    const idx = FONT_CYCLE.indexOf(settings.fontFamily);
    const next = FONT_CYCLE[(idx + 1) % FONT_CYCLE.length];
    settings.fontFamily = next;
    $('fontFamily').value = next;
    toggleCustomFont();
    saveSettings();
    updatePreview();
  });

  $('fontSize').addEventListener('input', e => {
    settings.fontSize = parseInt(e.target.value, 10);
    $('fontSizeVal').textContent = settings.fontSize + '%';
    saveSettings();
    markActiveSize();
  });

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = parseInt(btn.dataset.size, 10);
      settings.fontSize = size;
      $('fontSize').value = size;
      $('fontSizeVal').textContent = size + '%';
      saveSettings();
      markActiveSize();
    });
  });

  $('lineHeight').addEventListener('input', e => {
    settings.lineHeight = parseFloat(e.target.value);
    $('lineHeightVal').textContent = settings.lineHeight.toFixed(1);
    saveSettings();
  });

  $('letterSpacing').addEventListener('input', e => {
    settings.letterSpacing = parseFloat(e.target.value);
    $('letterSpacingVal').textContent = settings.letterSpacing.toFixed(2);
    saveSettings();
  });

  $('fontWeight').addEventListener('input', e => {
    settings.fontWeight = parseInt(e.target.value, 10);
    $('fontWeightVal').textContent = settings.fontWeight;
    saveSettings();
    updatePreview();
  });

  $('forceRTL')?.addEventListener('change', e => {
    settings.forceRTL = e.target.checked;
    saveSettings();
  });

  $('hideTashkeel')?.addEventListener('change', e => {
    settings.hideTashkeel = e.target.checked;
    saveSettings();
  });

  $('fixInputs')?.addEventListener('change', e => {
    settings.fixInputs = e.target.checked;
    saveSettings();
  });

  document.querySelectorAll('input[name="numerals"]').forEach(r => {
    r.addEventListener('change', e => {
      if (e.target.checked) {
        settings.convertNumerals = e.target.value;
        saveSettings();
      }
    });
  });

  $('btnRescan')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'rtlfree:rescan' }, () => {});
    flashButton($('btnRescan'));
  });

  $('btnReset')?.addEventListener('click', async () => {
    if (!confirm('إعادة جميع الإعدادات إلى الافتراضية؟')) return;
    settings = { ...DEFAULTS };
    await new Promise(r => chrome.storage.sync.set({ [STORAGE_KEY]: settings }, r));
    renderAll();
  });

  $('btnOptions')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function isSiteActive() {
  if (!currentHost) return false;
  return (settings.enabledSites || []).some(p =>
    currentHost === p || currentHost.endsWith('.' + p)
  );
}

function toggleCurrentSite() {
  if (!currentHost) return;
  const set = new Set(settings.enabledSites || []);
  if (set.has(currentHost)) set.delete(currentHost);
  else set.add(currentHost);
  settings.enabledSites = [...set];
  saveSettings();
  renderState();
}

// ============================================================
// العرض
// ============================================================

function toggleCustomFont() {
  const box = $('customFontBox');
  if (!box) return;
  box.hidden = settings.fontFamily !== '__custom__';
}

// ============================================================
// كاشف خطوط النظام (Local Font Access API + Canvas fallback)
// ============================================================

function isFontInstalled(fontName) {
  const testStr = 'mWMwLORDdeck ابتثجحخدذرز 1234567890';
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  // قاعدة المقارنة: نرسم بخط fallback ونقيس عرضه
  ctx.font = '72px monospace';
  const w1 = ctx.measureText(testStr).width;
  ctx.font = '72px sans-serif';
  const w2 = ctx.measureText(testStr).width;
  ctx.font = '72px serif';
  const w3 = ctx.measureText(testStr).width;

  // الآن نرسم بالخط المطلوب مع fallback — إن كان الخط مُثبَّتًا ستختلف النتيجة
  ctx.font = `72px "${fontName}", monospace`;
  const t1 = ctx.measureText(testStr).width;
  ctx.font = `72px "${fontName}", sans-serif`;
  const t2 = ctx.measureText(testStr).width;
  ctx.font = `72px "${fontName}", serif`;
  const t3 = ctx.measureText(testStr).width;

  return (t1 !== w1) || (t2 !== w2) || (t3 !== w3);
}

async function detectSystemFonts() {
  const btn = $('btnDetectFonts');
  const box = $('detectedFonts');
  const hint = $('detectHint');
  if (!btn || !box) return;

  btn.disabled = true;
  btn.textContent = 'جارٍ الاكتشاف...';
  hint.textContent = 'يتم الآن فحص الخطوط المثبّتة على جهازك...';

  let fonts = [];

  // المحاولة الأولى: Local Font Access API (الأدق)
  try {
    if ('queryLocalFonts' in window) {
      const list = await window.queryLocalFonts();
      fonts = [...new Set(list.map(f => f.family))];
    }
  } catch (e) {
    // الإذن مرفوض أو غير متاح
  }

  // المحاولة الثانية: Canvas detection (تعمل دائمًا)
  if (fonts.length === 0) {
    fonts = SYSTEM_ARABIC_FONTS.filter(isFontInstalled);
  }

  fonts.sort((a, b) => a.localeCompare(b, 'ar'));

  renderDetectedFonts(fonts);

  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
    إعادة
  `;
  hint.textContent = `تم العثور على ${fonts.length} خط · انقر أيّ خط لاستخدامه`;
}

function sanitizeFontName(name) {
  return String(name || '').replace(/[^\p{L}\p{N} \-_]/gu, '').trim().slice(0, 80);
}

function renderDetectedFonts(fonts) {
  const box = $('detectedFonts');
  if (!box) return;

  box.hidden = false;
  box.textContent = '';

  if (fonts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'detect-empty';
    empty.textContent = 'لم يُعثر على خطوط. جرّب إدخال اسم الخط يدويًا.';
    box.appendChild(empty);
    return;
  }

  for (const rawName of fonts) {
    const name = sanitizeFontName(rawName);
    if (!name) continue;

    const chip = document.createElement('button');
    chip.className = 'font-chip';
    chip.dataset.font = name;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'font-chip-name';
    nameSpan.textContent = name;

    const previewSpan = document.createElement('span');
    previewSpan.className = 'font-chip-preview';
    previewSpan.style.setProperty('font-family', `"${name}"`);
    previewSpan.textContent = 'أبج ١٢٣';

    chip.appendChild(nameSpan);
    chip.appendChild(previewSpan);

    chip.addEventListener('click', () => {
      settings.customFontName = name;
      $('customFontName').value = name;
      saveSettings();
      updatePreview();
      highlightActiveChip();
    });
    box.appendChild(chip);
  }

  highlightActiveChip();
}

function highlightActiveChip() {
  const current = (settings.customFontName || '').trim().toLowerCase();
  document.querySelectorAll('.font-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.font.toLowerCase() === current);
  });
}

function renderAll() {
  renderState();
  $('fontFamily').value = settings.fontFamily;
  if ($('customFontName')) $('customFontName').value = settings.customFontName || '';
  toggleCustomFont();
  $('fontSize').value = settings.fontSize;
  $('fontSizeVal').textContent = settings.fontSize + '%';
  $('lineHeight').value = settings.lineHeight;
  $('lineHeightVal').textContent = settings.lineHeight.toFixed(1);
  $('letterSpacing').value = settings.letterSpacing;
  $('letterSpacingVal').textContent = settings.letterSpacing.toFixed(2);
  $('fontWeight').value = settings.fontWeight;
  $('fontWeightVal').textContent = settings.fontWeight;
  $('forceRTL').checked = settings.forceRTL;
  $('hideTashkeel').checked = settings.hideTashkeel;
  $('fixInputs').checked = settings.fixInputs;
  const numRadio = document.querySelector(`input[name="numerals"][value="${settings.convertNumerals}"]`);
  if (numRadio) numRadio.checked = true;

  renderSiteLabel();
  markActiveSize();
  updatePreview();
}

function renderSiteLabel() {
  const label = currentHost || 'صفحة داخلية';
  const el = $('currentSite');
  if (el) el.textContent = label;
}

function renderState() {
  const active = isSiteActive();
  document.body.classList.toggle('state-on', active);
  document.body.classList.toggle('state-off', !active);

  const title = $('toggleTitle');
  const sub = $('toggleSub');
  if (active) {
    title.textContent = 'مُفعَّل على هذا الموقع';
    sub.textContent = 'اضغط للتعطيل';
  } else {
    title.textContent = 'تفعيل على هذا الموقع';
    sub.textContent = currentHost ? 'اضغط لتشغيل RTL Free هنا' : 'افتح موقعًا لتفعيل الإضافة';
  }
  renderSiteLabel();
}

function markActiveSize() {
  document.querySelectorAll('.size-btn').forEach(btn => {
    const size = parseInt(btn.dataset.size, 10);
    btn.classList.toggle('active', size === settings.fontSize);
  });
}

function effectiveFont() {
  if (settings.fontFamily === '__custom__') {
    return (settings.customFontName || '').trim();
  }
  if (settings.fontFamily === 'site' || settings.fontFamily === 'system-ui') return '';
  return settings.fontFamily;
}

function updatePreview() {
  const preview = $('preview');
  if (!preview) return;
  const f = effectiveFont();
  preview.style.fontFamily = f
    ? `"${f}", "Segoe UI Arabic", system-ui, sans-serif`
    : 'system-ui, "Segoe UI Arabic", Tahoma, sans-serif';
  preview.style.fontWeight = settings.fontWeight;
  preview.style.lineHeight = settings.lineHeight;
  preview.style.letterSpacing = settings.letterSpacing + 'em';
}

function loadPreviewFonts() {
  const families = PREVIEW_FONTS.map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;700`).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);

  const opts = $('fontFamily').querySelectorAll('option');
  opts.forEach(opt => {
    if (PREVIEW_FONTS.includes(opt.value)) {
      opt.style.fontFamily = `"${opt.value}"`;
    }
  });
}

function flashButton(btn) {
  btn.style.transform = 'scale(0.96)';
  btn.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(139,92,246,0.2))';
  setTimeout(() => {
    btn.style.transform = '';
    btn.style.background = '';
  }, 200);
}

// ============================================================
// البدء
// ============================================================

init();
