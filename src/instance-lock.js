/**
 * instance-lock.js — 单实例锁
 *
 * 原理：在固定端口（LOCK_PORT）启动一个 TCP 服务。
 *   - 第一个实例：绑定成功 → 继续启动
 *   - 后续实例：绑定失败 → 向第一个实例发送 "open" 指令 → 自己退出
 *
 * 支持扩展：可通过 onMessage 监听更多指令（如 focus, reload 等）
 */
'use strict';
const net = require('net');

const LOCK_PORT = 19981; // 进程间 IPC 端口，仅监听 localhost

/**
 * 尝试成为主实例。
 * @param {(msg: string) => void} onMessage  收到其他实例消息时的回调
 * @returns {Promise<boolean>}  true = 成为主实例；false = 已有主实例，自己应退出
 */
function tryLock(onMessage) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = '';
      socket.on('data', d => {
        buf += d.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(line => line.trim() && onMessage && onMessage(line.trim()));
      });
    });

    server.on('error', () => {
      // 端口被占用 → 已有主实例 → 向主实例发送信号后退出
      const client = net.connect(LOCK_PORT, '127.0.0.1', () => {
        client.write('open\n');
        client.end();
      });
      client.on('error', () => {}); // 忽略连接错误
      resolve(false);
    });

    server.listen(LOCK_PORT, '127.0.0.1', () => {
      console.log(`[instance] 主实例已锁定（IPC 端口 ${LOCK_PORT}）`);
      resolve(true);
    });
  });
}

module.exports = { tryLock };
