// Test script to check database connection and table setup
// Run with: node test-database-connection.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wtsckulmgegamnovlrbf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0c2NrdWxtZ2VnYW1ub3ZscmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODIyODYsImV4cCI6MjA3NzI1ODI4Nn0.Vg7GovepSgB5SmKW35R4k8Dt08vicbNHy5LBHy6QzEc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('🧪 Testing database connection...\n');

  try {
    // Test authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.log('❌ Authentication error:', sessionError.message);
      return;
    }

    if (!session?.user) {
      console.log('⚠️  No active session. You may need to sign in first.');
      console.log('   This test will check table existence without authentication.\n');
    } else {
      console.log('✅ User authenticated:', session.user.email);
    }

    // Test table existence
    const tables = ['users', 'images', 'folders', 'folder_images', 'slideshows', 'slideshow_images'];
    const existingTables = [];
    const missingTables = [];

    console.log('📊 Checking tables...\n');

    for (const table of tables) {
      try {
        // Try a simple query to see if table exists
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error && error.code === 'PGRST205') {
          // Table doesn't exist
          missingTables.push(table);
          console.log(`❌ ${table} - MISSING`);
        } else if (error && error.code === 'PGRST301') {
          // RLS policy blocks access
          existingTables.push(table);
          console.log(`⚠️  ${table} - EXISTS but RLS policy blocks access`);
        } else {
          existingTables.push(table);
          console.log(`✅ ${table} - OK`);
        }
      } catch (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          missingTables.push(table);
          console.log(`❌ ${table} - MISSING`);
        } else {
          console.log(`❓ ${table} - UNKNOWN ERROR:`, error.message);
        }
      }
    }

    console.log('\n📋 Summary:');
    console.log(`✅ Tables found: ${existingTables.length}/${tables.length}`);
    console.log(`❌ Tables missing: ${missingTables.length}/${tables.length}`);

    if (missingTables.length > 0) {
      console.log('\n🚨 MISSING TABLES:');
      missingTables.forEach(table => console.log(`   - ${table}`));

      console.log('\n🔧 SOLUTION:');
      console.log('   1. Go to your Supabase Dashboard');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Copy and paste the contents of setup-new-database.sql');
      console.log('   4. Run the SQL script');
      console.log('   5. Refresh your application');
    } else {
      console.log('\n🎉 All required tables exist!');
      console.log('   Your database is properly set up.');
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabase();