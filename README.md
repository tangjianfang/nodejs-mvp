# Node.js Web App MVP

一个基于 Express 框架的最小 Node.js Web 应用。

## 功能特性

- ✅ Express Web 服务器
- ✅ RESTful API 端点
- ✅ 静态文件服务
- ✅ 现代化 UI 界面
- ✅ 异步数据交互

## 项目结构

```
.
├── server.js          # 主服务器文件
├── package.json       # 项目配置
├── views/            
│   └── index.html     # 主页面
└── public/           
    ├── styles.css     # 样式文件
    └── app.js         # 前端脚本
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行应用

```bash
npm start
```

### 开发模式（自动重启）

```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

## API 端点

- `GET /` - 主页面
- `GET /api/info` - 获取系统信息
- `POST /api/echo` - 回显消息

## 前后端通信完整流程

### 第一阶段：服务器启动，监听端口

执行 `npm start` 后，Node.js 运行 `server.js`，最后一行代码让 Express 绑定到 TCP 3000 端口：

```js
// server.js
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
```

此时操作系统将 **3000 端口** 交给这个 Node.js 进程管理。服务器进入事件循环，持续等待入站的 TCP 连接。

```
Node.js 进程
└── libuv 事件循环（一直运行）
      └── TCP 套接字监听 0.0.0.0:3000  ← 等待连接
```

---

### 第二阶段：浏览器发起首次请求，获取页面

用户在浏览器地址栏输入 `http://localhost:3000`，浏览器执行以下步骤：

**① DNS 解析**
`localhost` 直接解析为 `127.0.0.1`（本机回环地址），无需查询外部 DNS。

**② TCP 三次握手**
浏览器与 Node.js 进程之间建立 TCP 连接：
```
浏览器 ──SYN──────────────► Node.js:3000
浏览器 ◄──SYN-ACK────────── Node.js:3000
浏览器 ──ACK──────────────► Node.js:3000
        连接建立 ✅
```

**③ 发送 HTTP 请求报文**
```
GET / HTTP/1.1
Host: localhost:3000
Accept: text/html
```

**④ Express 接收并处理请求**

请求进入 Express 的中间件链，按注册顺序依次经过：

```
请求到达
   │
   ▼
express.json()          ← 尝试解析 JSON body（GET 请求无 body，直接跳过）
   │
   ▼
express.urlencoded()    ← 尝试解析表单 body（同上，跳过）
   │
   ▼
express.static('public')← 检查 /public 目录中有无 index 文件（无匹配，跳过）
   │
   ▼
app.get('/')            ← 路径匹配！执行路由处理函数
   │
   ▼
res.sendFile('views/index.html')  ← 读取 HTML 文件，写入响应
```

**⑤ 浏览器收到 HTML，继续请求静态资源**

浏览器解析 HTML，发现需要额外资源，自动发起新请求：
```
GET /styles.css  →  express.static 命中 public/styles.css  →  返回 CSS
GET /app.js      →  express.static 命中 public/app.js      →  返回 JS
```
至此页面完整渲染完毕。

---

### 第三阶段：前端 JS 运行，发起 API 请求（GET）

页面加载完成后，浏览器执行 `public/app.js` 中的 `loadInfo()`：

```js
// public/app.js
const response = await fetch('/api/info');   // 浏览器发起 GET 请求
const data = await response.json();          // 解析响应 JSON
```

**HTTP 请求报文：**
```
GET /api/info HTTP/1.1
Host: localhost:3000
Accept: */*
```

**Express 路由命中，构造并返回 JSON：**
```js
// server.js
app.get('/api/info', (req, res) => {
  res.json({
    message: '欢迎使用 Node.js API',
    version: process.version,   // 从 Node.js 运行时读取
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});
```

**HTTP 响应报文：**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"message":"欢迎使用 Node.js API","version":"v20.x.x","platform":"win32","timestamp":"..."}
```

前端收到后解析 JSON，将数据插入 DOM，页面显示系统信息。

---

### 第四阶段：用户提交数据，发起 API 请求（POST）

用户在输入框填写消息，点击"发送"按钮，`sendMessage()` 执行：

```js
// public/app.js
const response = await fetch('/api/echo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },   // 告知服务器 body 格式
  body: JSON.stringify({ message })                   // 序列化为 JSON 字符串
});
```

**HTTP 请求报文：**
```
POST /api/echo HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 20

{"message":"hello"}
```

**Express 中间件解析请求体：**
```
请求到达
   │
   ▼
express.json()  ← Content-Type 为 application/json，解析 body
                   req.body = { message: 'hello' }  ✅
   │
   ▼
app.post('/api/echo')  ← 路径和方法匹配，执行处理函数
```

```js
// server.js
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,          // { message: 'hello' }
    timestamp: new Date().toISOString()
  });
});
```

**HTTP 响应报文：**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"received":{"message":"hello"},"timestamp":"..."}
```

---

### 整体流程总览

```
npm start
  └─► Node.js 绑定 TCP :3000，进入事件循环

浏览器输入 localhost:3000
  └─► TCP 握手
  └─► GET /          → 返回 index.html
  └─► GET /styles.css → 返回 CSS（express.static）
  └─► GET /app.js    → 返回 JS（express.static）
  └─► JS 自动执行 loadInfo()
        └─► GET /api/info → 返回 JSON（系统信息）→ 渲染到页面

用户输入消息点击发送
  └─► POST /api/echo  → 解析 req.body → 返回 JSON → 渲染到页面
```

### 关键中间件作用

| 中间件 | 触发条件 | 作用 |
|--------|----------|------|
| `express.static('public')` | 请求路径匹配 public/ 下的文件 | 直接返回文件，不进入路由 |
| `express.json()` | `Content-Type: application/json` | 将请求体 JSON 字符串解析为 `req.body` |
| `express.urlencoded()` | `Content-Type: application/x-www-form-urlencoded` | 解析 HTML 表单提交数据为 `req.body` |

## 技术栈

- Node.js
- Express.js
- HTML/CSS/JavaScript

## 学习要点

1. Express 基础路由
2. 中间件使用
3. 静态文件服务
4. RESTful API 设计
5. 前后端数据交互

## 扩展知识：HTTP/1.1 vs HTTP/2 vs HTTP/3 全面对比

### 协议演进背景

```
1997  HTTP/1.1 ── 解决了 HTTP/1.0 每次请求都断连的问题（持久连接）
2015  HTTP/2   ── 解决了 HTTP/1.1 的队头阻塞和冗余头部问题
2022  HTTP/3   ── 解决了 HTTP/2 在弱网下 TCP 层队头阻塞的根本问题
```

---

### 一、底层传输协议

```
HTTP/1.1  →  TCP（明文）
HTTP/2    →  TCP + TLS（事实强制加密）
HTTP/3    →  QUIC（基于 UDP）+ TLS 1.3（协议内置，不可关闭）

            应用层     传输层
HTTP/1.1:  [HTTP ]    [TCP          ]
HTTP/2:    [HTTP2]    [TLS][TCP     ]
HTTP/3:    [HTTP3]    [QUIC = TLS1.3 + UDP]
```

QUIC 把原本分散在 TCP 和 TLS 中的功能（可靠传输、流控、加密）全部内嵌进一个协议层，握手更快、丢包恢复更精准。

---

### 二、连接建立耗时（RTT = 往返时延）

| 协议 | 首次连接握手 | 恢复连接（Session 复用） |
|------|------------|----------------------|
| HTTP/1.1（HTTP） | 1 RTT（TCP） | 1 RTT |
| HTTP/1.1（HTTPS） | 3 RTT（TCP 1 + TLS 2） | 2 RTT |
| HTTP/2（HTTPS） | 3 RTT（TCP 1 + TLS 2） | 2 RTT |
| HTTP/3（QUIC） | **1 RTT**（QUIC 合并握手） | **0 RTT**（会话恢复） |

**真实网络延迟影响（假设 RTT = 50ms）：**

```
HTTP/1.1 HTTPS 首次握手：50ms × 3 = 150ms（才能发出第一个请求）
HTTP/2   HTTPS 首次握手：50ms × 3 = 150ms
HTTP/3   QUIC  首次握手：50ms × 1 = 50ms   ← 快 3 倍
HTTP/3   0-RTT 恢复：    0ms              ← 直接发数据
```

---

### 三、并发请求能力

#### HTTP/1.1：串行 + 多连接并发

```
连接1: [====req1====][====req2====][====req3====]  串行队列
连接2: [====req4====][====req5====]
连接3: [====req6====]
...（浏览器最多 6 个并发 TCP 连接）

问题：req1 慢 → req2/3 全部等待（应用层队头阻塞）
```

#### HTTP/2：单连接多路复用

```
单一 TCP 连接内：
流1: [=req1=]   [==============resp1==============]
流2:    [=req2=][======resp2======]
流3:       [=req3=]  [====resp3====]

优势：无应用层队头阻塞，帧可交错传输
缺点：TCP 丢一个包 → 所有流等待重传（TCP 层队头阻塞）
```

#### HTTP/3：QUIC 独立流

```
同一 QUIC 连接：
流1: [=req1=][====resp1====]
流2: [=req2=][==resp2==]         ← 流1 丢包不影响流2
流3: [=req3=][=========resp3=========]

丢包只阻塞对应的流，其他流继续传输
```

---

### 四、性能基准数据

以下数据来自 Cloudflare、Google、Akamai 等机构的实测报告：

#### 页面加载时间（模拟 100 个资源并发请求）

| 协议 | 良好网络（0% 丢包） | 一般网络（1% 丢包） | 差网络（5% 丢包） |
|------|-------------------|-------------------|-----------------|
| HTTP/1.1 | 基准 | 基准 | 基准 |
| HTTP/2 | **快 30–50%** | **快 20–30%** | 与 1.1 持平甚至更慢 |
| HTTP/3 | **快 10–20%** | **快 30–40%** | **快 200–300%** |

> HTTP/2 在丢包率 > 2% 时性能反而不如 HTTP/1.1，因为单条 TCP 连接丢包代价更大。  
> HTTP/3 在弱网（移动网络、卫星网络）优势最显著。

#### 头部压缩效果

| 协议 | 头部压缩 | 典型请求头大小 |
|------|---------|--------------|
| HTTP/1.1 | 无（明文） | 500–1000 字节/请求 |
| HTTP/2 | HPACK（静态/动态表） | **首次 ~100 字节，重复请求接近 0** |
| HTTP/3 | QPACK（HPACK 的 QUIC 适配版） | 与 HTTP/2 相近 |

典型场景：一个页面加载 80 个资源，HTTP/1.1 头部总开销约 **60KB**，HTTP/2 压缩后约 **3KB**。

#### Google 官方数据（YouTube）

- 启用 HTTP/2 后页面加载速度提升 **~15%**
- 启用 QUIC（HTTP/3 前身）后，视频缓冲率降低 **30%**，重新缓冲时间减少 **15%**

---

### 五、安全性对比

| 维度 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 加密 | 可选（HTTP 明文） | 事实强制（TLS） | **强制**（TLS 1.3 内置于 QUIC，无法关闭） |
| TLS 版本 | 1.0–1.3 均可 | 通常 TLS 1.2+ | **仅 TLS 1.3** |
| 中间人攻击 | ⚠️ 明文下完全暴露 | ✅ 加密保护 | ✅ 加密保护 |
| 协议降级攻击 | ⚠️ 可被降级到 HTTP | ⚠️ 可被降级到 HTTP/1.1 | ✅ QUIC 内置防降级 |
| 前向保密（PFS） | 取决于密码套件 | 取决于密码套件 | ✅ TLS 1.3 强制前向保密 |
| 0-RTT 安全性 | — | — | ⚠️ 存在重放攻击风险（需服务端防护） |

**TLS 1.3 vs TLS 1.2 握手对比：**
```
TLS 1.2:  客户端Hello → 服务端Hello → 证书 → 密钥交换 → 完成  （2 RTT）
TLS 1.3:  客户端Hello（含密钥）→ 服务端Hello（含证书+完成）   （1 RTT）
QUIC:     QUIC握手 + TLS 1.3 合并                              （1 RTT，复用 0 RTT）
```

---

### 六、在 Node.js 中如何支持各协议

#### HTTP/1.1（当前项目，零配置）

```js
const express = require('express');
const app = express();
app.listen(3000);  // 开箱即用
```

#### HTTP/2（需要 TLS 证书）

```bash
# 用 mkcert 生成本地受信证书（推荐）
mkcert -install
mkcert localhost
```

```js
const http2 = require('http2');      // Node.js 内置，无需安装
const fs = require('fs');
const express = require('express');

const app = express();
// ...定义路由，与 HTTP/1.1 完全相同...

const server = http2.createSecureServer({
  key:  fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
}, app);

server.listen(3000);
```

#### HTTP/3（Node.js 生态尚不成熟，推荐用反向代理）

**生产/本地方案：用 Caddy 反向代理**

```
# Caddyfile
localhost {
    reverse_proxy localhost:3001   # Node.js 跑在 3001
}
```

Caddy 自动处理：证书申请/续期、HTTP/2、HTTP/3（QUIC）、协议协商。Node.js 只跑 HTTP/1.1，对外由 Caddy 升级到最优协议。

```
浏览器 ←──HTTP/3 (QUIC)──► Caddy:443 ←──HTTP/1.1──► Node.js:3001
```

---

### 七、本地开发证书方案对比

| 工具 | 安装难度 | 浏览器警告 | 适用场景 |
|------|---------|-----------|---------|
| 无证书（HTTP） | ✅ 零配置 | 无 | HTTP/1.1，日常开发 |
| OpenSSL 自签名 | ⚠️ 需命令行 | ⚠️ 每次警告 | 快速测试 |
| **mkcert** | ✅ 一次安装 | ✅ 无警告 | **本地 HTTPS 首选** |
| Let's Encrypt | ❌ 需要公网域名 | ✅ 无警告 | 生产环境 |

---

### 八、选型建议

```
场景                          推荐协议
────────────────────────────────────────────────────
本地开发                   →  HTTP/1.1（最省事）
内网 API / 微服务间调用     →  HTTP/2 h2c（明文，无需证书）
对外 Web 服务              →  HTTP/2（Nginx/Caddy 处理）
移动端 / 弱网 / 实时应用   →  HTTP/3（Cloudflare / Caddy）
视频流 / 游戏              →  WebSocket 或 WebTransport（基于 HTTP/3）
```

## 许可证

MIT
