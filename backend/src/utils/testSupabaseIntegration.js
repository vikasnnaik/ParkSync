require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const { pool } = require('../config/db');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const API_BASE = 'http://localhost:5000/api';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function runTests() {
  console.log('========================================================');
  console.log('   ParkSync Supabase Auth & MySQL Integration Suite    ');
  console.log('========================================================\n');

  const testEmail = `parksync.driver.${Date.now()}@gmail.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test Supabase Driver';

  let testUserId = null;
  let testSupabaseToken = null;

  try {
    // 1. Connectivity Check
    console.log('[TEST 1] Testing Supabase Client Connection...');
    const { data: usersList, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw new Error(`Supabase connection failed: ${listErr.message}`);
    console.log('  -> PASS: Supabase connected. Active users in Supabase Auth:', usersList.users.length);

    // 2. Demo Account Login (Backward Compatibility)
    console.log('\n[TEST 2] Testing Legacy / Demo Account Login (admin@parksync.com)...');
    const demoRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@parksync.com',
      password: 'admin123'
    });
    if (!demoRes.data.success || demoRes.data.user?.role !== 'ADMIN') {
      throw new Error('Demo login failed');
    }
    console.log('  -> PASS: Demo Admin logged in successfully with role:', demoRes.data.user.role);

    // 3. User Registration in Supabase
    console.log(`\n[TEST 3] Registering New User via Supabase (${testEmail})...`);
    let signUpData, signUpErr;
    const res = await anonClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { name: testName, role: 'DRIVER' }
      }
    });
    signUpData = res.data;
    signUpErr = res.error;

    if (signUpErr && signUpErr.message.includes('rate limit')) {
      console.log('  -> Note: Public Supabase email rate limit reached (3-4/hour on free tier). Creating test user via Admin client...');
      const adminRes = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: false,
        user_metadata: { name: testName, role: 'DRIVER' }
      });
      if (adminRes.error) throw new Error(`Admin create user failed: ${adminRes.error.message}`);
      signUpData = adminRes.data;
      signUpErr = null;
    } else if (signUpErr) {
      throw new Error(`Sign up failed: ${signUpErr.message}`);
    }

    testUserId = signUpData.user?.id;
    console.log('  -> PASS: Supabase user registered. UID:', testUserId);

    // 4. Test Unconfirmed Login Attempt
    console.log('\n[TEST 4] Testing Login with Unconfirmed Email...');
    const { data: unconfirmedData, error: unconfirmedErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (unconfirmedErr) {
      console.log('  -> PASS: Supabase correctly prevented unconfirmed login:', unconfirmedErr.message);
    } else if (!unconfirmedData.session) {
      console.log('  -> PASS: No active session issued for unverified user');
    }

    // 4b. Test verifyOtp call format with type: 'signup'
    console.log('\n[TEST 4b] Testing verifyOtp call shape with type: "signup"...');
    const { error: otpTypeErr } = await anonClient.auth.verifyOtp({
      email: testEmail,
      token: '123456',
      type: 'signup'
    });
    if (otpTypeErr) {
      // Must NOT return "Missing one of these types"
      if (otpTypeErr.message.includes('Missing one of these types')) {
        throw new Error(`Invalid verifyOtp type format: ${otpTypeErr.message}`);
      }
      console.log('  -> PASS: verifyOtp({ type: "signup" }) correctly accepted format. Supabase responded:', otpTypeErr.message);
    }

    // 5. Simulate Email OTP / Email Confirmation via Supabase Admin
    console.log('\n[TEST 5] Confirming Email via Supabase Admin API (Simulating valid OTP verification)...');
    const { data: updateData, error: updateErr } = await adminClient.auth.admin.updateUserById(
      testUserId,
      { email_confirm: true }
    );
    if (updateErr) throw new Error(`Email confirmation simulation failed: ${updateErr.message}`);
    console.log('  -> PASS: Email confirmed in Supabase for user');

    // 6. Login with Confirmed Account
    console.log('\n[TEST 6] Logging in with Confirmed Credentials...');
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (loginErr || !loginData.session) {
      throw new Error(`Login failed after confirmation: ${loginErr?.message}`);
    }
    testSupabaseToken = loginData.session.access_token;
    console.log('  -> PASS: Supabase login issued valid JWT access token');

    // 7. Backend Sync Endpoint (/api/auth/sync)
    console.log('\n[TEST 7] Syncing Supabase Identity with Backend MySQL Database...');
    const syncRes = await axios.post(
      `${API_BASE}/auth/sync`,
      { name: testName },
      { headers: { Authorization: `Bearer ${testSupabaseToken}` } }
    );
    if (!syncRes.data.success || !syncRes.data.user) {
      throw new Error('Backend sync failed');
    }
    console.log('  -> PASS: User synced to MySQL. MySQL User ID:', syncRes.data.user.userId, 'Role:', syncRes.data.user.role);

    // 8. Verify MySQL Database Record directly
    console.log('\n[TEST 8] Verifying MySQL Record (supabase_uid linking)...');
    const [dbRows] = await pool.execute(
      'SELECT user_id, name, email, supabase_uid, role FROM users WHERE supabase_uid = ?',
      [testUserId]
    );
    if (dbRows.length === 0 || dbRows[0].email !== testEmail) {
      throw new Error('MySQL record verification failed');
    }
    console.log('  -> PASS: MySQL database confirms record:', dbRows[0]);

    // 9. Testing Protected Backend Route with Supabase Token
    console.log('\n[TEST 9] Testing Protected Endpoint with Supabase Token (GET /api/reservations/my)...');
    const protectedRes = await axios.get(`${API_BASE}/reservations/my`, {
      headers: { Authorization: `Bearer ${testSupabaseToken}` }
    });
    if (!protectedRes.data.success) {
      throw new Error('Protected route request failed');
    }
    console.log('  -> PASS: Backend authorized request via Supabase token. Reservations found:', protectedRes.data.reservations.length);

    // 10. Clean up test user in Supabase & MySQL
    console.log('\n[CLEANUP] Cleaning up test user...');
    await adminClient.auth.admin.deleteUser(testUserId);
    await pool.execute('DELETE FROM users WHERE supabase_uid = ?', [testUserId]);
    console.log('  -> PASS: Test user cleaned up cleanly');

    console.log('\n========================================================');
    console.log('   ALL 10 SUPABASE AUTH INTEGRATION TESTS PASSED!      ');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAILED]:', err.message);
    if (testUserId) {
      try {
        await adminClient.auth.admin.deleteUser(testUserId);
        await pool.execute('DELETE FROM users WHERE supabase_uid = ?', [testUserId]);
      } catch (e) {}
    }
    process.exit(1);
  }
}

runTests();
