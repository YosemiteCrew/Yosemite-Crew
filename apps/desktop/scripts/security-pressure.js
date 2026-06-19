'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  classifyNavigation,
  deepLinkToUrl,
  getDesktopConfig,
  isAllowedInAppPopup,
} = require('../build/core/navigation-policy');
const { validateIpcRequest } = require('../build/core/ipc');

const config = getDesktopConfig({});
const localRoot = path.join(__dirname, '..', 'build');
const localUrl = pathToFileURL(path.join(localRoot, 'offline.html')).href;

for (const payload of [
  'file:///etc/passwd',
  'javascript:alert(1)',
  'data:text/html,pwned',
  'http://[',
]) {
  assert.notEqual(classifyNavigation(payload, config).disposition, 'internal', payload);
}

assert.equal(deepLinkToUrl('yosemitecrew://developers/home', config), null);
assert.equal(deepLinkToUrl('yosemitecrew://dev-docs/', config), null);
assert.equal(isAllowedInAppPopup('https://example.com/phish', config), false);
assert.equal(isAllowedInAppPopup('https://cdn.yc.dev/document.pdf', config), true);

assert.deepEqual(
  validateIpcRequest({ senderFrame: { url: localUrl } }, 'yc:reload', [], config, localRoot),
  { ok: true }
);
assert.deepEqual(
  validateIpcRequest(
    { senderFrame: { url: 'yosemitecrew-desktop://offline/' } },
    'yc:reload',
    [],
    config,
    localRoot
  ),
  { ok: true }
);
assert.equal(
  validateIpcRequest(
    { senderFrame: { url: 'yosemitecrew-desktop://resources/icon.png' } },
    'yc:reload',
    [],
    config,
    localRoot
  ).ok,
  false
);
assert.equal(
  validateIpcRequest(
    { senderFrame: { url: 'file:///tmp/offline.html' } },
    'yc:reload',
    [],
    config,
    localRoot
  ).ok,
  false
);
assert.equal(
  validateIpcRequest(
    { senderFrame: { url: localUrl } },
    'yc:reload',
    ['unexpected'],
    config,
    localRoot
  ).ok,
  false
);

console.log('Desktop security pressure checks passed.');
