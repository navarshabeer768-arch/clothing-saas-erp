#!/usr/bin/env node
// Dev utility: generates a bcrypt hash (same algorithm/cost factor as
// supabase/functions/_shared/password.ts) for use in local seed data or
// manual `UPDATE store_users SET password_hash = ...` statements.
//
// Usage:
//   node scripts/hash-password.mjs "MyDevPassword123"
//
// This script never sends the password anywhere — it only prints the hash
// to your local terminal. It is a devDependency-only tool (bcryptjs), not
// part of the browser bundle.

import bcrypt from 'bcryptjs';

const COST_FACTOR = 12; // must match supabase/functions/_shared/password.ts

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, COST_FACTOR);
console.log(hash);
