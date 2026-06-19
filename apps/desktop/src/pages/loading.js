'use strict';

(function () {
  const tips = [
    'Connecting to your practice…',
    'Loading your workspace securely',
    'Your session stays signed in',
    'Almost there…',
  ];
  let i = 0;
  const el = document.getElementById('tip');
  setInterval(function () {
    i = (i + 1) % tips.length;
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = tips[i];
      el.style.opacity = '1';
    }, 400);
  }, 2600);
})();
