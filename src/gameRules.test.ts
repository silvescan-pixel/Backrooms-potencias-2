import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STAGE_ORDER,
  CHAMBER_META,
  GAME_CONFIG,
  getStageIndexForChamber,
  calculateChamberPoints,
  computeFinalScore,
  formatScoreDisplay,
  resolveEndingMode,
  computeTruncatedWheatKg,
  validateWheatIntegerInput,
  computePaperThickness,
} from './gameRules';

test('STAGE_ORDER places the 5 algebra/powers chambers first, then 3, 1, 2, 4 with sequential displayNum 1..9', () => {
  assert.deepEqual([...STAGE_ORDER], [5, 6, 7, 8, 9, 3, 1, 2, 4]);
  STAGE_ORDER.forEach((internalId, index) => {
    assert.equal(getStageIndexForChamber(internalId), index + 1);
    assert.equal(CHAMBER_META[internalId].displayNum, index + 1);
    assert.equal(CHAMBER_META[internalId].badge, `Cámara ${index + 1}`);
  });
});

test('scoring system: 0 errors across all 9 chambers yields exact 10, heavy errors clamp at >= 7.0', () => {
  let perfectScore = 0;
  for (let i = 0; i < 9; i++) {
    perfectScore += calculateChamberPoints(1);
  }
  const perfectFinal = computeFinalScore(perfectScore, 9, true);
  assert.equal(perfectFinal, 10.0);
  assert.equal(formatScoreDisplay(perfectFinal), '10');

  let worstFullScore = 0;
  for (let i = 0; i < 9; i++) {
    worstFullScore += calculateChamberPoints(50);
  }
  assert.equal(computeFinalScore(worstFullScore, 9, false), 7.0);

  // Partial completion (<9) reflects exact accumulated score without forcing 7.0 floor
  const partialThreePerfect = calculateChamberPoints(1) * 3;
  assert.equal(computeFinalScore(partialThreePerfect, 3, true), 3.3);

  // Small mistake penalty drops slightly below 10
  const oneMistakeTotal = calculateChamberPoints(2) + calculateChamberPoints(1) * 8;
  const oneMistakeFinal = computeFinalScore(oneMistakeTotal, 9, false);
  assert.equal(oneMistakeFinal, 9.9);
  assert.equal(formatScoreDisplay(oneMistakeFinal), '9.9');
  assert.ok(GAME_CONFIG.PENALTY_PER_ERROR > 0);
});

test('ending resolution enforces Sobresaliente >= 9.0, intermediate 7.0..8.9, and bad_trapped on early diploma', () => {
  assert.equal(resolveEndingMode(9.0, 9, false), 'good_alex_saved');
  assert.equal(resolveEndingMode(10.0, 9, false), 'good_alex_saved');
  assert.equal(resolveEndingMode(8.9, 9, false), 'escape_alex_lost');
  assert.equal(resolveEndingMode(7.0, 9, false), 'escape_alex_lost');
  assert.equal(resolveEndingMode(9.5, 8, true), 'bad_trapped');
  assert.equal(resolveEndingMode(3.3, 3, true), 'bad_trapped');
});

test('wheat activity truncates exact kg to integer, rejects decimals/non-digits, and 38 kg is impossible for squares 1..64', () => {
  // Casilla 21: 2^20 = 1,048,576 grains -> 52,428.8 g -> 52.4288 kg -> truncated 52
  assert.equal(computeTruncatedWheatKg(Math.pow(2, 20)), 52);
  // Casilla 22: 2^21 = 2,097,152 grains -> 104.8576 kg -> truncated 104 (NOT rounded to 105)
  assert.equal(computeTruncatedWheatKg(Math.pow(2, 21)), 104);
  // Casilla 23: 2^22 = 4,194,304 -> 209.7152 kg -> truncated 209
  assert.equal(computeTruncatedWheatKg(Math.pow(2, 22)), 209);

  // Ensure the example 38 never collides with any chessboard square 1..64
  for (let sq = 1; sq <= 64; sq++) {
    assert.notEqual(computeTruncatedWheatKg(Math.pow(2, sq - 1)), 38);
  }

  assert.deepEqual(validateWheatIntegerInput('52'), { valid: true, value: 52 });
  assert.deepEqual(validateWheatIntegerInput('52,42'), { valid: false, errorType: 'non_integer' });
  assert.deepEqual(validateWheatIntegerInput('52.42'), { valid: false, errorType: 'non_integer' });
  assert.deepEqual(validateWheatIntegerInput('   '), { valid: false, errorType: 'empty' });
});

test('paper folding computes thickness in meters accurately', () => {
  const f14 = computePaperThickness(14);
  assert.equal(Number(f14.mm.toFixed(1)), 1638.4);
  assert.equal(Number(f14.meters.toFixed(4)), 1.6384);

  const f15 = computePaperThickness(15);
  assert.ok(f15.meters >= 1.8 && f15.meters >= 3.05);
  assert.ok(f15.meters < 3.5);
});

test('index.html standalone script matches STAGE_ORDER, syntax parses cleanly, and reflects all 7 pedagogical refinements', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scriptMatches.length >= 1, 'Expected inline <script> in index.html');
  const inlineJs = scriptMatches[scriptMatches.length - 1][1];

  // Validate JS syntax via Function constructor (throws SyntaxError if broken)
  assert.doesNotThrow(() => new Function(inlineJs));

  // Verify STAGE_ORDER parity inside index.html
  assert.ok(inlineJs.includes('const STAGE_ORDER = [5, 6, 7, 8, 9, 3, 1, 2, 4];'));

  // Verify required screens & non-alert UI
  assert.ok(html.includes('id="screen-title-splash"'));
  assert.ok(html.includes('id="screen-intro-silvextrux"'));
  assert.ok(html.includes('id="screen-intro-alex"'));
  assert.ok(html.includes('id="screen-ending"'));
  assert.ok(html.includes('id="btn-diploma-bad-ending"'));
  assert.equal(/\bwindow\.(alert|confirm|prompt)\b/.test(inlineJs), false);

  // 1. Grammar fix in Álex's intro
  assert.ok(html.includes('me tragó este laberinto'));
  assert.equal(html.includes('me tragué este laberinto'), false);

  // 2. No negative-base handholding or explicit sign spoilers in Cámaras 1–3
  assert.equal(html.includes('Ej: -3'), false);
  assert.equal(html.includes('Base (con signo):'), false);
  assert.equal(html.includes('conserva su signo negativo'), false);
  assert.equal(html.includes('cuidado con los signos negativos'), false);
  assert.equal(html.includes('Exponente 1 Tácito'), false);

  // 3. Combined op clarifies numeric result instead of power expression
  assert.ok(html.includes('no la potencia'));
  assert.ok(inlineJs.includes('Resultado numérico de la potencia simplificada'));

  // 4. Wheat example uses impossible value 38 / 38,76 kg instead of 52 / 52,42 kg
  assert.ok(inlineJs.includes('38,76 kg'));
  assert.equal(inlineJs.includes('52,42 kg'), false);

  // 5. Scoring returns exact 10 when all 9 chambers are solved with 0 errors
  assert.ok(inlineJs.includes('function formatScoreDisplay(score)'));
  assert.ok(inlineJs.includes('if (completedCount === STAGE_ORDER.length && hasNoErrors)'));

  // 6. Laser bridge uses expanded 720x380 viewBox and non-trivial roots (no sumSq 5, 8, 10)
  assert.ok(html.includes('viewBox="0 0 720 380"'));
  assert.equal(/sumSq:\s*(5|8|10)\b/.test(inlineJs), false);
  assert.ok(/sumSq:\s*13\b/.test(inlineJs));

  // 7. Anti-repeat helper exists and spoiler strings remain absent
  assert.ok(inlineJs.includes('function pickNonRepeating('));
  assert.equal(inlineJs.includes('= <b>${data.partA.base}<sup>${data.partA.correctExp}</sup></b>'), false);
  assert.equal(inlineJs.includes('= <b>${data.partA.correctBase}<sup>${data.partA.correctExp}</sup></b>'), false);
  assert.equal(inlineJs.includes('Resultado: (-${data.partB.base})<sup>${data.partB.correctExp}</sup>'), false);
  assert.equal(inlineJs.includes('<b>${data.partC.correctBase}<sup>${data.partC.correctExp}</sup></b>'), false);
  assert.equal(inlineJs.includes('Resultado: ${data.partC.correctBase}<sup>${data.partC.correctExp}</sup>'), false);
  assert.equal(inlineJs.includes('Solución: ${stmt.explanation}'), false);
  assert.equal(inlineJs.includes('El resultado real es ${data.finalCode}'), false);
  assert.equal(inlineJs.includes('El valor real es ${data.weightKg} kg'), false);
});

test('all 9 chambers have valid security-feed scene images, metadata, and offline export inlining', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const inlineJs = scriptMatches[scriptMatches.length - 1][1];

  assert.ok(html.includes('id="intro-chamber-scene-img"'));
  assert.ok(html.includes('id="intro-chamber-rec-text"'));
  assert.ok(html.includes('id="intro-chamber-cam-label"'));
  assert.ok(html.includes('id="chamber-asset-preload"'));
  assert.ok(inlineJs.includes('toSceneBase64'));
  assert.ok(inlineJs.includes('#chamber-asset-preload img[src]'));

  STAGE_ORDER.forEach((internalId, index) => {
    const camTag = `CAM-0${index + 1}`;
    assert.ok(inlineJs.includes(`camTag: "${camTag}"`), `Missing camTag ${camTag}`);

    const imgRegex = new RegExp(
      `<img[^>]*data-chamber="${internalId}"[^>]*src="(/src/assets/images/[^"]+\\.jpg)"[^>]*>`,
      'i'
    );
    const match = html.match(imgRegex);
    assert.ok(match, `Missing preload <img> for internal chamber ${internalId}`);
    assert.ok(match[0].includes('referrerpolicy="no-referrer"'), `Missing referrerPolicy for chamber ${internalId}`);

    const diskPath = path.resolve(process.cwd(), match[1].replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Image file missing on disk: ${diskPath}`);
    assert.ok(fs.statSync(diskPath).size > 10000, `Image file suspiciously small: ${diskPath}`);
  });
});

test('splash screen and all 3 ending scenes have valid generated images and offline inlining', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const inlineJs = scriptMatches[scriptMatches.length - 1][1];

  assert.ok(html.includes('id="splash-bg-img"'));
  assert.ok(html.includes('id="ending-scene-img"'));
  assert.ok(html.includes('id="ending-scene-caption"'));
  assert.ok(inlineJs.includes('#chamber-asset-preload img[data-scene='));

  ['splash', 'ending-good', 'ending-partial', 'ending-bad'].forEach((sceneKey) => {
    const imgRegex = new RegExp(
      `<img[^>]*data-scene="${sceneKey}"[^>]*src="(/src/assets/images/[^"]+\\.jpg)"[^>]*>`,
      'i'
    );
    const match = html.match(imgRegex);
    assert.ok(match, `Missing preload <img> for scene ${sceneKey}`);
    assert.ok(match[0].includes('referrerpolicy="no-referrer"'), `Missing referrerPolicy for scene ${sceneKey}`);

    const diskPath = path.resolve(process.cwd(), match[1].replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Scene image missing on disk: ${diskPath}`);
    assert.ok(fs.statSync(diskPath).size > 10000, `Scene image suspiciously small: ${diskPath}`);
  });
});

test('chambers 1, 2, and 3 (internal 5, 6, 7) use strictly positive exponents and ~50/50 positive vs negative bases', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const inlineJs = scriptMatches[scriptMatches.length - 1][1];

  // Extract pickNonRepeating + ChallengeGenerators safely without DOM bindings
  const genStart = inlineJs.indexOf('function pickNonRepeating(');
  const genEnd = inlineJs.indexOf('// 5. CONTROLADOR DE PANTALLAS');
  assert.ok(genStart > 0 && genEnd > genStart);

  const factory = new Function(
    'sessionStorage',
    'CONFIG',
    `${inlineJs.slice(genStart, genEnd)}; return ChallengeGenerators;`
  );
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); }
  };
  const generators = factory(mockStorage, { GRAIN_WEIGHT_GRAMS: 0.05 });

  let posCount = 0;
  let negCount = 0;

  for (let i = 0; i < 60; i++) {
    const c5 = generators.genChamber5();
    assert.equal(c5.partA.correctBase, c5.partA.base);
    assert.equal(c5.partA.correctExp, c5.partA.m + c5.partA.n);
    assert.ok(c5.partA.m >= 2 && c5.partA.n >= 2 && c5.partA.correctExp >= 4);

    assert.equal(c5.partB.correctBase, c5.partB.base);
    assert.equal(c5.partB.correctExp, c5.partB.p + 1 + c5.partB.q);
    assert.ok(c5.partB.p >= 2 && c5.partB.q >= 2 && c5.partB.correctExp >= 5);

    assert.equal(c5.partC.correctBase, c5.partC.c * c5.partC.d);
    assert.equal(c5.partC.correctExp, c5.partC.k);
    assert.ok(c5.partC.k >= 2 && c5.partC.correctExp >= 2);

    const c5Negs = [
      c5.partA.base < 0,
      c5.partB.base < 0,
      c5.partC.c < 0 || c5.partC.d < 0
    ];
    assert.ok(c5Negs.some(Boolean), 'Each Cámara 1 run must include at least one negative-base question');
    assert.ok(c5Negs.some(v => !v), 'Each Cámara 1 run must include at least one positive-base question');

    const c6 = generators.genChamber6();
    assert.equal(c6.partA.correctBase, c6.partA.base);
    assert.equal(c6.partA.correctExp, c6.partA.m - c6.partA.n);
    assert.ok(c6.partA.m > c6.partA.n && c6.partA.n >= 2 && c6.partA.correctExp >= 2);

    assert.equal(c6.partB.correctBase, c6.partB.base);
    assert.equal(c6.partB.correctExp, c6.partB.p - c6.partB.q);
    assert.ok(c6.partB.p > c6.partB.q && c6.partB.q >= 2 && c6.partB.correctExp >= 2);

    assert.equal(c6.partC.correctBase, c6.partC.a / c6.partC.b);
    assert.equal(c6.partC.correctExp, c6.partC.k);
    assert.ok(c6.partC.k >= 2 && Number.isInteger(c6.partC.correctBase));

    const c6Negs = [
      c6.partA.base < 0,
      c6.partB.base < 0,
      c6.partC.a < 0 || c6.partC.b < 0
    ];
    assert.ok(c6Negs.some(Boolean), 'Each Cámara 2 run must include at least one negative-base question');
    assert.ok(c6Negs.some(v => !v), 'Each Cámara 2 run must include at least one positive-base question');

    const c7 = generators.genChamber7();
    assert.equal(c7.partA.correctBase, c7.partA.base);
    assert.equal(c7.partA.correctExp, c7.partA.m * c7.partA.n);
    assert.ok(c7.partA.m >= 2 && c7.partA.n >= 2 && c7.partA.correctExp >= 4);

    assert.equal(c7.partB.correctBase, c7.partB.base);
    assert.equal(c7.partB.correctExp, c7.partB.p * c7.partB.q * c7.partB.r);
    assert.ok(c7.partB.p >= 2 && c7.partB.q >= 2 && c7.partB.r >= 2 && c7.partB.correctExp >= 8);

    assert.equal(c7.partC.correctBase, c7.partC.base);
    assert.equal(c7.partC.correctExp, (c7.partC.m + c7.partC.n) * c7.partC.p);
    assert.ok(c7.partC.m >= 2 && c7.partC.n >= 2 && c7.partC.p >= 2 && c7.partC.correctExp >= 8);

    const c7Negs = [
      c7.partA.base < 0,
      c7.partB.base < 0,
      c7.partC.base < 0
    ];
    assert.ok(c7Negs.some(Boolean), 'Each Cámara 3 run must include at least one negative-base question');
    assert.ok(c7Negs.some(v => !v), 'Each Cámara 3 run must include at least one positive-base question');

    [...c5Negs, ...c6Negs, ...c7Negs].forEach(isNeg => {
      if (isNeg) negCount++;
      else posCount++;
    });
  }

  const total = posCount + negCount;
  const negRatio = negCount / total;
  assert.ok(negRatio >= 0.4 && negRatio <= 0.6, `Expected ~50/50 positive vs negative bases, got ratio ${negRatio}`);

  // Verify Cámara 6 (internal 3) example (25 x 4 = 100 m², side = 10 m) never collides with genChamber3()
  assert.ok(html.includes('25 m de largo por 4 m de ancho'));
  assert.equal(html.includes('24 m de largo por 6 m de ancho'), false);
  for (let i = 0; i < 60; i++) {
    const c3 = generators.genChamber3();
    assert.notEqual(c3.area, 100, 'Cámara 6 example area 100 must never appear in genChamber3');
    assert.notEqual(c3.side, 10, 'Cámara 6 example side 10 must never appear in genChamber3');
    assert.ok(!(c3.w === 4 && c3.h === 25), 'Cámara 6 example dimensions must never appear in genChamber3');
  }
});

test('Bloque 2 visualizers, micro-animations, reduced-motion support, and original TensionAudioEngine are intact', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const inlineJs = scriptMatches[scriptMatches.length - 1][1];

  // Visualizers & animation hooks
  assert.ok(html.includes('id="wheat-growth-meter"'));
  assert.ok(html.includes('id="wheat-meter-fill"'));
  assert.ok(html.includes('id="wheat-scale-label"'));
  assert.ok(html.includes('id="paper-stack-viz"'));
  assert.ok(html.includes('id="paper-stack-pile"'));
  assert.ok(html.includes('id="paper-layers-badge"'));
  assert.ok(html.includes('id="paper-comparison-badge"'));
  assert.ok(html.includes('prefers-reduced-motion: reduce'));
  assert.ok(inlineJs.includes('laser-arc-animated'));
  assert.ok(inlineJs.includes('laser-vertex-halo'));
  assert.ok(inlineJs.includes('svg-area-flow-arrow'));
  assert.ok(inlineJs.includes('pill-stagger'));
  assert.ok(inlineJs.includes('packet-row-stagger'));
  assert.ok(inlineJs.includes('feedback-shake'));
  assert.ok(inlineJs.includes('gate-unlocked'));
  assert.ok(inlineJs.includes('c8-statement-row'));

  // Hidden initial state on c7-packets containers without trailing display: flex override
  assert.equal(
    /id="c7-packets-[abc]"[^>]*display:\s*none;[^"]*display:\s*flex/.test(html),
    false,
    'c7-packets containers must stay hidden initially until button click'
  );

  // Inner span wrapping for Cámara 3 Part B pills remains preserved
  assert.ok(inlineJs.includes('<span>${baseBLabel}<sup>${data.partB.p}</sup></span>'));

  // Original TensionAudioEngine preserved
  assert.ok(inlineJs.includes('class TensionAudioEngine'));
});




