// Unit test for salary carryover and calculation logic
const assert = require('assert');

// Helper to get previous month string 'YYYY-MM'
function getPreviousMonthString(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const date = new Date(y, m - 2, 1);
  const prevY = date.getFullYear();
  const prevM = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevY}-${prevM}`;
}

// Logic to calculate carryover from previous months
function getPreviousMonthCarryover(appData, driverId, currentMonthStr) {
  const prevMonthStr = getPreviousMonthString(currentMonthStr);
  const prevPayout = (appData.salaryPayouts || []).find(p => p.driverId === driverId && p.month === prevMonthStr);
  if (!prevPayout) return 0;
  
  // difference = paidAmount - netSalaryDue
  // If positive: driver was overpaid (debt for driver -> positive advance in next month)
  // If negative: driver was underpaid (company owes driver -> negative advance / credit)
  return Number(prevPayout.difference) || 0;
}

// Mock summary function with carryover
function getDriverMonthSummaryWithCarryover(appData, driverId, monthPrefix) {
  const driver = appData.drivers.find(d => d.id === driverId);
  if (!driver) return null;

  const dailyRate = Math.round((Number(driver.monthlySalary) || 0) / 25);
  const logs = (appData.attendances || []).filter(a => a.driverId === driverId && a.date.startsWith(monthPrefix));
  const completedTrips = logs.filter(a => a.status === 'completed');
  
  const workedDates = new Set();
  completedTrips.forEach(a => workedDates.add(a.date));
  (appData.shifts || [])
    .filter(s => s.driverId === driverId && s.date.startsWith(monthPrefix) && s.status === 'completed')
    .forEach(s => workedDates.add(s.date));

  const totalEarned = workedDates.size * dailyRate;

  // Monthly advances directly taken in this month
  const directAdvances = (appData.advances || [])
    .filter(adv => adv.driverId === driverId && adv.date && adv.date.startsWith(monthPrefix))
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Previous month carryover
  const carryover = getPreviousMonthCarryover(appData, driverId, monthPrefix);
  
  // If carryover > 0: driver owes money from last month, so advances increase
  // If carryover < 0: company owes money to driver, advances decrease
  const totalAdvances = directAdvances + carryover;
  const netSalary = totalEarned - totalAdvances;

  return {
    driver,
    daysWorked: workedDates.size,
    dailyRate,
    totalEarned,
    directAdvances,
    carryover,
    totalAdvances,
    netSalary
  };
}

console.log('--- TEST 1: Overpayment carryover (+3,000,000) ---');
const testAppData1 = {
  drivers: [
    { id: 'drv_1', fullName: 'Husan Husanboyev', monthlySalary: 9000000 }
  ],
  attendances: Array.from({ length: 25 }, (_, i) => ({
    driverId: 'drv_1',
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    status: 'completed'
  })),
  advances: [
    { driverId: 'drv_1', date: '2026-10-10', amount: 7000000 }
  ],
  salaryPayouts: [
    {
      driverId: 'drv_1',
      month: '2026-10',
      paidAmount: 5000000,
      netSalaryDue: 2000000,
      difference: 3000000 // 5,000,000 - 2,000,000 = +3,000,000
    }
  ]
};

// Check month 2026-11
const summaryNov = getDriverMonthSummaryWithCarryover(testAppData1, 'drv_1', '2026-11');
assert.strictEqual(summaryNov.carryover, 3000000, 'Carryover in Nov should be 3,000,000');
assert.strictEqual(summaryNov.totalAdvances, 3000000, 'Total advances in Nov should start at 3,000,000');
console.log('✅ Test 1 Passed: Overpayment (+3,000,000) correctly transferred as advance to Nov.');

console.log('--- TEST 2: Underpayment carryover (-1,000,000) ---');
const testAppData2 = {
  drivers: [
    { id: 'drv_1', fullName: 'Husan Husanboyev', monthlySalary: 9000000 }
  ],
  salaryPayouts: [
    {
      driverId: 'drv_1',
      month: '2026-10',
      paidAmount: 1000000,
      netSalaryDue: 2000000,
      difference: -1000000 // Underpaid by 1,000,000
    }
  ]
};
const summaryNov2 = getDriverMonthSummaryWithCarryover(testAppData2, 'drv_1', '2026-11');
assert.strictEqual(summaryNov2.carryover, -1000000, 'Carryover in Nov should be -1,000,000');
assert.strictEqual(summaryNov2.totalAdvances, -1000000, 'Total advances in Nov should be -1,000,000 (credit)');
console.log('✅ Test 2 Passed: Underpayment (-1,000,000) correctly transferred to Nov.');

console.log('--- TEST 3: Alphabetical sorting (A-Z) ---');
const driversList = [
  { fullName: 'Jasur Xoliqov' },
  { fullName: 'Alisher Rustamov' },
  { fullName: 'Botir Qodirov' },
  { fullName: 'Husan Husanboyev' }
];
const sorted = driversList.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz'));
assert.strictEqual(sorted[0].fullName, 'Alisher Rustamov');
assert.strictEqual(sorted[1].fullName, 'Botir Qodirov');
assert.strictEqual(sorted[2].fullName, 'Husan Husanboyev');
assert.strictEqual(sorted[3].fullName, 'Jasur Xoliqov');
console.log('✅ Test 3 Passed: Alphabetical sorting verified.');

console.log('\n🎉 ALL LOGIC TESTS PASSED!');
