const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function test() {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Supabase auth error:', error.message);
      process.exit(1);
    }
    console.log('SUPABASE_CONNECTED_SUCCESSFULLY');
    console.log(`Total Supabase users: ${data.users ? data.users.length : 0}`);
  } catch (err) {
    console.error('Exception connecting to Supabase:', err.message);
    process.exit(1);
  }
}

test();

