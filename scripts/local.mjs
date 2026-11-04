#!/usr/bin/env node
// `npm start`: run the whole app (game server + web app) on this computer.
// Nothing to configure: a local secret is generated on first run.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const shell = process.platform === 'win32';
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `# Local development secrets (not committed)\nAUTH_SECRET=${randomBytes(24).toString('hex')}\n`);
  console.log('✓ Đã tạo .dev.vars với khóa bí mật cho máy chủ chạy thử');
}
console.log('\n▶ Đang build app…');
run('npx', ['vite', 'build', '--logLevel', 'warn']);
console.log('▶ Đang chuẩn bị cơ sở dữ liệu cục bộ…');
// CI=1 makes wrangler skip the "continue? (Y/n)" prompt: this only touches the local database.
run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], { CI: '1' });
console.log('\n🎉 Mở http://localhost:8787 để chơi. Nhấn Ctrl+C để dừng.\n');
// DEV=1 enables the "admin login (development only)" button in Settings.
const dev = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--var', 'DEV:1'], { stdio: 'inherit', shell });
dev.on('exit', code => process.exit(code ?? 0));
