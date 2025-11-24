const express = require('express');
const fetch = require('node-fetch');
const app = express();

// 允许跨域
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/', (req, res) => {
  res.send('M3U8代理服务器运行正常!');
});

app.get('/proxy/m3u8', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('缺少URL参数');
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'uni-app',
        'Referer': url
      }
    });
    
    let m3u8Content = await response.text();
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    
    m3u8Content = m3u8Content.replace(/(.+\.ts)/g, (match, tsPath) => {
      const fullTsUrl = tsPath.startsWith('http') ? tsPath : baseUrl + tsPath;
      return `/proxy/ts?url=${encodeURIComponent(fullTsUrl)}`;
    });
    
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(m3u8Content);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('代理错误');
  }
});

app.get('/proxy/ts', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('缺少URL参数');
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'uni-app',
        'Referer': url
      }
    });
    
    const buffer = await response.buffer();
    res.set('Content-Type', 'video/mp2t');
    res.send(buffer);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('代理错误');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
