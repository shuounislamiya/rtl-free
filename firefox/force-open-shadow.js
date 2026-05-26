/**
 * RTL Free — Force Open Shadow DOM
 * يعمل في MAIN world قبل تحميل أي سكربت من الموقع
 *
 * بعض المواقع (AI Studio، Google Docs، ...) تستخدم Closed Shadow DOM
 * ممّا يمنع الإضافات من رؤية محتواها. هذا السكربت يُجبر كل Shadow Root
 * على أن يكون open حتى تستطيع الإضافة العمل عليه.
 */

(function () {
  'use strict';

  if (window.__RTL_FREE_SHADOW_PATCHED__) return;
  window.__RTL_FREE_SHADOW_PATCHED__ = true;

  try {
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const opts = { ...(init || {}) };
      // نحفظ الوضع الأصلي لأي كود قد يتحقّق منه
      if (opts.mode === 'closed') {
        opts.mode = 'open';
      }
      const root = original.call(this, opts);
      return root;
    };
  } catch (e) {
    // لا نوقف الصفحة إن فشلنا
  }
})();
