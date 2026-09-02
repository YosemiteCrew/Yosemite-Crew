'use strict';
(function () {
  const yc = globalThis.ycDesktop;
  if (!yc) return;

  let docs = [];
  let filtered = [];
  let selectedId = null;
  let loadTimer = null;

  const el = function (id) {
    return document.getElementById(id);
  };
  const encBadge = el('encBadge');
  const docCountEl = el('docCount');
  const sizeInfoEl = el('sizeInfo');
  const searchInput = el('searchInput');
  const searchCount = el('searchCount');
  const docList = el('docList');
  const loadingMsg = el('loadingMsg');
  const emptyMsg = el('emptyMsg');
  const dropZone = el('dropZone');
  const previewPanel = el('previewPanel');
  const previewTitle = el('previewTitle');
  const previewBody = el('previewBody');
  const previewImg = el('previewImg');
  const previewText = el('previewText');
  const previewMeta = el('previewMeta');
  const previewExport = el('previewExport');
  const previewReveal = el('previewReveal');
  const previewDel = el('previewDel');
  const previewClose = el('previewClose');

  const formatBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = function (ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fileIcon = function (mime) {
    if (mime.startsWith('image/')) return '\u{1F5BC}';
    if (/^text\/|^application\/(json|xml|javascript)/.test(mime)) return '\u{1F4DD}';
    if (/pdf/.test(mime)) return '\u{1F4D1}';
    if (/spreadsheet|excel|csv/.test(mime)) return '\u{1F4CA}';
    return '\u{1F4C4}';
  };

  const isImage = function (mime) {
    return mime.startsWith('image/');
  };

  const loadStats = function () {
    /*
     * Reset to the neutral state before asking. `.badge` on its own is the green
     * completed treatment, so leaving it alone would render a GREEN "checking…"
     * on every load - and keep it green indefinitely if the request fails.
     */
    badgeEncryption(undefined);
    yc.vaultStats().then(function (res) {
      if (!res?.ok || !res.stats) return;
      const stats = res.stats;
      docCountEl.textContent = stats.count + ' document' + (stats.count === 1 ? '' : 's');
      sizeInfoEl.textContent = formatBytes(stats.totalSizeBytes || 0);
      badgeEncryption(res.encryptionAvailable);
    });
    yc.getAppVersion().then(function () {
      // Get encryption status from vault-stats (we don't have a separate info channel)
      // The badge shows whether encryption is available from preload
    });
    // Best-effort: check if vault-save works to infer readiness
  };

  /*
   * The encryption badge states what the main process reports, and nothing when
   * it has not reported yet.
   *
   * It used to read a hardcoded green "OS keychain" on the reasoning that
   * safeStorage is almost always available on macOS. That is a probability, not
   * a fact: the Linux AppImage and deb builds depend on a keyring, and without
   * one the vault refuses every write (ENCRYPTION_UNAVAILABLE) while the badge
   * still claimed the documents were encrypted. The same app already prints the
   * truth in Data > Document Vault Info, so the two surfaces disagreed.
   */
  const badgeEncryption = function (encryptionAvailable) {
    if (encryptionAvailable === true) {
      encBadge.textContent = 'OS keychain';
      encBadge.className = 'badge';
      encBadge.removeAttribute('title');
      return;
    }
    if (encryptionAvailable === false) {
      /*
       * "Encryption unavailable", not "Not encrypted". This describes the
       * keychain's CURRENT capability, which is the only thing the flag knows.
       * Documents stored while the keychain was available stay encrypted on
       * disk - losing access blocks new writes, it does not decrypt anything -
       * so calling the vault "not encrypted" would misstate the files already
       * in it, which is the same class of false claim this badge is here to
       * stop making.
       */
      encBadge.textContent = 'Encryption unavailable';
      encBadge.className = 'badge badge-warn';
      encBadge.title =
        'The OS keychain is unavailable, so the vault cannot store new documents. Documents saved earlier remain encrypted on disk.';
      return;
    }
    // Unknown: say so rather than guessing either way.
    encBadge.textContent = 'checking\u2026';
    encBadge.className = 'badge badge-unknown';
    encBadge.removeAttribute('title');
  };

  const filterDocs = function () {
    const q = searchInput.value.toLowerCase().trim();
    let list = docs;
    if (q) {
      list = docs.filter(function (d) {
        return d.filename.toLowerCase().includes(q);
      });
    }
    filtered = list;
    searchCount.textContent =
      filtered.length < docs.length ? filtered.length + '/' + docs.length : '';
    renderList(filtered);
  };

  const renderList = function (list) {
    const frag = document.createDocumentFragment();
    for (const d of list) {
      const div = document.createElement('div');
      div.className = 'doc' + (d.id === selectedId ? ' selected' : '');
      div.dataset.id = d.id;

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.textContent = fileIcon(d.mimeType);
      if (isImage(d.mimeType)) {
        // Load thumbnail on demand
        yc.vaultGet(d.id).then(function (res) {
          if (!res?.ok || !res.content) return;
          const buf = res.content;
          const blob = new Blob([new Uint8Array(buf.data || buf)], {
            type: d.mimeType,
          });
          const url = URL.createObjectURL(blob);
          const img = document.createElement('img');
          img.src = url;
          img.onload = function () {
            URL.revokeObjectURL(url);
          };
          thumb.textContent = '';
          thumb.appendChild(img);
        });
      }

      const body = document.createElement('div');
      body.className = 'doc-body';
      const name = document.createElement('div');
      name.className = 'doc-name';
      name.textContent = d.filename;
      const meta = document.createElement('div');
      meta.className = 'doc-meta';
      meta.textContent = formatBytes(d.sizeBytes) + ' \u00B7 ' + formatDate(d.createdAt);
      body.appendChild(name);
      body.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'doc-actions';
      const viewBtn = document.createElement('button');
      viewBtn.className = 'view';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openPreview(d.id);
      });
      actions.appendChild(viewBtn);

      const expBtn = document.createElement('button');
      expBtn.textContent = 'Export';
      expBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        exportDoc(d.id);
      });
      actions.appendChild(expBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'del';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteDoc(d.id);
      });
      actions.appendChild(delBtn);

      div.appendChild(thumb);
      div.appendChild(body);
      div.appendChild(actions);
      div.addEventListener('click', function () {
        openPreview(d.id);
      });
      frag.appendChild(div);
    }
    docList.innerHTML = '';
    docList.appendChild(frag);
    loadingMsg.style.display = 'none';
    emptyMsg.style.display = list.length === 0 ? 'flex' : 'none';
  };

  // Throttled load
  const scheduleLoad = function () {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(loadDocs, 50);
  };

  const loadDocs = function () {
    loadingMsg.style.display = 'block';
    yc.vaultList().then(function (res) {
      if (!res?.ok) {
        loadingMsg.textContent = 'Failed to load vault.';
        return;
      }
      docs = (res.documents || []).sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
      loadStats();
      filterDocs();
    });
  };

  const openPreview = function (id) {
    selectedId = id;
    previewPanel.classList.add('open');
    previewBody.scrollTop = 0;
    previewTitle.textContent = 'Loading…';
    previewImg.style.display = 'none';
    previewText.style.display = 'none';
    previewMeta.innerHTML = '';

    const doc = docs.find(function (d) {
      return d.id === id;
    });
    if (!doc) return;
    previewTitle.textContent = doc.filename;

    // Build the metadata list with text nodes so persisted fields such as
    // doc.mimeType cannot inject markup into this file:// page.
    const dl = document.createElement('dl');
    const addMetaRow = function (label, value) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    addMetaRow('Type', doc.mimeType || 'unknown');
    addMetaRow('Size', formatBytes(doc.sizeBytes));
    addMetaRow('Added', formatDate(doc.createdAt));
    if (doc.updatedAt !== doc.createdAt) addMetaRow('Updated', formatDate(doc.updatedAt));
    previewMeta.innerHTML = '';
    previewMeta.appendChild(dl);

    if (isImage(doc.mimeType)) {
      yc.vaultGet(id).then(function (res) {
        if (!res?.ok || !res.content) return;
        const buf = res.content;
        const blob = new Blob([new Uint8Array(buf.data || buf)], {
          type: doc.mimeType,
        });
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.display = 'block';
        previewImg.onload = function () {
          URL.revokeObjectURL(url);
        };
      });
    } else {
      yc.vaultGet(id).then(function (res) {
        if (!res?.ok || !res.content) return;
        const buf = res.content;
        const decoder = new TextDecoder('utf-8');
        let text;
        try {
          text = decoder.decode(new Uint8Array(buf.data || buf));
        } catch {
          text = 'Binary content. Use Export to save to disk.';
        }
        previewText.textContent = text.substring(0, 10000);
        previewText.style.display = 'block';
      });
    }

    previewExport.onclick = function () {
      exportDoc(id);
    };
    previewReveal.onclick = function () {
      revealDoc(id);
    };
    previewDel.onclick = function () {
      deleteDoc(id);
    };
  };

  const closePreview = function () {
    previewPanel.classList.remove('open');
    selectedId = null;
    previewImg.src = '';
  };

  const exportDoc = function (id) {
    yc.vaultExport(id).then(function (res) {
      if (!res?.ok) return;
      if (res.path) {
        // Show a brief success; the file was written
        // Refresh list to keep UI consistent
      }
    });
  };

  const revealDoc = function (id) {
    yc.vaultRevealDoc(id).catch(function () {});
  };

  const deleteDoc = function (id) {
    const doc = docs.find(function (d) {
      return d.id === id;
    });
    if (!doc) return;
    if (!globalThis.confirm('Delete "' + doc.filename + '" from the vault?')) return;
    yc.vaultDelete(id).then(function (res) {
      if (!res?.ok) return;
      if (selectedId === id) closePreview();
      scheduleLoad();
    });
  };

  // ── Drag & drop ──
  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (const f of files) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        const result = evt.target.result;
        const commaIdx = result.indexOf(',');
        const base64 = commaIdx >= 0 ? result.substring(commaIdx + 1) : result;
        yc.vaultSaveBuffer(f.name, base64, f.type || 'application/octet-stream').then(
          function (res) {
            if (res?.ok) scheduleLoad();
          }
        );
      };
      reader.readAsDataURL(f);
    }
  };

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', handleDrop);

  // Without window-level handlers, dropping a file anywhere outside the small
  // drop zone makes Chromium navigate the window to that file (file://...),
  // replacing the vault UI — which looks like the vault "not working". Prevent
  // the default across the whole window and accept drops anywhere. Drops on the
  // drop zone call stopPropagation above, so they are never handled twice.
  globalThis.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  globalThis.addEventListener('drop', function (e) {
    e.preventDefault();
    handleDrop(e);
  });

  // ── Search ──
  searchInput.addEventListener('input', filterDocs);

  // ── Preview close ──
  previewClose.addEventListener('click', closePreview);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePreview();
  });

  // ── Init ──

  scheduleLoad();
})();
