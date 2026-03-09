async function loadInfo() {
  try {
    const response = await fetch('/api/info');
    const data = await response.json();
    
    document.getElementById('info').innerHTML = `
      <strong>消息:</strong> ${data.message}<br>
      <strong>Node 版本:</strong> ${data.version}<br>
      <strong>平台:</strong> ${data.platform}<br>
      <strong>时间:</strong> ${data.timestamp}
    `;
  } catch (error) {
    document.getElementById('info').textContent = '加载失败: ' + error.message;
  }
}

async function sendMessage() {
  const message = document.getElementById('message').value;
  
  if (!message) {
    alert('请输入消息');
    return;
  }

  try {
    const response = await fetch('/api/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    
    document.getElementById('response').innerHTML = `
      <strong>收到的消息:</strong> ${data.received.message}<br>
      <strong>时间:</strong> ${data.timestamp}
    `;
  } catch (error) {
    document.getElementById('response').textContent = '发送失败: ' + error.message;
  }
}

// 页面加载时自动获取信息
loadInfo();
