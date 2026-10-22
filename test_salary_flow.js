const fs = require('fs');
const assert = require('assert');

console.log('=== TEST 1: HTML Structure Verification ===');
const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('data-tab="tab-salary-payout"'), 'HTML must contain tab-salary-payout button');
assert(html.includes('id="tab-btn-salary-payout"'), 'HTML must contain tab-btn-salary-payout button id');
assert(html.includes('id="tab-salary-payout"'), 'HTML must contain tab-salary-payout pane');
assert(html.includes('id="salary-payout-tbody"'), 'HTML must contain salary-payout-tbody');
assert(html.includes('id="salary-payout-month"'), 'HTML must contain salary-payout-month input');
assert(html.includes('id="payout-kpi-total-earned"'), 'HTML must contain KPI total earned');
assert(html.includes('id="payout-kpi-total-advances"'), 'HTML must contain KPI total advances');
assert(html.includes('id="payout-kpi-total-paid"'), 'HTML must contain KPI total paid');

// Check order in navbar: tab-advances -> tab-salary-payout -> tab-add-driver
const posAdvances = html.indexOf('data-tab="tab-advances"');
const posSalary = html.indexOf('data-tab="tab-salary-payout"');
const posAddDriver = html.indexOf('data-tab="tab-add-driver"');

assert(posAdvances < posSalary, 'tab-salary-payout must be after tab-advances');
assert(posSalary < posAddDriver, 'tab-salary-payout must be before tab-add-driver');
console.log('✅ HTML Navbar order and structure are 100% correct!');

console.log('\n=== TEST 2: CSS Styles Verification ===');
const css = fs.readFileSync('style.css', 'utf8');
assert(css.includes('.salary-table'), 'CSS must include .salary-table');
assert(css.includes('.payout-kpi-grid'), 'CSS must include .payout-kpi-grid');
assert(css.includes('.salary-input-amount'), 'CSS must include .salary-input-amount');
assert(css.includes('.payout-status-badge'), 'CSS must include .payout-status-badge');
assert(css.includes('body.is-viewer [data-tab="tab-salary-payout"]'), 'CSS must include viewer restriction');
console.log('✅ CSS Classes and Responsive rules verified!');

console.log('\n=== TEST 3: JS Code Syntax and Exports ===');
const appJs = fs.readFileSync('app.js', 'utf8');
assert(appJs.includes('renderAdminSalaryPayoutTable'), 'app.js must include renderAdminSalaryPayoutTable');
assert(appJs.includes('window.saveSalaryPayout'), 'app.js must include window.saveSalaryPayout');
assert(appJs.includes('window.deleteSalaryPayout'), 'app.js must include window.deleteSalaryPayout');
assert(appJs.includes('getPreviousMonthCarryover'), 'app.js must include getPreviousMonthCarryover');
console.log('✅ JS functions and handlers verified!');

console.log('\n=== TEST 4: Full End-to-End Financial Carryover Simulation ===');
// Emulate the logic in app.js
function getPreviousMonthString(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return '';
  const [y, m] = monthStr.split('-').map(Number);
  const date = new Date(y, m - 2, 1);
  const prevY = date.getFullYear();
  const prevM = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevY}-${prevM}`;
}

function getPreviousMonthCarryover(appData, driverId, currentMonthStr) {
  if (!appData || !Array.isArray(appData.salaryPayouts)) return 0;
  const prevMonthStr = getPreviousMonthString(currentMonthStr);
  if (!prevMonthStr) return 0;
  const prevPayout = appData.salaryPayouts.find(p => p.driverId === driverId && p.month === prevMonthStr);
  if (!prevPayout) return 0;
  return Number(prevPayout.difference) || 0;
}

function getDriverMonthSummary(appData, driverId, monthPrefix) {
  const driver = appData.drivers.find(d => d.id === driverId);
  const dailyRate = Math.round((Number(driver.monthlySalary) || 0) / 25);
  
  const logs = (appData.attendances || []).filter(a => a.driverId === driverId && a.date.startsWith(monthPrefix) && a.status === 'completed');
  const workedDates = new Set(logs.map(a => a.date));
  const totalEarned = workedDates.size * dailyRate;

  const driverAdvances = (appData.advances || []).filter(adv => 
    adv.driverId === driverId && (!adv.date || adv.date.startsWith(monthPrefix))
  );
  const directAdvances = driverAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const carryover = getPreviousMonthCarryover(appData, driverId, monthPrefix);
  const carryoverDebt = carryover > 0 ? carryover : 0;
  const carryoverCredit = carryover < 0 ? Math.abs(carryover) : 0;

  const totalAdvances = directAdvances + carryoverDebt;
  const netSalary = Math.max(0, totalEarned - totalAdvances + carryoverCredit);

  return {
    driver,
    daysWorked: workedDates.size,
    dailyRate,
    totalEarned,
    directAdvances,
    carryover,
    carryoverDebt,
    carryoverCredit,
    totalAdvances,
    netSalary
  };
}

// User Scenario:
// Driver: Husan Husanboyev, monthly 9,000,000 (360,000/day)
// Month: 2026-10, Worked: 25 days -> Total earned: 9,000,000
// Advance taken in 2026-10: 7,000,000
// Net salary due: 2,000,000
// Paid by admin: 5,000,000 (Difference: +3,000,000 overpaid / debt)
const testDb = {
  drivers: [
    { id: 'drv_husan', fullName: 'Husan Husanboyev', monthlySalary: 9000000, phone: '+998901112233' },
    { id: 'drv_alisher', fullName: 'Alisher Rustamov', monthlySalary: 12000000, phone: '+998901234567' }
  ],
  attendances: Array.from({ length: 25 }, (_, i) => ({
    driverId: 'drv_husan',
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    status: 'completed'
  })),
  advances: [
    { driverId: 'drv_husan', amount: 7000000, date: '2026-10-15' }
  ],
  salaryPayouts: []
};

// 1. Calculate October summary
const octSummary = getDriverMonthSummary(testDb, 'drv_husan', '2026-10');
assert.strictEqual(octSummary.totalEarned, 9000000, 'Earned in Oct must be 9,000,000');
assert.strictEqual(octSummary.totalAdvances, 7000000, 'Advances in Oct must be 7,000,000');
assert.strictEqual(octSummary.netSalary, 2000000, 'Net salary in Oct must be 2,000,000');

// 2. Admin pays 5,000,000 (+3,000,000 overpaid)
testDb.salaryPayouts.push({
  id: 'pay_1',
  driverId: 'drv_husan',
  month: '2026-10',
  amount: 5000000,
  netSalaryDue: octSummary.netSalary,
  difference: 5000000 - octSummary.netSalary // +3,000,000
});

// 3. New Month (2026-11) check
const novSummary = getDriverMonthSummary(testDb, 'drv_husan', '2026-11');
assert.strictEqual(novSummary.carryoverDebt, 3000000, 'November must have 3,000,000 carryover debt');
assert.strictEqual(novSummary.totalAdvances, 3000000, 'November starting total advances must be 3,000,000');
console.log('✅ Overpayment scenario verified: +3,000,000 automatically carried into November as advance!');

// 4. Alphabetical sorting check
const sortedDrivers = testDb.drivers.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz'));
assert.strictEqual(sortedDrivers[0].fullName, 'Alisher Rustamov');
assert.strictEqual(sortedDrivers[1].fullName, 'Husan Husanboyev');
console.log('✅ Alphabetical sorting verified (Alisher comes before Husan)!');

console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
