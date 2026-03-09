/**
 * services/web.js — Express Web 服务
 *
 * 作为独立子进程运行（由 process-mgr.js fork）。
 * 静态文件在 SEA 构建时会被内联（见 scripts/build.js）。
 */
'use strict';
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// SEA 构建时 BASE_DIR 由 build.js 替换为内联资源逻辑；开发模式下取项目根目录
const BASE_DIR = path.join(__dirname, '..');

// ── 中间件 ──────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(BASE_DIR, 'public')));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`[web] ${color}${req.method}\x1b[0m ${req.url} → ${color}${res.statusCode}\x1b[0m  ${ms}ms`);
  });
  next();
});

// ── 路由 ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(BASE_DIR, 'views', 'index.html'));
});

app.get('/api/info', (req, res) => {
  res.json({
    message:   '欢迎使用 Node.js API',
    version:   process.version,
    platform:  process.platform,
    pid:       process.pid,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/echo', (req, res) => {
  res.json({
    received:  req.body,
    timestamp: new Date().toISOString()
  });
});

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: '页面未找到' });
});

// ── 启动 ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[web] Express 服务就绪 → http://localhost:${PORT}  (pid: ${process.pid})`);
  // 通知父进程（process-mgr）服务已就绪
  if (process.send) process.send({ type: 'ready', port: PORT });
});

// ── 优雅退出 ─────────────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[web] 收到 SIGTERM，正在关闭...');
  process.exit(0);
});
