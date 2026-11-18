const http = require('http');

const req = http.get('http://127.0.0.1:5502/index.htm', (res) => {
  console.log(`Port 5502 responded with status: ${res.statusCode}`);
  res.resume();
});

req.on('error', (err) => {
  console.log(`Port 5502 not reachable: ${err.message}`);
});
