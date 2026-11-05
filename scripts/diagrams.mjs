#!/usr/bin/env node
// `npm run diagrams`: redraw docs/diagrams/*.puml as SVG (shown on GitHub).
// Needs Java 11+. PlantUML is downloaded once from Maven Central into node_modules/.cache.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = '1.2026.9';
const dir = 'docs/diagrams';
const cache = join('node_modules', '.cache', 'plantuml');
const jar = join(cache, `plantuml-${VERSION}.jar`);

const java = spawnSync('java', ['-version'], { stdio: 'ignore', shell: process.platform === 'win32' });
if (java.status !== 0) {
  console.error('✗ Cần cài Java 11+ (ví dụ https://adoptium.net) / Java 11+ is required.');
  console.error('  Hoặc dán nội dung file .puml vào https://www.plantuml.com/plantuml để xem / or paste a .puml file there.');
  process.exit(1);
}

if (!existsSync(jar)) {
  mkdirSync(cache, { recursive: true });
  const url = `https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/${VERSION}/plantuml-${VERSION}.jar`;
  console.log(`▶ Đang tải PlantUML ${VERSION}…`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`✗ Không tải được ${url} (${res.status})`); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) { console.error('✗ Tệp tải về không hợp lệ, thử lại sau vài phút.'); process.exit(1); }
  writeFileSync(jar, buf);
}

const files = readdirSync(dir).filter(f => f.endsWith('.puml')).map(f => join(dir, f));
console.log(`▶ Đang vẽ ${files.length} sơ đồ…`);
// Smetana layout is built in, so Graphviz is not needed.
const r = spawnSync('java', ['-Djava.awt.headless=true', '-jar', jar, '-tsvg', '-charset', 'UTF-8', '-failfast2', ...files], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`✓ Xong: ${dir}/*.svg`);
