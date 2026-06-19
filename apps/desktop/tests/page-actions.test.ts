import { PAGE_ACTION_TRIGGERS, buildPageActionScript } from '../src/ui/page-actions';

describe('PAGE_ACTION_TRIGGERS', () => {
  test('covers the action palette items', () => {
    expect(PAGE_ACTION_TRIGGERS['action-new-appointment'].clickText).toContain('add appointment');
    expect(PAGE_ACTION_TRIGGERS['action-find-patient'].focusSelector).toMatch(/search/i);
    expect(
      PAGE_ACTION_TRIGGERS['action-new-invoice'].clickText &&
        PAGE_ACTION_TRIGGERS['action-new-invoice'].clickText.length
    ).toBeGreaterThan(0);
    expect(PAGE_ACTION_TRIGGERS['action-check-in'].clickText).toContain('check in');
  });
});

describe('buildPageActionScript', () => {
  test('embeds lowercased click patterns and DOM scan', () => {
    const script = buildPageActionScript({
      clickText: ['Add Appointment', 'NEW appointment'],
    });
    expect(script).toContain('"add appointment"');
    expect(script).toContain('"new appointment"');
    expect(script).toContain('querySelectorAll');
    expect(script).toContain('.click()');
  });

  test('embeds the focus selector', () => {
    const script = buildPageActionScript({
      focusSelector: 'input[placeholder*="search" i]',
    });
    expect(script).toContain('input[placeholder');
    expect(script).toContain('.focus()');
  });

  test('an empty trigger still produces a runnable, self-terminating script', () => {
    const script = buildPageActionScript({});
    expect(script).toContain('attempt()');
    expect(script).toContain('deadline');
    // no patterns, no selector -> arrays/strings are empty
    expect(script).toContain('var patterns = []');
    expect(script).toContain('var focusSel = ""');
  });
});
