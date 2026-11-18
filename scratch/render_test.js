const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'test_social.html');
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(data);
});

server.listen(5599, async () => {
  console.log('Server running on 5599');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--screenshot=d:\\DOWNLOADS\\spouzynew25\\scratch\\test_social.png',
    '--window-size=600,300',
    'http://127.0.0.1:5599'
  ];
  const chrome = spawn(chromePath, args);
  chrome.on('exit', () => {
    console.log('Screenshot saved to scratch/test_social.png');
    server.close();
  });
});
