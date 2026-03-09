/**
 * browser.js — 打开/聚焦浏览器
 */
'use strict';
const { exec } = require('child_process');

const COMMANDS = {
  win32:  url => `start ${url}`,
  darwin: url => `open ${url}`,
  linux:  url => `xdg-open ${url}`,
};

function openBrowser(url) {
  const fn = COMMANDS[process.platform];
  if (!fn) { console.warn('[browser] 不支持的平台，请手动打开:', url); return; }
  exec(fn(url), err => {
    if (err) console.error('[browser] 打开失败:', err.message);
    else console.log('[browser] 已打开:', url);
  });
}

module.exports = { openBrowser };
