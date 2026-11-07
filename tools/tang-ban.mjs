#!/usr/bin/env node
/**
 * Nâng số cuối phiên bản app: 1.4.0 → 1.4.1 → 1.4.2… (chủ dự án 07.11.2026: mỗi bản ra là
 * một số mới, không giữ mãi một số như 1.3.0). Chạy ở bước 2 của mỗi lần giao hàng có đổi
 * app (web/engine), TRƯỚC khi commit: `pnpm ban:tang`. Nâng số giữa (1.5.0) thì sửa tay
 * `apps/web/package.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../apps/web/package.json', import.meta.url);
const text = readFileSync(file, 'utf8');
const cu = JSON.parse(text).version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(cu);
if (!m) throw new Error(`Phiên bản không đúng dạng a.b.c: ${cu}`);
const moi = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
writeFileSync(file, text.replace(`"version": "${cu}"`, `"version": "${moi}"`));
console.log(`Phiên bản app: ${cu} → ${moi}`);
