const fs = require('fs');

// Let's create a test HTML file that places a 1px target and tests clicking it with various hotspot coords
const testHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 50px;
    background: #faf5ee;
  }
  .target-btn {
    width: 120px;
    height: 40px;
    background: #bf674f;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: url('../image/cursors/spouzy-teddy-large-arrow-50.png') 2 0, pointer;
  }
  .target-btn-2-1 {
    cursor: url('../image/cursors/spouzy-teddy-large-arrow-50.png') 2 1, pointer;
  }
</style>
</head>
<body>
  <button id="btn1" class="target-btn">Click Me 2 0</button>
  <button id="btn2" class="target-btn target-btn-2-1">Click Me 2 1</button>
</body>
</html>`;

fs.writeFileSync('scratch/cursor_test.html', testHtml);
console.log('Saved scratch/cursor_test.html');
