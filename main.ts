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

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output so a stale file can never slip into an entry.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

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
