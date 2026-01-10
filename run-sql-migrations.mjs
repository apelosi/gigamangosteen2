#!/usr/bin/env node
/**
 * Execute SQL migrations using Supabase Management API
 */
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

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1]

async function executeSql(sql, migrationName) {
  console.log(`\n📄 Executing ${migrationName}...`)
  console.log(`SQL: ${sql.substring(0, 100)}...`)

  // Use the Supabase database REST endpoint to execute SQL
  const url = `${supabaseUrl}/rest/v1/rpc/exec`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Failed: ${response.status} ${response.statusText}`)
      console.error(`Error details: ${errorText}`)
      return false
    }

    console.log(`✅ ${migrationName} completed successfully`)
    return true
  } catch (error) {
    console.error(`❌ Error executing SQL:`, error.message)
    return false
  }
}

async function runMigrations() {
  console.log('🚀 Starting SQL migrations...')
  console.log(`📡 Project: ${projectRef}`)
  console.log(`🔑 Using service role key: ${supabaseServiceKey.substring(0, 20)}...`)

  const migrations = [
    {
      name: 'Migration 002: Add guess/actual columns',
      file: 'scripts/002_add_guess_actual_columns.sql'
    },
    {
      name: 'Migration 003: Add Gemini columns',
      file: 'scripts/003_add_gemini_columns.sql'
    }
  ]

  for (const migration of migrations) {
    const sql = readFileSync(migration.file, 'utf-8')
    const success = await executeSql(sql, migration.name)

    if (!success) {
      console.error('\n❌ Migration process stopped due to error')
      console.log('\n💡 Please run the SQL manually in Supabase SQL Editor:')
      console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`)
      process.exit(1)
    }
  }

  console.log('\n✅ All migrations completed successfully!')
  console.log('\n🎉 Run "node add-columns.mjs" to verify the changes')
}

runMigrations()
