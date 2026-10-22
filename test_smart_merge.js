const assert = require('assert');

console.log("=== RUNNING SMART TWO-WAY MERGE & RESILIENCE TESTS ===");

// 1. Test Smart Driver & Truck Merge logic
function simulateSmartMerge(localData, cloudData) {
  let needsCloudResave = false;

  const localDelDrivers = Array.isArray(localData?.deletedDriverIds) ? localData.deletedDriverIds : [];
  const cloudDelDrivers = Array.isArray(cloudData.deletedDriverIds) ? cloudData.deletedDriverIds : [];
  const mergedDeletedDriverIds = Array.from(new Set([...localDelDrivers, ...cloudDelDrivers]));
  cloudData.deletedDriverIds = mergedDeletedDriverIds;

  const localDelTrucks = Array.isArray(localData?.deletedTruckIds) ? localData.deletedTruckIds : [];
  const cloudDelTrucks = Array.isArray(cloudData.deletedTruckIds) ? cloudData.deletedTruckIds : [];
  const mergedDeletedTruckIds = Array.from(new Set([...localDelTrucks, ...cloudDelTrucks]));
  cloudData.deletedTruckIds = mergedDeletedTruckIds;

  // Drivers merge
  const cloudDriverMap = new Map((cloudData.drivers || []).filter(d => d && !mergedDeletedDriverIds.includes(d.id)).map(d => [d.id, d]));
  const localValidDrivers = (localData?.drivers || []).filter(d => d && !mergedDeletedDriverIds.includes(d.id));
  localValidDrivers.forEach(ld => {
    if (!cloudDriverMap.has(ld.id)) {
      cloudDriverMap.set(ld.id, ld);
      needsCloudResave = true;
    }
  });
  cloudData.drivers = Array.from(cloudDriverMap.values());

  // Trucks merge
  const cloudTruckMap = new Map((cloudData.trucks || []).filter(t => t && !mergedDeletedTruckIds.includes(t.id)).map(t => [t.id, t]));
  const localValidTrucks = (localData?.trucks || []).filter(t => t && !mergedDeletedTruckIds.includes(t.id));
  localValidTrucks.forEach(lt => {
    if (!cloudTruckMap.has(lt.id)) {
      cloudTruckMap.set(lt.id, lt);
      needsCloudResave = true;
    }
  });
  cloudData.trucks = Array.from(cloudTruckMap.values());

  return { cloudData, needsCloudResave };
}

// Test Case 1: Local has new driver, cloud has empty array (The exact bug scenario!)
const local1 = {
  deletedDriverIds: ['drv_1', 'drv_2'],
  drivers: [
    { id: 'drv_new_101', fullName: 'Otabek Mirzayev' }
  ],
  deletedTruckIds: ['trk_1'],
  trucks: [
    { id: 'trk_new_501', name: 'DAF XF', plateNumber: '01 999 ZZZ' }
  ]
};

const cloud1 = {
  deletedDriverIds: ['drv_1', 'drv_2'],
  drivers: [], // Cloud is currently empty
  deletedTruckIds: ['trk_1'],
  trucks: []
};

const result1 = simulateSmartMerge(local1, cloud1);
assert.strictEqual(result1.cloudData.drivers.length, 1, "Local driver should NOT be deleted!");
assert.strictEqual(result1.cloudData.drivers[0].id, 'drv_new_101');
assert.strictEqual(result1.cloudData.trucks.length, 1, "Local truck should NOT be deleted!");
assert.strictEqual(result1.cloudData.trucks[0].id, 'trk_new_501');
assert.strictEqual(result1.needsCloudResave, true, "Should trigger resave to Firebase cloud!");
console.log("✅ Test 1 Passed: Local new driver & truck preserved when cloud is empty, resave triggered!");

// Test Case 2: Deleted driver should be filtered out
const local2 = {
  deletedDriverIds: ['drv_deleted_soon'],
  drivers: [
    { id: 'drv_deleted_soon', fullName: 'Should Be Gone' },
    { id: 'drv_keep', fullName: 'Keep Me' }
  ]
};
const cloud2 = {
  deletedDriverIds: ['drv_1'],
  drivers: []
};
const result2 = simulateSmartMerge(local2, cloud2);
assert.strictEqual(result2.cloudData.drivers.length, 1);
assert.strictEqual(result2.cloudData.drivers[0].id, 'drv_keep');
console.log("✅ Test 2 Passed: Deleted drivers correctly removed and not preserved.");

console.log("🎉 ALL SMART MERGE UNIT TESTS PASSED SUCCESSFULLY! 🚀");
