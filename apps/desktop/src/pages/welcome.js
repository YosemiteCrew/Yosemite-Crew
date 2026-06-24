(function () {
  const track = document.getElementById('track');
  const dotsEl = document.getElementById('dots');
  const slides = track.querySelectorAll('.slide');
  let current = 0;
  const total = slides.length;

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Slide ' + (i + 1));
    dot.addEventListener(
      'click',
      (function (idx) {
        return function () {
          goTo(idx);
        };
      })(i)
    );
    dotsEl.appendChild(dot);
  }

  function goTo(idx) {
    if (idx < 0) idx = total - 1;
    if (idx >= total) idx = 0;
    current = idx;
    track.style.transform = 'translateX(-' + idx * 100 + '%)';
    const allDots = dotsEl.querySelectorAll('.dot');
    for (let j = 0; j < total; j++) {
      allDots[j].className = 'dot' + (j === idx ? ' active' : '');
    }
  }

  let autoTimer = setInterval(function () {
    goTo(current + 1);
  }, 4000);

  track.addEventListener('mouseenter', function () {
    clearInterval(autoTimer);
  });
  track.addEventListener('mouseleave', function () {
    autoTimer = setInterval(function () {
      goTo(current + 1);
    }, 4000);
  });

  const status = document.getElementById('status');
  document.getElementById('signin').addEventListener('click', function () {
    status.textContent = 'Opening sign-in...';
    if (globalThis.ycDesktop) globalThis.ycDesktop.startSignin();
  });
  document.getElementById('browser').addEventListener('click', function () {
    if (globalThis.ycDesktop) globalThis.ycDesktop.openInBrowser();
  });

  const ctaBtn = document.getElementById('signin');
  ctaBtn.addEventListener('mousemove', function (e) {
    const r = ctaBtn.getBoundingClientRect();
    ctaBtn.style.setProperty('--cta-x', e.clientX - r.left + 'px');
    ctaBtn.style.setProperty('--cta-y', e.clientY - r.top + 'px');
  });
})();
