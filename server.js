const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Security check to prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  // Support clean URLs: /about -> /about.html, /collection -> /collection.html, /how-it-works -> /about.html
  function resolveFilePath(targetPath, callback) {
    fs.stat(targetPath, (err, stats) => {
      if (!err && stats.isFile()) {
        return callback(null, targetPath, stats);
      }

      // Check if appending .html matches a file
      const htmlPath = targetPath + '.html';
      fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (!htmlErr && htmlStats.isFile()) {
          return callback(null, htmlPath, htmlStats);
        }

        // Alias /how-it-works to about.html
        if (reqPath === '/how-it-works' || reqPath === '/how-it-works.html') {
          const aboutPath = path.join(PUBLIC_DIR, 'about.html');
          return fs.stat(aboutPath, (aErr, aStats) => {
            if (!aErr && aStats.isFile()) {
              return callback(null, aboutPath, aStats);
            }
            callback(new Error('Not Found'));
          });
        }

        callback(new Error('Not Found'));
      });
    });
  }

  resolveFilePath(filePath, (err, finalPath, stats) => {
    if (err) {
      res.statusCode = 404;
      return res.end('Not Found');
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support HTTP Range requests (crucial for streaming mp3/wav audio properly in browsers)
    const range = req.headers.range;
    if (range && (ext === '.mp3' || ext === '.wav')) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(finalPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(finalPath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tired.fun Mansion server running at http://localhost:${PORT}`);
});

