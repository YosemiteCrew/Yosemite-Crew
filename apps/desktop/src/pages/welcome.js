(function () {
  const policy = globalThis.ycCarouselAutoplay;
  const track = document.getElementById('track');
  const dotsEl = document.getElementById('dots');
  const toggleEl = document.getElementById('carousel-toggle');
  const carouselEl = document.getElementById('carousel');
  const slides = track.querySelectorAll('.slide');
  let current = 0;
  const total = slides.length;

  const reduceMotionQuery = globalThis.matchMedia
    ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const state = {
    reduceMotion: Boolean(reduceMotionQuery?.matches),
    paused: false,
    hovering: false,
    focusWithin: false,
  };
  let autoTimer = null;

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Slide ' + (i + 1));
    dot.addEventListener(
      'click',
      (function (idx) {
        return function () {
          // A dot press used to leave the timer running, so the slide the user
          // chose could move on a second later. Restarting gives them a full
          // interval on the slide they asked for.
          goTo(idx);
          restartTimer();
        };
      })(i)
    );
    dotsEl.appendChild(dot);
  }

  function goTo(idx) {
    current = policy.nextIndex(idx, total);
    track.style.transform = 'translateX(-' + current * 100 + '%)';
    for (let j = 0; j < total; j++) {
      // Off-screen slides are still in the document, so without this a screen
      // reader reads all five at once and the tab order runs through them.
      slides[j].inert = j !== current;
      slides[j].setAttribute('aria-hidden', j === current ? 'false' : 'true');
    }
    const allDots = dotsEl.querySelectorAll('.dot');
    for (let j = 0; j < total; j++) {
      allDots[j].className = 'dot' + (j === current ? ' active' : '');
      if (j === current) allDots[j].setAttribute('aria-current', 'true');
      else allDots[j].removeAttribute('aria-current');
    }
  }

  function stopTimer() {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function restartTimer() {
    stopTimer();
    if (!policy.shouldAdvance(state)) return;
    autoTimer = setInterval(function () {
      goTo(current + 1);
    }, policy.SLIDE_MS);
  }

  function syncToggle() {
    toggleEl.hidden = !policy.controlIsUseful(state);
    toggleEl.classList.toggle('is-paused', state.paused);
    toggleEl.setAttribute('aria-pressed', state.paused ? 'true' : 'false');
    toggleEl.setAttribute('aria-label', state.paused ? 'Play slideshow' : 'Pause slideshow');
  }

  toggleEl.addEventListener('click', function () {
    state.paused = !state.paused;
    syncToggle();
    restartTimer();
  });

  carouselEl.addEventListener('mouseenter', function () {
    state.hovering = true;
    restartTimer();
  });
  carouselEl.addEventListener('mouseleave', function () {
    state.hovering = false;
    restartTimer();
  });
  // Hovering already held the slides still; a keyboard user on the dots had no
  // equivalent and watched their target move out from under them.
  carouselEl.addEventListener('focusin', function () {
    state.focusWithin = true;
    restartTimer();
  });
  carouselEl.addEventListener('focusout', function () {
    state.focusWithin = false;
    restartTimer();
  });

  if (reduceMotionQuery?.addEventListener) {
    reduceMotionQuery.addEventListener('change', function (e) {
      state.reduceMotion = e.matches;
      syncToggle();
      restartTimer();
    });
  }

  goTo(0);
  syncToggle();
  restartTimer();

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
