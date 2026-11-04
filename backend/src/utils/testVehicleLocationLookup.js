require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

async function runTests() {
  console.log('--- Testing ParkSync Vehicle Location Auto-Fetch & Violations Workflow ---');

  // Generate Admin Token
  const token = jwt.sign(
    { userId: 1, email: 'admin@parksync.com', role: 'ADMIN', name: 'System Admin' },
    process.env.JWT_SECRET || 'parksync_super_secret_jwt_key_2025_change_in_production',
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testVehicleId = null;
  const testRegNo = 'KA05TEST99';

  try {
    // Clean up any lingering previous test vehicle
    await pool.execute('DELETE FROM vehicles WHERE registration_no = ?', [testRegNo]);

    // Create dedicated test vehicle
    const [vehInsert] = await pool.execute(
      `INSERT INTO vehicles (user_id, registration_no, vehicle_type, brand, model, color)
       VALUES (1, ?, 'CAR', 'Tesla', 'Model 3', 'Pearl White')`,
      [testRegNo]
    );
    testVehicleId = vehInsert.insertId;
    console.log(`[Setup] Created test vehicle ${testRegNo} with ID ${testVehicleId}`);

    // Get 2 available slots for testing
    const [slots] = await pool.execute('SELECT slot_id, slot_number FROM parking_slots LIMIT 2');
    const slotA = slots[0].slot_id;
    const slotB = slots[1].slot_id;

    // 1. Test 404 on non-existent vehicle plate
    console.log('\n[Scenario 1] Lookup Non-Existent Vehicle Plate:');
    const res404 = await fetch('http://localhost:5000/api/violations/vehicle-location/NONEXIST999', {
      headers: authHeaders
    });
    console.log('Status code:', res404.status);
    const data404 = await res404.json();
    console.log('Response message:', data404.message);
    if (res404.status !== 404) throw new Error('Expected 404 for non-existent vehicle');

    // 2. Scenario 2: Test vehicle with NO active parking record
    console.log('\n[Scenario 2] Vehicle with NO active session or reservation:');
    const resNoActive = await fetch(`http://localhost:5000/api/violations/vehicle-location/${testRegNo}`, {
      headers: authHeaders
    });
    const dataNoActive = await resNoActive.json();
    console.log('Status code:', resNoActive.status);
    console.log('Vehicle detected:', dataNoActive.vehicle.registration_no, '| Owner:', dataNoActive.vehicle.owner_name, '| Model:', dataNoActive.vehicle.brand, dataNoActive.vehicle.model);
    console.log('Location:', dataNoActive.location);
    console.log('Message:', dataNoActive.message);
    console.log('Disclaimer:', dataNoActive.disclaimer);
    if (dataNoActive.location !== null || dataNoActive.message !== 'No active parking record found for this vehicle.') {
      throw new Error('Expected location to be null when no active record exists');
    }

    // 3. Scenario 3: Fallback source: Active Confirmed Reservation
    console.log('\n[Scenario 3] Vehicle with Active Confirmed Reservation (Fallback source):');
    const [resvInsert] = await pool.execute(
      `INSERT INTO reservations (user_id, vehicle_id, slot_id, start_time, end_time, status)
       VALUES (1, ?, ?, DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'CONFIRMED')`,
      [testVehicleId, slotA]
    );
    const testResvId = resvInsert.insertId;

    const resResv = await fetch(`http://localhost:5000/api/violations/vehicle-location/${testRegNo}`, {
      headers: authHeaders
    });
    const dataResv = await resResv.json();
    console.log('Status code:', resResv.status);
    console.log('Location Source:', dataResv.locationSource);
    console.log('Location Text:', dataResv.location?.location_text);
    console.log('Slot ID:', dataResv.location?.slot_id);
    if (dataResv.locationSource !== 'ACTIVE_RESERVATION' || dataResv.location?.slot_id !== slotA) {
      throw new Error('Active reservation location lookup failed');
    }

    // 4. Scenario 4: Primary source: Active Parking Session takes precedence
    console.log('\n[Scenario 4] Vehicle with Active Parking Session (Primary source):');
    const [sessInsert] = await pool.execute(
      `INSERT INTO parking_sessions (reservation_id, vehicle_id, slot_id, entry_time, status)
       VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 15 MINUTE), 'ONGOING')`,
      [testResvId, testVehicleId, slotA]
    );
    const testSessId = sessInsert.insertId;

    const resSess = await fetch(`http://localhost:5000/api/violations/vehicle-location/${testVehicleId}`, {
      headers: authHeaders
    });
    const dataSess = await resSess.json();
    console.log('Status code:', resSess.status);
    console.log('Location Source:', dataSess.locationSource);
    console.log('Location Text:', dataSess.location?.location_text);
    console.log('Has conflict:', dataSess.hasConflict);
    if (dataSess.locationSource !== 'ACTIVE_SESSION' || dataSess.location?.slot_id !== slotA) {
      throw new Error('Active session location lookup failed');
    }

    // 5. Scenario 5: Conflict / Discrepancy (Ongoing session in Slot A, Active reservation in Slot B)
    console.log('\n[Scenario 5] Conflict Detection (Session in Slot A, Reservation in Slot B):');
    await pool.execute(
      'UPDATE reservations SET slot_id = ? WHERE reservation_id = ?',
      [slotB, testResvId]
    );

    const resConflict = await fetch(`http://localhost:5000/api/violations/vehicle-location/${testRegNo}`, {
      headers: authHeaders
    });
    const dataConflict = await resConflict.json();
    console.log('Has Conflict:', dataConflict.hasConflict);
    console.log('Conflict Type:', dataConflict.conflictType);
    console.log('Conflict Message:', dataConflict.conflictMessage);
    console.log('Candidates count:', dataConflict.candidateLocations?.length);
    if (!dataConflict.hasConflict || dataConflict.conflictType !== 'SESSION_RESERVATION_MISMATCH') {
      throw new Error('Expected conflict detection for session-reservation mismatch');
    }

    // 6. Scenario 6: Backend Validation for Violation Creation
    console.log('\n[Scenario 6] Backend Slot & Vehicle Validation in createViolation:');
    
    // Invalid Slot ID
    const resBadSlot = await fetch('http://localhost:5000/api/violations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        vehicle_id: testVehicleId,
        slot_id: 999999,
        violation_type: 'Unauthorized Parking / Overtime',
        fine_amount: 150
      })
    });
    const dataBadSlot = await resBadSlot.json();
    console.log('Bad slot test status:', resBadSlot.status, 'Message:', dataBadSlot.message);
    if (resBadSlot.status !== 400 || !dataBadSlot.message.includes('slot_id')) {
      throw new Error('Expected 400 validation failure for non-existent slot_id');
    }

    // Invalid Vehicle ID
    const resBadVeh = await fetch('http://localhost:5000/api/violations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        vehicle_id: 999999,
        slot_id: slotA,
        violation_type: 'Unauthorized Parking / Overtime',
        fine_amount: 150
      })
    });
    const dataBadVeh = await resBadVeh.json();
    console.log('Bad vehicle test status:', resBadVeh.status, 'Message:', dataBadVeh.message);
    if (resBadVeh.status !== 400 || !dataBadVeh.message.includes('vehicle_id')) {
      throw new Error('Expected 400 validation failure for non-existent vehicle_id');
    }

    // Valid Violation Submission
    const resValid = await fetch('http://localhost:5000/api/violations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        vehicle_id: testVehicleId,
        slot_id: slotA,
        violation_type: 'Unauthorized Parking / Overtime',
        fine_amount: 250
      })
    });
    const dataValid = await resValid.json();
    console.log('Valid creation test status:', resValid.status, 'Violation ID:', dataValid.violationId);
    if (resValid.status !== 201 || !dataValid.violationId) {
      throw new Error('Expected 201 creation success');
    }

    // Clean up test data
    console.log('\n[Cleanup] Removing temporary test records...');
    await pool.execute('DELETE FROM violations WHERE violation_id = ?', [dataValid.violationId]);
    await pool.execute('DELETE FROM parking_sessions WHERE session_id = ?', [testSessId]);
    await pool.execute('DELETE FROM reservations WHERE reservation_id = ?', [testResvId]);
    await pool.execute('DELETE FROM vehicles WHERE vehicle_id = ?', [testVehicleId]);
    console.log('Cleanup completed successfully.');

    console.log('\n======================================================');
    console.log(' ALL 6 VEHICLE LOCATION & VIOLATION SCENARIOS PASSED!');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('TEST ERROR:', err);
    if (testVehicleId) {
      await pool.execute('DELETE FROM vehicles WHERE vehicle_id = ?', [testVehicleId]).catch(() => {});
    }
    process.exit(1);
  }
}

runTests();
