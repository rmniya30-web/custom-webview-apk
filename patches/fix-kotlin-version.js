/**
 * Fix Kotlin version mismatch in all Gradle files.
 * Gradle 9.0 ships Kotlin 2.2.0 metadata, so the project compiler must match.
 * Usage: node patches/fix-kotlin-version.js <android-dir>
 */
const fs = require('fs');
const path = require('path');

const TARGET_VERSION = '2.2.0';
const androidDir = process.argv[2] || '.';

function walk(dir, depth = 0) {
  if (depth > 5) return [];
  const files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.gradle', 'build', 'caches'].includes(entry.name)) continue;
        files.push(...walk(fullPath, depth + 1));
      } else if (/\.(gradle|kts|properties)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (e) { /* skip unreadable dirs */ }
  return files;
}

const files = walk(androidDir);
let patchCount = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Match: kotlin("android") version "2.x.x"
  content = content.replace(
    /kotlin\s*\(\s*["']android["']\s*\)\s*version\s*["']2\.\d+\.\d+["']/g,
    `kotlin("android") version "${TARGET_VERSION}"`
  );

  // Match: id("org.jetbrains.kotlin.android") version "2.x.x"
  content = content.replace(
    /id\s*\(\s*["']org\.jetbrains\.kotlin\.android["']\s*\)\s*version\s*["']2\.\d+\.\d+["']/g,
    `id("org.jetbrains.kotlin.android") version "${TARGET_VERSION}"`
  );

  // Match: id 'org.jetbrains.kotlin.android' version '2.x.x'
  content = content.replace(
    /id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version\s+['"]2\.\d+\.\d+['"]/g,
    `id 'org.jetbrains.kotlin.android' version '${TARGET_VERSION}'`
  );

  // Match: kotlinVersion = "2.x.x" or kotlinVersion=2.x.x
  content = content.replace(
    /kotlinVersion\s*=\s*["']?2\.\d+\.\d+["']?/g,
    `kotlinVersion=${TARGET_VERSION}`
  );

  // Match: ext.kotlin_version = '2.x.x'
  content = content.replace(
    /ext\.kotlin_version\s*=\s*["']2\.\d+\.\d+["']/g,
    `ext.kotlin_version = '${TARGET_VERSION}'`
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`PATCHED: ${filePath}`);
    patchCount++;
  }
}

console.log(`\nScanned ${files.length} files, patched ${patchCount}`);
if (patchCount === 0) {
  console.log('WARNING: No files were patched! Listing gradle files for debug:');
  for (const f of files) {
    const c = fs.readFileSync(f, 'utf8');
    if (c.includes('kotlin') || c.includes('Kotlin')) {
      console.log(`  ${f} (contains kotlin references)`);
      // Print lines with kotlin
      c.split('\n').forEach((line, i) => {
        if (/kotlin/i.test(line)) console.log(`    L${i+1}: ${line.trim()}`);
      });
    }
  }
}
