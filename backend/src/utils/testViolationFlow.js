require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');
const { pool } = require('../config/db');

const API_BASE = 'http://localhost:5000/api';

async function testViolationFlow() {
  console.log('========================================================');
  console.log('  Testing Issue Violation Ticket Flow with Number Plate ');
  console.log('========================================================\n');

  let testViolationId = null;

  try {
    // 1. Admin Login
    console.log('[Step 1] Admin login...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@parksync.com',
      password: 'admin123'
    });
    const adminToken = loginRes.data.token;
    console.log('  -> Admin logged in. Role:', loginRes.data.user?.role);

    // 2. Fetch all vehicles as Admin
    console.log('\n[Step 2] Fetching all vehicles for Admin dropdown (GET /api/users/vehicles)...');
    const vehRes = await axios.get(`${API_BASE}/users/vehicles`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!vehRes.data.success || !Array.isArray(vehRes.data.vehicles)) {
      throw new Error('Failed to retrieve vehicles: ' + JSON.stringify(vehRes.data));
    }
    console.log(`  -> Retrieved ${vehRes.data.vehicles.length} vehicle(s) from database.`);
    
    // Check if KA03EF9012 — Vikas Naik exists
    const targetVehicle = vehRes.data.vehicles.find(v => v.registration_no === 'KA03EF9012');
    if (!targetVehicle) {
      throw new Error('Vehicle KA03EF9012 not found in returned vehicles list');
    }
    console.log(`  -> Found target vehicle: ID ${targetVehicle.vehicle_id}, Plate: ${targetVehicle.registration_no}, Owner: ${targetVehicle.owner_name}`);
    console.log(`  -> Formatted dropdown option: "${targetVehicle.registration_no} — ${targetVehicle.owner_name}"`);

    // 3. Issue a Violation Ticket using targetVehicle.vehicle_id
    console.log('\n[Step 3] Issuing Violation Ticket using vehicle_id: ' + targetVehicle.vehicle_id);
    const issueRes = await axios.post(
      `${API_BASE}/violations`,
      {
        vehicle_id: targetVehicle.vehicle_id,
        slot_id: 1,
        violation_type: 'Improper Vehicle Alignment',
        fine_amount: 250.00
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (!issueRes.data.success) {
      throw new Error('Failed to issue violation: ' + JSON.stringify(issueRes.data));
    }
    testViolationId = issueRes.data.violationId;
    console.log('  -> Violation issued successfully! Violation ID:', testViolationId);

    // 4. Retrieve violations list and verify registration_no and owner appear
    console.log('\n[Step 4] Verifying violations table (GET /api/violations)...');
    const listRes = await axios.get(`${API_BASE}/violations`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!listRes.data.success || !Array.isArray(listRes.data.violations)) {
      throw new Error('Failed to fetch violations table');
    }
    const createdRecord = listRes.data.violations.find(v => v.violation_id === testViolationId);
    if (!createdRecord) {
      throw new Error('Created violation record not found in table response');
    }

    console.log('  -> Violation table record verified:');
    console.log(`     - Violation ID: #${createdRecord.violation_id}`);
    console.log(`     - Number Plate: ${createdRecord.registration_no}`);
    console.log(`     - Owner Name:   ${createdRecord.user_name}`);
    console.log(`     - Slot:         Slot ${createdRecord.slot_number} (${createdRecord.area_name})`);
    console.log(`     - Fine Amount:  ₹${Number(createdRecord.fine_amount).toFixed(2)}`);
    console.log(`     - Status:       ${createdRecord.payment_status}`);

    if (createdRecord.registration_no !== 'KA03EF9012' || createdRecord.user_name !== 'Vikas Naik') {
      throw new Error(`Data mismatch! Expected KA03EF9012 and Vikas Naik, got ${createdRecord.registration_no} and ${createdRecord.user_name}`);
    }
    console.log('  -> PASS: Correct vehicle number plate and owner linked and confirmed!');

    // 5. Clean up test violation
    console.log('\n[Step 5] Cleaning up test violation...');
    await pool.execute('DELETE FROM violations WHERE violation_id = ?', [testViolationId]);
    console.log('  -> Cleanup complete.');

    console.log('\n========================================================');
    console.log('  ISSUE VIOLATION TICKET TEST PASSED WITH 100% SUCCESS!  ');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST FAILED]:', err.message);
    if (testViolationId) {
      try {
        await pool.execute('DELETE FROM violations WHERE violation_id = ?', [testViolationId]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

testViolationFlow();
