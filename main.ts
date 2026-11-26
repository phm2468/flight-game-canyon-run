// Canyon Run's hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ beside this file: plain
// files a desktop browser opens offline, no build step. This program
// copies game/ and screenshots/ into the output directory and writes the
// dossier the judge reads, using the vendored make.fun library, whose
// bytes the scorer reproduces exactly when it grades the entry.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output so a stale file can never slip into an entry.
// Remove only the contents, never the directory itself: the grader's
// /output is owned by root and rmdir of it needs write permission on its
// parent, which the grader user does not have (EPERM). Emptying the
// contents is enough and works with only write permission on /output.
// A previous run's copies are read-only (cpSync preserves the modes of
// the read-only /bot source), so make each entry writable before
// removing it, or a second run would fail with EACCES on its own output.
function makeWritable(path: string): void {
  const st = lstatSync(path);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    for (const child of readdirSync(path)) makeWritable(join(path, child));
  }
  chmodSync(path, st.mode | 0o200);
}

mkdirSync(outputDir, { recursive: true });
for (const child of readdirSync(outputDir)) {
  const childPath = join(outputDir, child);
  makeWritable(childPath);
  rmSync(childPath, { recursive: true, force: true });
}

cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsFrom = join(repoRoot, 'screenshots');
if (!existsSync(shotsFrom)) {
  throw new Error('screenshots/ is missing: the entry needs 3 or 4 screenshots of the game');
}
cpSync(shotsFrom, join(outputDir, 'screenshots'), { recursive: true });

// The caps are the scorer's own (see the competition's gate): only
// text_max_bytes shapes the dossier's bytes; the rest make this program
// refuse exactly what the scorer would refuse, here instead of there.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Canyon Run handed in: game/ and screenshots/ copied to ${outputDir}, dossier.json written (${dossier.length} bytes).`);
