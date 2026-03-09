const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// pkg 打包时 __dirname 指向快照内部路径，需使用绝对路径
const BASE_DIR = __dirname;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(BASE_DIR, 'public')));

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(BASE_DIR, 'views', 'index.html'));
});

app.get('/api/info', (req, res) => {
  res.json({
    message: '欢迎使用 Node.js API',
    version: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '页面未找到' });
});

// 启动服务器
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🚀 服务器运行在 ${url}`);

  // 自动用默认浏览器打开
  const commands = {
    win32:  `start ${url}`,
    darwin: `open ${url}`,
    linux:  `xdg-open ${url}`
  };
  const cmd = commands[process.platform];
  if (cmd) exec(cmd);
});
