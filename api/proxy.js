const fetch = require('node-fetch');

// 设置超时函数
const timeout = (ms) => new Promise((_, reject) => 
  setTimeout(() => reject(new Error(`请求超时 (${ms}ms)`)), ms)
);

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { query } = req;
  const url = query.url;
  const path = req.url;

  // 首页显示使用说明
  if (path === '/') {
    return res.send(`
      <h1>M3U8代理服务器</h1>
      <p>🚀 服务器运行正常！</p>
      <p><strong>使用方式：</strong></p>
      <ul>
        <li>代理M3U8: <code>/proxy/m3u8?url=你的m3u8地址</code></li>
        <li>代理TS: <code>/proxy/ts?url=你的ts地址</code></li>
      </ul>
      <p><strong>示例：</strong></p>
      <code>${req.headers['x-forwarded-proto']}://${req.headers.host}/proxy/m3u8?url=https://example.com/playlist.m3u8</code>
    `);
  }

  if (!url) {
    return res.status(400).json({ 
      error: '缺少URL参数',
      usage: {
        m3u8: '/proxy/m3u8?url=你的m3u8地址',
        ts: '/proxy/ts?url=你的ts地址'
      }
    });
  }

  try {
    console.log('代理请求:', url);
    
    // 使用Promise.race实现超时控制
    const fetchPromise = fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 7.1.2; LIO-AN00 Build/N2G47H; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/68.0.3440.70 Mobile Safari/537.36 uni-app Html5Plus/1.0 (Immersed/24.0)',
        'Referer': new URL(url).origin,
        'Accept': '*/*'
      }
    });

    // 10秒超时
    const response = await Promise.race([fetchPromise, timeout(10000)]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 处理TS文件请求
    if (path.includes('/proxy/ts')) {
      const buffer = await response.buffer();
      
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Length', buffer.length);
      
      return res.send(buffer);
    } 
    // 处理M3U8文件请求
    else if (path.includes('/proxy/m3u8')) {
      let content = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      // 替换TS文件路径，让TS也走代理
      content = content.replace(/(.+\.ts)/g, (match, tsPath) => {
        // 处理相对路径和绝对路径
        let fullTsUrl;
        if (tsPath.startsWith('http')) {
          fullTsUrl = tsPath;
        } else if (tsPath.startsWith('/')) {
          const urlObj = new URL(url);
          fullTsUrl = `${urlObj.origin}${tsPath}`;
        } else {
          fullTsUrl = baseUrl + tsPath;
        }
        
        return `${req.headers['x-forwarded-proto']}://${req.headers.host}/proxy/ts?url=${encodeURIComponent(fullTsUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(content);
    }

  } catch (error) {
    console.error('代理错误:', error.message);
    
    if (error.message.includes('超时')) {
      return res.status(504).json({ 
        error: '请求超时',
        message: '代理服务器在10秒内未收到响应',
        url: url
      });
    }
    
    return res.status(500).json({ 
      error: '代理请求失败',
      message: error.message,
      url: url
    });
  }
};
