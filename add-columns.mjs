#!/usr/bin/env node
/**
 * Script to check if columns exist in card_guessing table
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read env file manually
const envContent = readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAndAddColumns() {
  console.log('🔍 Checking current table structure...\n')

  // Try to insert a test record with new columns
  const testId = crypto.randomUUID()

  try {
    console.log('📝 Attempting to insert test record with new columns...')

    const { data, error } = await supabase
      .from('card_guessing')
      .insert({
        session_id: testId,
        wins: 0,
        losses: 0,
        guesses: [],
        actuals: [],
        kitchen_images: [],
        kitchen_descriptions: [],
        kitchen_memories: []
      })
      .select()

    if (error) {
      console.error('❌ Columns do not exist yet. Error:', error.message)
      console.log('\n📋 Please run these SQL commands in Supabase SQL Editor:')
      console.log('   https://supabase.com/dashboard/project/xdtarwckfgbnzokwbnzz/sql/new')
      console.log('\n--- Migration 002 ---')
      console.log(`ALTER TABLE card_guessing
ADD COLUMN IF NOT EXISTS guesses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS actuals TEXT[] DEFAULT '{}';`)

      console.log('\n--- Migration 003 ---')
      console.log(`ALTER TABLE card_guessing
ADD COLUMN IF NOT EXISTS kitchen_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kitchen_descriptions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kitchen_memories TEXT[] DEFAULT '{}';`)
      console.log('\n')
      return false
    }

    console.log('✅ All columns exist! Test record created successfully.')
    console.log('🗑️  Cleaning up test record...')

    // Clean up test record
    await supabase
      .from('card_guessing')
      .delete()
      .eq('session_id', testId)

    console.log('✅ Migrations verified successfully!\n')
    return true

  } catch (err) {
    console.error('❌ Error:', err.message)
    return false
  }
}

checkAndAddColumns()
