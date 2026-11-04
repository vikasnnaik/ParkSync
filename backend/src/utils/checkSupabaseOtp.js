require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function testOtpVerification() {
  const testEmail = `test.otp.verify.${Date.now()}@gmail.com`;
  console.log('Testing 8-digit OTP verification for:', testEmail);
  
  try {
    const { data: genData, error: genError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: testEmail,
      password: 'TestPassword123!'
    });
    
    if (genError) {
      console.error('Error generating link:', genError.message);
      return;
    }
    
    const otp = genData.properties?.email_otp;
    console.log('Generated OTP:', otp, 'Length:', otp.length);
    
    // Now verify with anon client
    const { data: verifyData, error: verifyError } = await supabaseAnon.auth.verifyOtp({
      email: testEmail,
      token: otp,
      type: 'signup'
    });
    
    if (verifyError) {
      console.error('Verify error:', verifyError.message);
    } else {
      console.log('SUCCESS! verifyOtp succeeded with 8-digit OTP. User ID:', verifyData.user?.id);
      console.log('Session access_token present:', !!verifyData.session?.access_token);
    }
    
    // Clean up
    if (genData.user?.id) {
      await supabaseAdmin.auth.admin.deleteUser(genData.user.id);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

testOtpVerification();
