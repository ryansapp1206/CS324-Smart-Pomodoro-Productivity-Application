#!/usr/bin/env node
/* =====================================================================
   BUILD
   There's still no bundler: every build is the same files, copied.
     node scripts/build.mjs            all three
     node scripts/build.mjs chrome     just one (chrome | firefox | web | sync)

   Output in dist/:
     chrome/                              unpacked Chrome/Edge/Brave extension
     firefox/                             unpacked Firefox extension
     pomodoro-chrome-<version>.zip        load or upload to the Chrome Web Store
     pomodoro-firefox-<version>.xpi       Firefox add-on file (a zip)
     pomodoro-sync.mjs                    the local network sync service (runs with Node.js)
     web/                                 the GitHub Pages site, with the two
                                          files above and the sync service under downloads/

   The manifest comes from scripts/manifest.base.json: the shared keys plus
   the "chrome" or "firefox" section. Set VERSION=1.2.3 to override the
   version (the GitHub workflow does, from the tag or run number).
   Needs Node 18+ and the `zip` command.
   ===================================================================== */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BROWSERS = ['chrome', 'firefox'];

/** What ships: the app page, its icons and the source (minus notes for developers). */
const APP_FILES = ['index.html', 'icons', 'src'];
const skipDocs = (source) => !source.endsWith('.md');

async function readBase() {
  const base = JSON.parse(await readFile(join(ROOT, 'scripts/manifest.base.json'), 'utf8'));
  const version = process.env.VERSION || base.version;
  if (!/^\d+(\.\d+){0,3}$/.test(version)) throw new Error(`VERSION must be 1 to 4 numbers with dots, got "${version}"`);
  return { base, version };
}

function manifestFor(browser, base, version) {
  const { chrome, firefox, ...shared } = base;
  const extra = { chrome, firefox }[browser];
  return {
    ...shared,
    ...extra,
    version,
    permissions: [...shared.permissions, ...(extra.permissions || [])],
  };
}

async function copyApp(target, { extension }) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const file of APP_FILES) {
    await cp(join(ROOT, file), join(target, file), {
      recursive: true,
      // The extension-only files stay out of the website.
      filter: (source) => skipDocs(source) && (extension || !source.includes(join('src', 'extension'))),
    });
  }
}

function zip(folder, outFile) {
  rmSync(outFile, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', outFile, '.'], { cwd: folder, stdio: 'inherit' });
}

async function buildExtension(browser, base, version) {
  const folder = join(DIST, browser);
  await copyApp(folder, { extension: true });
  await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifestFor(browser, base, version), null, 2) + '\n');
  const file = join(DIST, `pomodoro-${browser}-${version}.${browser === 'firefox' ? 'xpi' : 'zip'}`);
  zip(folder, file);
  console.log(`built ${browser}: dist/${browser}/ and ${file.slice(ROOT.length + 1)}`);
  return file;
}

/** The sync service is one standalone file that runs with Node.js. */
async function buildSyncService() {
  const file = join(DIST, 'pomodoro-sync.mjs');
  await cp(join(ROOT, 'sync-service/pomodoro-sync.mjs'), file);
  console.log('built sync service: dist/pomodoro-sync.mjs');
  return file;
}

async function buildWeb(packages) {
  const folder = join(DIST, 'web');
  await copyApp(folder, { extension: false });
  await writeFile(join(folder, '.nojekyll'), '');
  if (packages.length) {
    await mkdir(join(folder, 'downloads'), { recursive: true });
    for (const file of packages) {
      if (file.endsWith('.mjs')) {
        await cp(file, join(folder, 'downloads', basename(file)));
        continue;
      }
      // A stable name too, so the site can always link to the latest one.
      const latest = basename(file).replace(/-[\d.]+\.(zip|xpi)$/, '-latest.$1');
      await cp(file, join(folder, 'downloads', latest));
    }
  }
  console.log('built web: dist/web/');
}

const wanted = process.argv.slice(2);
const want = (name) => !wanted.length || wanted.includes(name);
const { base, version } = await readBase();
await mkdir(DIST, { recursive: true });

const packages = [];
for (const browser of BROWSERS) if (want(browser)) packages.push(await buildExtension(browser, base, version));
if (want('sync') || want('web') || !wanted.length) packages.push(await buildSyncService());
if (want('web')) await buildWeb(packages);
