/**
 * main.js — 程序入口
 *
 * 启动流程：
 *   1. 单实例检测（已有实例 → 发 open 信号 → 退出）
 *   2. 启动所有子服务进程（process-mgr）
 *   3. 等待 web 服务就绪（监听 PORT 端口）
 *   4. 启动系统托盘
 *   5. 打开默认浏览器
 *
 * 环境变量：
 *   PORT  — web 服务端口，默认 3000
 *   DEV   — 设为 1 时跳过托盘（终端直接运行）
 */
'use strict';
const { tryLock }    = require('./instance-lock');
const processMgr     = require('./process-mgr');
const { startTray }  = require('./tray');
const { openBrowser } = require('./browser');

const PORT = process.env.PORT || 3000;
const URL  = `http://localhost:${PORT}`;
const IS_DEV = process.env.DEV === '1';

async function main() {
  // ── 1. 单实例检测 ───────────────────────────────────────────────────────
  const isLeader = await tryLock((msg) => {
    if (msg === 'open') {
      console.log('[main] 收到 open 指令，打开浏览器');
      openBrowser(URL);
    }
  });

  if (!isLeader) {
    console.log('[main] 已有实例在运行，浏览器已被唤起，本进程退出');
    // 给信号发送留一点时间
    setTimeout(() => process.exit(0), 500);
    return;
  }

  // ── 2. 启动子服务进程 ────────────────────────────────────────────────────
  processMgr.startAll();

  // ── 3. 等待 web 服务启动（轮询端口）────────────────────────────────────
  console.log(`[main] 等待 web 服务在端口 ${PORT} 就绪...`);
  await waitForPort(PORT, 10000);
  console.log(`[main] web 服务就绪：${URL}`);

  // ── 4. 系统托盘 ─────────────────────────────────────────────────────────
  if (!IS_DEV) {
    await startTray(URL, () => shutdown());
  } else {
    console.log('[main] DEV 模式，跳过托盘（Ctrl+C 退出）');
  }

  // ── 5. 打开浏览器 ────────────────────────────────────────────────────────
  openBrowser(URL);

  // ── 信号处理 ─────────────────────────────────────────────────────────────
  process.on('SIGINT',  () => shutdown());
  process.on('SIGTERM', () => shutdown());
}

function shutdown() {
  console.log('\n[main] 正在关闭所有服务...');
  processMgr.stopAll();
  setTimeout(() => process.exit(0), 1000);
}

// ── 工具：等待端口可用 ────────────────────────────────────────────────────
function waitForPort(port, timeout = 10000) {
  const net  = require('net');
  const start= Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeout) {
        return reject(new Error(`等待端口 ${port} 超时`));
      }
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); resolve(); });
      s.on('error',   () => { s.destroy(); setTimeout(attempt, 200); });
    }
    attempt();
  });
}

main().catch(err => {
  console.error('[main] 启动失败:', err);
  process.exit(1);
});
