const fs = require('fs');
const https = require('https');
const vm = require('vm');
const { execSync } = require('child_process');

console.log('--- Starting Lucide Migration Verification ---');

// 1. Verify 0 fa- in index.html
const html = fs.readFileSync('index.html', 'utf8');
const htmlFa = html.match(/fa-[a-z0-9-]+/g) || [];
if (htmlFa.length > 0) {
  console.error('FAIL: Found fa- classes in index.html:', htmlFa);
  process.exit(1);
} else {
  console.log('PASS: 0 FontAwesome fa- classes in index.html');
}

// 2. Verify 0 fa- in app.js
const app = fs.readFileSync('app.js', 'utf8');
const appFa = app.match(/fa-[a-z0-9-]+/g) || [];
if (appFa.length > 0) {
  console.error('FAIL: Found fa- classes in app.js:', appFa);
  process.exit(1);
} else {
  console.log('PASS: 0 FontAwesome fa- classes in app.js');
}

// 3. Verify JavaScript syntax in app.js
try {
  execSync('node --check app.js', { stdio: 'pipe' });
  console.log('PASS: node --check app.js syntax valid');
} catch (err) {
  console.error('FAIL: Syntax error in app.js:', err.message);
  process.exit(1);
}

// 4. Verify sw.js cache name
const sw = fs.readFileSync('sw.js', 'utf8');
if (!sw.includes("const CACHE_NAME = 'bourkhan-trans-v11';")) {
  console.error('FAIL: sw.js CACHE_NAME is not bourkhan-trans-v11');
  process.exit(1);
} else {
  console.log('PASS: sw.js cache version is bourkhan-trans-v11');
}

// 5. Verify index.html cache busts
if (!html.includes('style.css?v=4.8') || !html.includes('app.js?v=4.8')) {
  console.error('FAIL: Cache bust versions missing in index.html');
  process.exit(1);
} else {
  console.log('PASS: index.html correctly references style.css?v=4.8 and app.js?v=4.8');
}

// 6. Verify Lucide icons existence
const htmlIcons = [...new Set([...html.matchAll(/data-lucide="([^"]+)"/g)].map(m => m[1]))];
const appIcons = [...new Set([...app.matchAll(/data-lucide="([^"]+)"/g)].map(m => m[1]))];
const allIcons = [...new Set([...htmlIcons, ...appIcons])].filter(i => !i.includes('$'));

https.get('https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(data, sandbox);
    const lucideObj = sandbox.window.lucide || sandbox.lucide;
    const toPascal = s => s.replace(/(^\w|-\w)/g, m => m.replace('-', '').toUpperCase());
    const missing = allIcons.filter(name => !lucideObj.icons[toPascal(name)]);
    if (missing.length > 0) {
      console.error('FAIL: Missing Lucide icons:', missing);
      process.exit(1);
    } else {
      console.log(`PASS: All ${allIcons.length} unique Lucide icons verified and present in Lucide bundle!`);
      console.log('--- ALL VERIFICATION CHECKS PASSED ---');
    }
  });
});
