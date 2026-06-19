'use strict';

// Command-palette "action" items navigate to a PIMS page and then need to
// trigger an in-page control (open a modal, focus a search box). The PIMS web
// app has no deep-link/?action= handler yet, so the desktop shell drives the UI
// by injecting a small best-effort script that polls for and clicks the matching
// control. (When the web app adds real ?action= handling this can be removed.)

export interface PageActionTrigger {
  // Click the first button/link/[role=button] whose visible text contains one
  // of these (lowercased) substrings.
  clickText?: string[];
  // Or focus the first element matching this CSS selector.
  focusSelector?: string;
}

export const PAGE_ACTION_TRIGGERS: Record<string, PageActionTrigger> = {
  'action-new-appointment': {
    clickText: ['add appointment', 'new appointment'],
  },
  'action-find-patient': { focusSelector: 'input[placeholder*="search" i]' },
  'action-new-invoice': {
    clickText: ['add invoice', 'create invoice', 'new invoice', 'add payment'],
  },
  'action-check-in': { clickText: ['check in', 'check-in', 'checkin'] },
};

// Build the injectable script. Pure (returns a string) so it can be unit tested.
// Polls for up to ~8s because the PIMS is a client-rendered SPA.
export const buildPageActionScript = (trigger: PageActionTrigger): string => {
  const patterns = JSON.stringify((trigger.clickText || []).map((s) => s.toLowerCase()));
  const focusSel = JSON.stringify(trigger.focusSelector || '');
  return `(function(){
  var patterns = ${patterns};
  var focusSel = ${focusSel};
  var deadline = Date.now() + 8000;
  function attempt(){
    try {
      if (focusSel) {
        var inp = document.querySelector(focusSel);
        if (inp) { inp.focus(); if (inp.scrollIntoView) inp.scrollIntoView({ block: 'center' }); return; }
      }
      if (patterns.length) {
        var els = Array.prototype.slice.call(document.querySelectorAll('button, a, [role=button]'));
        for (var i = 0; i < els.length; i++) {
          var txt = (els[i].textContent || '').trim().toLowerCase();
          if (!txt) continue;
          for (var j = 0; j < patterns.length; j++) {
            if (txt.indexOf(patterns[j]) !== -1) { els[i].click(); return; }
          }
        }
      }
    } catch (e) { /* ignore and retry */ }
    if (Date.now() < deadline) setTimeout(attempt, 300);
  }
  attempt();
})();`;
};
