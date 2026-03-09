/**
 * process-mgr.js — 子进程管理器
 *
 * 负责 fork/重启/关闭所有子服务进程。
 *
 * 运行模式：
 *   开发模式 (node src/main.js)  → child_process.fork(serviceFile)
 *   SEA 模式  (node-lab.exe)     → spawn(exePath, [], { env: SERVICE_ROLE=name })
 *                                  SEA 入口根据 SERVICE_ROLE 路由到对应服务
 *
 * 扩展：在 SERVICES 数组中添加新服务文件路径即可。
 */
'use strict';
const { fork, spawn } = require('child_process');
const path = require('path');

// 检测是否在 SEA 模式（自身就是 .exe，而非 node.exe 运行脚本）
let _isSEA = false;
try { _isSEA = require('node:sea').isSea(); } catch {}

// ── 服务列表（在此添加更多微服务）─────────────────────────────────────────
const SERVICES = [
  { name: 'web', file: path.join(__dirname, '../services/web.js') },
  // { name: 'worker', file: path.join(__dirname, '../services/worker.js') },
];

const processes = new Map(); // name → ChildProcess

/**
 * 启动所有服务进程
 */
function startAll() {
  SERVICES.forEach(({ name, file }) => spawnService(name, file));
}

/**
 * 停止所有服务进程（优雅关闭）
 */
function stopAll() {
  processes.forEach((child, name) => {
    console.log(`[process-mgr] 停止服务: ${name}`);
    child.kill('SIGTERM');
  });
  processes.clear();
}

/**
 * 向指定服务发送 IPC 消息
 */
function send(name, msg) {
  const child = processes.get(name);
  if (child) child.send(msg);
}

// ── 内部：启动单个服务 ────────────────────────────────────────────────────
function spawnService(name, file) {
  console.log(`[process-mgr] 启动服务: ${name}`);

  let child;

  if (_isSEA) {
    // SEA 模式：重新启动自身可执行文件，传 SERVICE_ROLE 告知其运行哪个服务
    child = spawn(process.execPath, [], {
      env:   { ...process.env, SERVICE_ROLE: name },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } else {
    // 开发模式：直接 fork 对应的 JS 文件
    child = fork(file, [], {
      silent: false,
      env:    { ...process.env, SERVICE_ROLE: name },
    });
    child.on('message', msg => {
      console.log(`[${name}] IPC:`, msg);
    });
  }

  child.on('exit', (code, signal) => {
    console.warn(`[process-mgr] 服务 ${name} 退出 code=${code} signal=${signal}`);
    processes.delete(name);
    if (signal !== 'SIGTERM') {
      console.log(`[process-mgr] 3 秒后重启 ${name}...`);
      setTimeout(() => spawnService(name, file), 3000);
    }
  });

  child.on('error', err => {
    console.error(`[process-mgr] 服务 ${name} 错误:`, err.message);
  });

  processes.set(name, child);
  return child;
}

module.exports = { startAll, stopAll, send };
