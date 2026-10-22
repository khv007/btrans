const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

console.log('=== CHECKING SPECIFIC UI SECTIONS ===');

// Helper to find CSS rules
function findCss(sel) {
  const lines = css.split('\n');
  let res = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(sel) && lines[i].includes('{')) {
      let chunk = [lines[i]];
      let braces = (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      let j = i + 1;
      while (j < lines.length && braces > 0) {
        chunk.push(lines[j]);
        braces += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
        j++;
      }
      res.push(`Line ${i+1}:\n` + chunk.join('\n'));
    }
  }
  return res.join('\n---\n');
}

// 1. Header Left & Right
console.log('--- 1. HEADER ---');
console.log(findCss('.header-left'));
console.log(findCss('.brand-text'));

// 2. Navigation Tabs Container
console.log('\n--- 2. TABS CONTAINER ---');
const tabContainersInHtml = html.match(/<div[^>]*class=["'][^"']*tab[^"']*["'][^>]*>/gi) || [];
tabContainersInHtml.forEach(tc => console.log('HTML Tab container:', tc));
console.log(findCss('.admin-tabs-nav'));
console.log(findCss('.tab-btn'));

// 3. Driver Trip Controls (Route selector, swap button, big buttons)
console.log('\n--- 3. DRIVER TRIP CONTROLS ---');
console.log(findCss('.route-inputs-grid'));
console.log(findCss('.btn-swap-route'));
console.log(findCss('.shift-action-buttons'));
console.log(findCss('.driver-kpi-grid'));
console.log(findCss('.kpi-grid'));

// 4. Action Buttons in Tables
console.log('\n--- 4. TABLE ACTION BUTTONS ---');
console.log(findCss('.action-btn'));
console.log(findCss('.btn-table-action'));
console.log(findCss('.table-actions'));
console.log(findCss('.attendance-actions'));

// 5. Attendance Filter Bar
console.log('\n--- 5. ATTENDANCE FILTER BAR ---');
console.log(findCss('.attendance-filters'));
console.log(findCss('.attendance-filter-chips'));
console.log(findCss('.filter-chip'));

// 6. Pagination Controls
console.log('\n--- 6. PAGINATION ---');
console.log(findCss('.pagination-wrapper'));
console.log(findCss('.pagination-btn'));
console.log(findCss('.pagination-container'));

// 7. Modals Header / Body / Footer
console.log('\n--- 7. MODALS ---');
console.log(findCss('.modal-header'));
console.log(findCss('.modal-body'));
console.log(findCss('.modal-footer'));
console.log(findCss('.modal-kpi-grid'));

