#!/usr/bin/env node
/**
 * `npm run setup`: put your own copy of Bàn Cờ online on Cloudflare (free plan).
 * It asks a few questions, then logs in, creates the database, sets the secret,
 * builds and deploys. Safe to run again later (it reuses what already exists).
 *
 * Non-interactive: npm run setup -- --yes   (reads APP_NAME, ADMIN_EMAILS, GOOGLE_CLIENT_ID from the environment)
 * Preview only:    npm run setup -- --dry-run
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const YES = args.has('--yes') || args.has('-y');
const shell = process.platform === 'win32';

const c = { b: s => `\x1b[1m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m` };
const step = (n, s) => console.log(`\n${c.b(`[${n}/7]`)} ${s}`);

/** Run wrangler; returns stdout. `show` streams output to the terminal. */
function wrangler(argv, { show = false, input, allowFail = false, env } = {}) {
  if (DRY) { console.log(c.d(`  (dry-run) npx wrangler ${argv.join(' ')}`)); return ''; }
  const r = spawnSync('npx', ['wrangler', ...argv], {
    encoding: 'utf8', shell, input, env: env ? { ...process.env, ...env } : process.env,
    stdio: show ? ['inherit', 'inherit', 'inherit'] : input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
  });
  if (r.status !== 0 && !allowFail) {
    console.error(c.r(`\n✗ Lệnh thất bại: npx wrangler ${argv.join(' ')}`));
    if (r.stderr) console.error(r.stderr);
    process.exit(1);
  }
  return (r.stdout ?? '') + (r.stderr ?? '');
}

/**
 * Run wrangler showing its output live (so any question it asks, such as
 * registering a workers.dev subdomain on a new account, is visible and can be
 * answered) while also capturing it.
 */
function wranglerLive(argv) {
  if (DRY) { console.log(c.d(`  (dry-run) npx wrangler ${argv.join(' ')}`)); return Promise.resolve(''); }
  return new Promise(resolve => {
    const child = spawn('npx', ['wrangler', ...argv], { shell, stdio: ['inherit', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); });
    child.stderr.on('data', d => { out += d; process.stderr.write(d); });
    child.on('close', code => {
      if (code !== 0) { console.error(c.r(`\n✗ Lệnh thất bại: npx wrangler ${argv.join(' ')}`)); process.exit(code ?? 1); }
      resolve(out);
    });
  });
}

export function setTomlString(toml, key, value) {
  const re = new RegExp(`^(${key}\\s*=\\s*)"[^"]*"`, 'm');
  return re.test(toml) ? toml.replace(re, `$1${JSON.stringify(value)}`) : toml;
}

export function setDatabase(toml, name, id) {
  toml = toml.replace(/^(database_name\s*=\s*)"[^"]*"/m, `$1${JSON.stringify(name)}`);
  if (/^database_id\s*=/m.test(toml)) return toml.replace(/^(database_id\s*=\s*)"[^"]*"/m, `$1${JSON.stringify(id)}`);
  return toml.replace(/^(database_name\s*=.*)$/m, `$1\ndatabase_id = ${JSON.stringify(id)}`);
}

export function findUuid(text) {
  return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

async function main() {
  console.log(c.b('\n♟  Bàn Cờ — cài đặt lên Cloudflare\n'));
  console.log('Bạn cần một tài khoản Cloudflare miễn phí: https://dash.cloudflare.com/sign-up');
  if (DRY) console.log(c.y('Chế độ xem trước (--dry-run): không thay đổi gì.'));

  let toml = readFileSync('wrangler.toml', 'utf8');
  const current = (key) => toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1] ?? '';

  // ---- 1. Questions
  step(1, 'Thông tin cho bản của bạn');
  const rl = YES ? null : createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, def, env) => {
    if (YES) return process.env[env] ?? def;
    const a = (await rl.question(`${q}${def ? c.d(` [${def}]`) : ''}: `)).trim();
    return a || def;
  };
  let app = await ask('Tên app (chữ thường, số, dấu gạch; dùng trong địa chỉ web)', current('name') || 'ban-co', 'APP_NAME');
  app = app.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'ban-co';
  const admins = await ask('Email Google của quản trị viên (nhiều email cách nhau bằng dấu phẩy, Enter để bỏ qua)', current('ADMIN_EMAILS'), 'ADMIN_EMAILS');
  console.log(c.d('  Google Client ID bật nút "Đăng nhập Google". Tạo tại https://console.cloud.google.com/apis/credentials (loại Web application).'));
  const google = await ask('Google Client ID (Enter để bỏ qua, có thể thêm sau)', current('GOOGLE_CLIENT_ID'), 'GOOGLE_CLIENT_ID');
  rl?.close();

  // ---- 2. Login
  step(2, 'Đăng nhập Cloudflare');
  const who = wrangler(['whoami'], { allowFail: true });
  if (!DRY && /not authenticated|You are not logged in/i.test(who)) wrangler(['login'], { show: true });
  else console.log(c.g('  ✓ Đã đăng nhập'));

  // ---- 3. Database
  step(3, 'Cơ sở dữ liệu D1');
  const dbName = app;
  let dbId = null;
  if (!DRY) {
    const list = wrangler(['d1', 'list', '--json'], { allowFail: true });
    try {
      const json = JSON.parse(list.slice(list.indexOf('[')));
      dbId = json.find(d => d.name === dbName)?.uuid ?? null;
    } catch { /* older wrangler output */ }
  }
  if (dbId) console.log(c.g(`  ✓ Dùng lại cơ sở dữ liệu "${dbName}"`));
  else {
    // Asia-Pacific location (players in Vietnam). CI=1: no "update your config?" question, this script writes it.
    const out = wrangler(['d1', 'create', dbName, '--location', 'apac'], { env: { CI: '1' } });
    dbId = findUuid(out) ?? (DRY ? '00000000-0000-0000-0000-000000000000' : null);
    if (!dbId) { console.error(c.r('✗ Không đọc được database_id. Hãy chạy lại.')); console.error(out); process.exit(1); }
    console.log(c.g(`  ✓ Đã tạo cơ sở dữ liệu "${dbName}"`));
  }

  // ---- 4. Write wrangler.toml
  step(4, 'Ghi cấu hình vào wrangler.toml');
  toml = toml.replace(/^(name\s*=\s*)"[^"]*"/m, `$1${JSON.stringify(app)}`);
  toml = setDatabase(toml, dbName, dbId);
  toml = setTomlString(toml, 'ADMIN_EMAILS', admins);
  toml = setTomlString(toml, 'GOOGLE_CLIENT_ID', google);
  if (DRY) console.log(c.d(toml.split('\n').filter(l => /^(name|database_|ADMIN_EMAILS|GOOGLE_CLIENT_ID)/.test(l)).map(l => '  ' + l).join('\n')));
  else writeFileSync('wrangler.toml', toml);
  console.log(c.g('  ✓ Xong'));

  // ---- 5. Build
  step(5, 'Build app');
  if (DRY) console.log(c.d('  (dry-run) npm run build'));
  else {
    const r = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  // ---- 6. Migrate + deploy
  step(6, 'Tạo bảng dữ liệu và đưa app lên mạng');
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote'], { show: true });
  const deployOut = await wranglerLive(['deploy']);
  const url = deployOut.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? `https://${app}.<tài-khoản>.workers.dev`;

  // ---- 7. Secret
  step(7, 'Khóa bí mật cho phiên đăng nhập');
  const secrets = DRY ? '' : wrangler(['secret', 'list'], { allowFail: true });
  if (secrets.includes('AUTH_SECRET')) console.log(c.g('  ✓ Đã có AUTH_SECRET (giữ nguyên để người chơi không bị đăng xuất)'));
  else {
    wrangler(['secret', 'put', 'AUTH_SECRET'], { input: randomBytes(32).toString('hex') + '\n' });
    console.log(c.g('  ✓ Đã tạo AUTH_SECRET ngẫu nhiên'));
  }

  console.log(`\n${c.g(c.b('🎉 Xong!'))} App của bạn: ${c.b(url)}\n`);
  if (admins) console.log(`• Đăng nhập Google bằng ${admins} để vào trang quản trị (biểu tượng khiên 🛡️).`);
  if (google) console.log(`• Nhớ thêm ${url} vào "Authorized JavaScript origins" của Google Client ID.`);
  else console.log('• Muốn có đăng nhập Google: tạo Client ID rồi chạy lại "npm run setup".');
  console.log('• Cập nhật bản mới sau này: "npm run deploy".\n');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('setup.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
