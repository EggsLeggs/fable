#!/usr/bin/env node
'use strict';
// @better-auth/kysely-adapter imports DEFAULT_MIGRATION_TABLE and
// DEFAULT_MIGRATION_LOCK_TABLE from the kysely main entry, but kysely
// moved them to the kysely/migration subpath in v0.28+. Append the
// missing re-exports so Turbopack's externals-tracing doesn't fail.
const fs = require('fs');
const path = require('path');

const kyselyIndex = path.resolve(__dirname, '..', 'node_modules', 'kysely', 'dist', 'index.js');

try {
  const content = fs.readFileSync(kyselyIndex, 'utf8');
  if (!content.includes('DEFAULT_MIGRATION_TABLE')) {
    fs.appendFileSync(
      kyselyIndex,
      "\nexport { DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE } from './migration/index.js';\n"
    );
    console.log('patch-kysely: added migration constant re-exports to kysely/dist/index.js');
  }
} catch (e) {
  // kysely not installed in this workspace scope — skip silently
}
