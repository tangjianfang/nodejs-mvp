/**
 * tray.js — 系统托盘管理
 */
'use strict';
const SysTray = require('systray2').default;
const path    = require('path');
const { openBrowser } = require('./browser');

let systray = null;
let _url    = 'http://localhost:3000';

/**
 * 启动托盘图标（async，等待原生进程就绪后再绑定事件）
 * @param {string}   url     点击"打开界面"时访问的地址
 * @param {Function} onQuit  点击"退出"时的回调
 */
async function startTray(url, onQuit) {
  _url = url;

  // SEA 模式下切换 CWD 到 exe 目录，使 systray2 能找到 ./traybin/
  let _isSEA = false;
  try { _isSEA = require('node:sea').isSea(); } catch {}
  if (_isSEA) {
    process.chdir(path.dirname(process.execPath));
    console.log('[tray] SEA 模式，CWD →', process.cwd());
  }

  let icon;
  try {
    icon = require('../assets/icon-b64.js');
  } catch {
    icon = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
           'AABjkB6QAAAABJRU5ErkJggg==';
  }

  systray = new SysTray({
    menu: {
      icon,
      title:   '',
      tooltip: `Node Lab — ${url}`,
      items: [
        { title: '🌐  打开界面', tooltip: url,           checked: false, enabled: true },
        SysTray.separator,
        { title: '🔴  退出',     tooltip: '停止服务并退出', checked: false, enabled: true },
      ],
    },
    debug:   false,
    copyDir: false,  // 使用 __dirname/traybin（SEA 下即 exe 目录/traybin）
  });

  // ── 必须等到原生进程就绪后再绑定 onClick / onError ──────────────────────
  try {
    await systray.ready();
  } catch (err) {
    console.error('[tray] 原生托盘进程启动失败:', err.message);
    console.warn('[tray] 将在无托盘模式下继续运行（Ctrl+C 或任务管理器退出）');
    return;
  }

  systray.onClick(action => {
    switch (action.seq_id) {
      case 0: openBrowser(_url); break;  // 打开界面
      case 2:                             // 退出
        systray.kill(false);
        if (typeof onQuit === 'function') onQuit();
        break;
    }
  });

  systray.onError(err => {
    console.error('[tray] 运行时错误:', err.message);
  });

  console.log('[tray] 托盘图标已启动');
}

function setUrl(url) { _url = url; }

module.exports = { startTray, setUrl };
