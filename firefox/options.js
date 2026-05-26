/**
 * RTL Free — Options Page Logic
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

const FONTS = [
  { value: 'site', label: 'خط الموقع الافتراضي (بدون تغيير)', google: false },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic', google: true },
  { value: 'Tajawal', label: 'Tajawal — تجوّل', google: true },
  { value: 'Amiri', label: 'Amiri — أميري', google: true },
  { value: 'Vazirmatn', label: 'Vazirmatn — وزیرمتن', google: true },
  { value: '__custom__', label: '— خط مخصّص من النظام —', google: false }
];

const SYSTEM_ARABIC_FONTS = [
  'Sakkal Majalla', 'Traditional Arabic', 'Simplified Arabic',
  'Arabic Typesetting', 'Aldhabi', 'Andalus', 'Urdu Typesetting',
  'Microsoft Uighur', 'Microsoft Sans Serif',
  'Segoe UI', 'Segoe UI Arabic', 'Segoe UI Historic',
  'Tahoma', 'Arial', 'Arial Unicode MS', 'Times New Roman',
  'Courier New', 'Georgia', 'Verdana', 'Calibri',
  'Dubai', 'Dubai Light', 'Dubai Medium', 'Dubai Bold',
  'Geeza Pro', 'Baghdad', 'Al Bayan', 'Damascus', 'DecoType Naskh',
  'Farah', 'Farisi', 'Kufi Standard GK', 'Mishafi', 'Muna',
  'Nadeem', 'Nader Book', 'Sana', 'Scheherazade', 'KufiStandardGK',
  'GeezaPro', 'AlBayan', 'Helvetica', 'Helvetica Neue',
  'DejaVu Sans', 'Liberation Sans', 'Noto Sans', 'Noto Sans Arabic',
  'Noto Naskh Arabic', 'Noto Kufi Arabic', 'Noto Nastaliq Urdu',
  'Droid Arabic Naskh', 'Droid Arabic Kufi',
  'KacstOne', 'KacstBook', 'KacstTitle', 'KacstArt',
  'Cairo', 'Tajawal', 'Amiri', 'IBM Plex Sans Arabic', 'Vazirmatn',
  'Almarai', 'Readex Pro', 'Reem Kufi', 'Changa', 'Mada',
  'Alexandria', 'El Messiri', 'Markazi Text', 'Harmattan',
  'Scheherazade New', 'Lateef', 'Aref Ruqaa', 'Amiri Quran',
  'Mirza', 'Jomhuria', 'Lalezar', 'Rakkas', 'Gulzar',
  'Katibeh', 'Kufam', 'Lemonada', 'Blaka', 'Qahiri'
];

let settings = { ...DEFAULTS };
let saveTimer = null;

// ============================================================
// التهيئة
// ============================================================

async function init() {
  await loadSettings();
  populateFontSelect();
  loadAllFonts();
  bindTabs();
  bindSettings();
  bindTagInputs();
  bindBackup();
  checkWelcome();
  renderAll();
}

function $(id) { return document.getElementById(id); }

async function loadSettings() {
  return new Promise(r => {
    chrome.storage.sync.get(STORAGE_KEY, data => {
      settings = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
      r();
    });
  });
}

function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
      showToast('تم الحفظ', 'success');
    });
  }, 250);
}

function showToast(message, type = '') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.className = 'toast';
  }, 1800);
}

// ============================================================
// التبويبات
// ============================================================

function bindTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + name);
  });
}

// ============================================================
// الخطوط
// ============================================================

function populateFontSelect() {
  const select = $('fontFamily');
  if (!select) return;
  select.innerHTML = '';
  for (const f of FONTS) {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = f.label;
    if (f.google) opt.style.fontFamily = `"${f.value}"`;
    select.appendChild(opt);
  }
}

function loadAllFonts() {
  const all = FONTS.filter(f => f.google).map(f => f.value);
  const families = all.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800`).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

// ============================================================
// ربط الإعدادات
// ============================================================

function bindSettings() {
  // عامة
  bindCheckbox('autoDetect');
  bindCheckbox('forceRTL');
  bindCheckbox('fixInputs');
  bindCheckbox('fixCode');
  bindCheckbox('smoothFonts');
  bindCheckbox('hideTashkeel');

  // الخط
  $('fontFamily').addEventListener('change', e => {
    settings.fontFamily = e.target.value;
    toggleCustomFontBox();
    updatePreview();
    saveSettings();
  });

  $('customFontName')?.addEventListener('input', e => {
    settings.customFontName = e.target.value.trim();
    updatePreview();
    saveSettings();
    highlightActiveChip();
  });

  $('btnDetectFonts')?.addEventListener('click', detectSystemFonts);

  // النطاقات
  bindRange('fontSize', '%', v => parseInt(v, 10));
  bindRange('fontWeight', '', v => parseInt(v, 10));
  bindRange('lineHeight', '', v => parseFloat(v).toFixed(1), v => parseFloat(v));
  bindRange('letterSpacing', '', v => parseFloat(v).toFixed(2), v => parseFloat(v));

  // الأرقام
  document.querySelectorAll('input[name="numerals"]').forEach(r => {
    r.addEventListener('change', e => {
      if (e.target.checked) {
        settings.convertNumerals = e.target.value;
        saveSettings();
      }
    });
  });

}

function bindCheckbox(id) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('change', () => {
    settings[id] = el.checked;
    saveSettings();
  });
}

function bindRange(id, suffix, display, parse) {
  const el = $(id);
  const label = $(id + 'Val');
  if (!el) return;
  display = display || (v => v);
  parse = parse || (v => parseFloat(v));
  el.addEventListener('input', () => {
    const val = parse(el.value);
    settings[id] = val;
    if (label) label.textContent = display(el.value) + suffix;
    updatePreview();
    saveSettings();
  });
}

// ============================================================
// المعاينة
// ============================================================

function effectiveFont() {
  if (settings.fontFamily === '__custom__') {
    return (settings.customFontName || '').trim();
  }
  if (settings.fontFamily === 'site' || settings.fontFamily === 'system-ui') return '';
  return settings.fontFamily;
}

function toggleCustomFontBox() {
  const box = $('customFontBox');
  if (!box) return;
  box.hidden = settings.fontFamily !== '__custom__';
}

// ============================================================
// كاشف خطوط النظام
// ============================================================

function isFontInstalled(fontName) {
  const testStr = 'mWMwLORDdeck ابتثجحخدذ 1234567890';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.font = '72px monospace';
  const w1 = ctx.measureText(testStr).width;
  ctx.font = '72px sans-serif';
  const w2 = ctx.measureText(testStr).width;
  ctx.font = '72px serif';
  const w3 = ctx.measureText(testStr).width;

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
  btn.textContent = 'جارٍ الفحص...';
  hint.textContent = 'يتم الآن فحص الخطوط المثبّتة على جهازك...';

  let fonts = [];

  try {
    if ('queryLocalFonts' in window) {
      const list = await window.queryLocalFonts();
      fonts = [...new Set(list.map(f => f.family))];
    }
  } catch (e) { /* permission denied */ }

  if (fonts.length === 0) {
    fonts = SYSTEM_ARABIC_FONTS.filter(isFontInstalled);
  }

  fonts.sort((a, b) => a.localeCompare(b, 'ar'));
  renderDetectedFonts(fonts);

  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
    إعادة الاكتشاف
  `;
  hint.textContent = `تم العثور على ${fonts.length} خط · انقر أيّ خط لاستخدامه`;
  showToast(`اكتُشف ${fonts.length} خطًا`, 'success');
}

function sanitizeFontName(name) {
  // يسمح فقط بالحروف والأرقام والمسافة والشرطة — يمنع CSS injection
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
    chip.type = 'button';
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
      updatePreview();
      saveSettings();
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

function updatePreview() {
  const pv = $('previewLarge');
  if (!pv) return;
  const f = effectiveFont();
  pv.style.fontFamily = f
    ? `"${f}", "Segoe UI Arabic", system-ui, sans-serif`
    : 'system-ui, "Segoe UI Arabic", Tahoma, sans-serif';
  pv.style.fontWeight = settings.fontWeight;
  pv.style.lineHeight = settings.lineHeight;
  pv.style.letterSpacing = settings.letterSpacing + 'em';
  pv.style.fontSize = settings.fontSize + '%';
}

// ============================================================
// إدارة المواقع (tags)
// ============================================================

function bindTagInputs() {
  setupTagInput('enabledSiteInput', 'enabledSitesBox', 'enabledSites');
}

function setupTagInput(inputId, containerId, settingKey) {
  const input = $(inputId);
  const container = $(containerId);
  if (!input || !container) return;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      if (val && !settings[settingKey].includes(val)) {
        settings[settingKey] = [...settings[settingKey], val];
        saveSettings();
        renderTags(containerId, settingKey, inputId);
      }
      input.value = '';
    }
  });
}

function renderTags(containerId, settingKey, inputId) {
  const container = $(containerId);
  const input = $(inputId);
  if (!container) return;
  container.querySelectorAll('.tag').forEach(t => t.remove());
  const list = settings[settingKey] || [];
  for (const site of list) {
    const tag = document.createElement('span');
    tag.className = 'tag';

    const label = document.createElement('span');
    label.textContent = site;

    const del = document.createElement('button');
    del.setAttribute('aria-label', 'حذف');
    del.textContent = '✕';
    del.addEventListener('click', () => {
      settings[settingKey] = settings[settingKey].filter(s => s !== site);
      saveSettings();
      renderTags(containerId, settingKey, inputId);
    });

    tag.appendChild(label);
    tag.appendChild(del);
    container.insertBefore(tag, input);
  }
}

// ============================================================
// النسخ الاحتياطي
// ============================================================

function bindBackup() {
  $('btnExport')?.addEventListener('click', exportSettings);
  $('btnImport')?.addEventListener('click', () => $('fileImport').click());
  $('fileImport')?.addEventListener('change', importSettings);
  $('btnResetAll')?.addEventListener('click', resetAll);
}

function exportSettings() {
  const data = JSON.stringify({
    _version: 1,
    _exported: new Date().toISOString(),
    settings
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rtlfree-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم التصدير بنجاح', 'success');
}

async function importSettings(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const imported = data.settings || data;
    settings = { ...DEFAULTS, ...imported };
    await new Promise(r => chrome.storage.sync.set({ [STORAGE_KEY]: settings }, r));
    renderAll();
    showToast('تم الاستيراد بنجاح', 'success');
  } catch (err) {
    showToast('ملف غير صالح', 'error');
  }
  e.target.value = '';
}

async function resetAll() {
  if (!confirm('هل أنت متأكد؟ سيتم حذف جميع الإعدادات والعودة للافتراضي.')) return;
  settings = { ...DEFAULTS };
  await new Promise(r => chrome.storage.sync.set({ [STORAGE_KEY]: settings }, r));
  renderAll();
  showToast('تمت إعادة التعيين', 'success');
}

// ============================================================
// الترحيب
// ============================================================

function checkWelcome() {
  const params = new URLSearchParams(location.search);
  if (params.get('welcome') === '1') {
    $('welcome').classList.remove('hidden');
  }
  $('btnStartUsing')?.addEventListener('click', () => {
    $('welcome').classList.add('hidden');
    history.replaceState({}, '', location.pathname);
  });
}

// ============================================================
// العرض
// ============================================================

function renderAll() {
  // checkboxes
  ['autoDetect', 'forceRTL', 'fixInputs', 'fixCode', 'smoothFonts', 'hideTashkeel']
    .forEach(k => { const el = $(k); if (el) el.checked = settings[k]; });

  // font
  $('fontFamily').value = settings.fontFamily;
  if ($('customFontName')) $('customFontName').value = settings.customFontName || '';
  toggleCustomFontBox();

  // ranges
  setRange('fontSize', settings.fontSize, v => v + '%');
  setRange('fontWeight', settings.fontWeight, v => v);
  setRange('lineHeight', settings.lineHeight, v => Number(v).toFixed(1));
  setRange('letterSpacing', settings.letterSpacing, v => Number(v).toFixed(2));

  // numerals
  const r = document.querySelector(`input[name="numerals"][value="${settings.convertNumerals}"]`);
  if (r) r.checked = true;

  // tags
  renderTags('enabledSitesBox', 'enabledSites', 'enabledSiteInput');

  updatePreview();
}

function setRange(id, value, display) {
  const el = $(id);
  const label = $(id + 'Val');
  if (el) el.value = value;
  if (label) label.textContent = display(value);
}

// ============================================================
// البدء
// ============================================================

document.addEventListener('DOMContentLoaded', init);
