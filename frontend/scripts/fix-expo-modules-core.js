#!/usr/bin/env node
// Patches expo-modules-core Promise.kt to match the nullable reject() signatures
// introduced in React Native 0.84's bridge Promise interface.
// Without this, the Kotlin compiler fails with "overrides nothing".

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core',
  'android', 'src', 'main', 'java', 'expo', 'modules', 'kotlin', 'Promise.kt'
);

if (!fs.existsSync(filePath)) {
  console.log('fix-expo-modules-core: Promise.kt not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// Already patched?
if (content.includes('reject(code: String?, message: String?)')) {
  console.log('fix-expo-modules-core: already patched, skipping.');
  process.exit(0);
}

const replacements = [
  [
    /override fun reject\(code: String, message: String\?\) \{\s*\n(\s*)expoPromise\.reject\(code, message, null\)/,
    'override fun reject(code: String?, message: String?) {\n$1expoPromise.reject(code ?: unknownCode, message, null)'
  ],
  [
    /override fun reject\(code: String, throwable: Throwable\?\) \{\s*\n(\s*)expoPromise\.reject\(code, null, throwable\)/,
    'override fun reject(code: String?, throwable: Throwable?) {\n$1expoPromise.reject(code ?: unknownCode, null, throwable)'
  ],
  [
    /override fun reject\(code: String, message: String\?, throwable: Throwable\?\) \{\s*\n(\s*)expoPromise\.reject\(code, message, throwable\)/,
    'override fun reject(code: String?, message: String?, throwable: Throwable?) {\n$1expoPromise.reject(code ?: unknownCode, message, throwable)'
  ],
  [
    /override fun reject\(code: String, userInfo: WritableMap\) \{\s*\n(\s*)expoPromise\.reject\(code, null, null\)/,
    'override fun reject(code: String?, userInfo: WritableMap) {\n$1expoPromise.reject(code ?: unknownCode, null, null)'
  ],
  [
    /override fun reject\(code: String, throwable: Throwable\?, userInfo: WritableMap\) \{\s*\n(\s*)expoPromise\.reject\(code, null, throwable\)/,
    'override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {\n$1expoPromise.reject(code ?: unknownCode, null, throwable)'
  ],
  [
    /override fun reject\(code: String, message: String\?, userInfo: WritableMap\) \{\s*\n(\s*)expoPromise\.reject\(code, message, null\)/,
    'override fun reject(code: String?, message: String?, userInfo: WritableMap) {\n$1expoPromise.reject(code ?: unknownCode, message, null)'
  ],
];

let patched = 0;
for (const [pattern, replacement] of replacements) {
  const before = content;
  content = content.replace(pattern, replacement);
  if (content !== before) patched++;
}

if (patched === 0) {
  console.log('fix-expo-modules-core: no matching patterns found (version may have changed).');
  process.exit(0);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`fix-expo-modules-core: patched ${patched}/6 reject() overrides in Promise.kt.`);
