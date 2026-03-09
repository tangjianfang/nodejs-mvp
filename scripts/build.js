/**
 * Node.js SEA 打包脚本（多服务架构版）
 *
 * 步骤：
 *   1. 生成托盘图标（scripts/gen-icon.js）
 *   2. 读取静态文件，内联为字符串（用于 web 服务子进程）
 *   3. 生成 sea-entry.js（根据 SERVICE_ROLE 路由到主进程或各子服务）
 *   4. esbuild 打包为 sea-bundle.cjs
 *   5. 生成 SEA blob
 *   6. 注入到 node.exe 副本 → dist/node-lab.exe
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT   = path.join(__dirname, '..');
const DIST   = path.join(ROOT, 'dist');
const ENTRY  = path.join(ROOT, 'sea-entry.js');
const BUNDLE = path.join(ROOT, 'sea-bundle.cjs');
const BLOB   = path.join(ROOT, 'sea-prep.blob');
const SEA_CFG= path.join(ROOT, 'sea-config.json');
const EXE    = path.join(DIST, 'node-lab.exe');

// ── 1. 生成图标 ───────────────────────────────────────────────────────────
console.log('[1/6] 生成托盘图标...');
execSync(`node ${path.join(__dirname, 'gen-icon.js')}`, { stdio: 'inherit', cwd: ROOT });

// ── 2. 读取静态文件 ───────────────────────────────────────────────────────
console.log('[2/6] 读取静态文件...');
const indexHtml = fs.readFileSync(path.join(ROOT, 'views',  'index.html'),  'utf8');
const stylesCss = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'),  'utf8');
const appJs     = fs.readFileSync(path.join(ROOT, 'public', 'app.js'),      'utf8');

// ── 3. 生成 SEA 入口（SERVICE_ROLE 路由）─────────────────────────────────
console.log('[3/6] 生成 sea-entry.js...');
const entryCode = `
'use strict';
const role = process.env.SERVICE_ROLE;

if (role === 'web') {
  // ── Web 服务子进程：静态文件已内联 ─────────────────────────────────────
  const express = require('express');
  const app  = express();
  const PORT = process.env.PORT || 3000;

  const INDEX_HTML = ${JSON.stringify(indexHtml)};
  const STYLES_CSS = ${JSON.stringify(stylesCss)};
  const APP_JS     = ${JSON.stringify(appJs)};

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 请求日志
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const color = res.statusCode >= 400 ? '\\x1b[31m' : res.statusCode >= 300 ? '\\x1b[33m' : '\\x1b[32m';
      console.log('[web] ' + color + req.method + '\\x1b[0m ' + req.url + ' → ' + color + res.statusCode + '\\x1b[0m  ' + ms + 'ms');
    });
    next();
  });

  app.get('/',           (req, res) => res.type('html').send(INDEX_HTML));
  app.get('/styles.css', (req, res) => res.type('css').send(STYLES_CSS));
  app.get('/app.js',     (req, res) => res.type('js').send(APP_JS));

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
    res.json({ received: req.body, timestamp: new Date().toISOString() });
  });

  app.use((req, res) => res.status(404).json({ error: '页面未找到' }));

  app.listen(PORT, () => {
    console.log('[web] Express 就绪 → http://localhost:' + PORT + '  (pid: ' + process.pid + ')');
  });

  process.on('SIGTERM', () => process.exit(0));

} else {
  // ── 主进程：实例锁 + 托盘 + 子进程管理 ─────────────────────────────────
  require('./src/main.js');
}
`;
fs.writeFileSync(ENTRY, entryCode, 'utf8');

// ── 4. esbuild 打包 ───────────────────────────────────────────────────────
console.log('[4/6] esbuild 打包...');
execSync(
  'npx esbuild ' + ENTRY + ' --bundle --platform=node --format=cjs --outfile=' + BUNDLE,
  { stdio: 'inherit', cwd: ROOT }
);

// ── 5. 生成 SEA blob ──────────────────────────────────────────────────────
console.log('[5/6] 生成 SEA blob...');
fs.writeFileSync(SEA_CFG, JSON.stringify({ main: BUNDLE, output: BLOB }), 'utf8');
execSync('node --experimental-sea-config ' + SEA_CFG, { stdio: 'inherit', cwd: ROOT });

// ── 6. 注入到 node.exe 副本 ───────────────────────────────────────────────
console.log('[6/6] 注入 blob → dist/node-lab.exe...');
fs.mkdirSync(DIST, { recursive: true });

// 若旧 exe 正在运行（Windows 文件锁），先强制结束进程
if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM node-lab.exe', { stdio: 'ignore' });
    // 等待系统释放文件句柄
    const waitUntilFree = (file, retries = 10) => {
      for (let i = 0; i < retries; i++) {
        try { fs.renameSync(file, file); return; } catch { /* locked */ }
        execSync('ping -n 1 127.0.0.1 > nul');  // ~1s sleep on Windows
      }
    };
    if (fs.existsSync(EXE)) waitUntilFree(EXE);
  } catch { /* 没有正在运行的实例，忽略 */ }
}

fs.copyFileSync(process.execPath, EXE);
execSync(
  'npx postject ' + EXE + ' NODE_SEA_BLOB ' + BLOB +
  ' --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  { stdio: 'inherit', cwd: ROOT }
);

// ── 清理临时文件 ───────────────────────────────────────────────────────────
[ENTRY, BUNDLE, BLOB, SEA_CFG].forEach(f => { try { fs.unlinkSync(f); } catch {} });

const sizeMB = (fs.statSync(EXE).size / 1024 / 1024).toFixed(1);

// ── 复制 systray2 原生二进制到 dist/traybin ─────────────────────────────────
const traySrc = path.join(ROOT, 'node_modules', 'systray2', 'traybin');
const trayDst = path.join(DIST, 'traybin');
fs.mkdirSync(trayDst, { recursive: true });
fs.readdirSync(traySrc).forEach(f => {
  fs.copyFileSync(path.join(traySrc, f), path.join(trayDst, f));
});
console.log('[build] systray 二进制已复制 → dist/traybin/');

console.log('\n✅ 打包完成！');
console.log('   输出：' + EXE);
console.log('   大小：' + sizeMB + ' MB');
console.log('\n发布时请将 dist/ 整个目录一起分发（包含 traybin/）');
