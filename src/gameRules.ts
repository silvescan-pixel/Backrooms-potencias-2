export const STAGE_ORDER = [5, 6, 7, 8, 9, 3, 1, 2, 4] as const;

export const GAME_CONFIG = {
  MAX_POINTS: 10.0,
  POINTS_PER_CHAMBER: 10 / 9,
  MIN_POINTS_PER_CHAMBER: 7 / 9,
  PENALTY_PER_ERROR: 0.08,
  MIN_FULL_SCORE: 7.0,
  GOOD_ENDING_SCORE: 9.0,
  GRAIN_WEIGHT_GRAMS: 0.05,
} as const;

export type EndingMode = 'good_alex_saved' | 'escape_alex_lost' | 'bad_trapped';

export interface ChamberMetaEntry {
  displayNum: number;
  name: string;
  topic: string;
  badge: string;
}

export const CHAMBER_META: Record<number, ChamberMetaEntry> = {
  5: { displayNum: 1, name: 'Laboratorio del Multiplicador', topic: 'Producto de potencias con misma base', badge: 'Cámara 1' },
  6: { displayNum: 2, name: 'Laboratorio del Divisor', topic: 'Cociente de potencias con misma base', badge: 'Cámara 2' },
  7: { displayNum: 3, name: 'Cámara de Transformación', topic: 'Potencia de una potencia y simplificación', badge: 'Cámara 3' },
  8: { displayNum: 4, name: 'Laboratorio del Profesor Despistado', topic: 'Auditoría de errores y exponente cero (a⁰ = 1)', badge: 'Cámara 4' },
  9: { displayNum: 5, name: 'Consola de Criptografía Matemática', topic: 'Código Maestro: Operaciones combinadas', badge: 'Cámara 5' },
  3: { displayNum: 6, name: 'La Sala Cuadrada', topic: 'Áreas y cálculo de raíz cuadrada exacta', badge: 'Cámara 6' },
  1: { displayNum: 7, name: 'El Archivo de Granos de Trigo', topic: 'Crecimiento exponencial en potencias de 2 (Sissa)', badge: 'Cámara 7' },
  2: { displayNum: 8, name: 'Taller de Papel de Calibración', topic: 'Espesor acumulativo y modelo e = 0,1 · 2ⁿ', badge: 'Cámara 8' },
  4: { displayNum: 9, name: 'El Puente Láser de la Diagonal', topic: 'Teorema de Pitágoras e irracionales en la recta (Salida)', badge: 'Cámara 9' },
};

export function getStageIndexForChamber(chamberNum: number): number {
  const idx = STAGE_ORDER.indexOf(chamberNum as (typeof STAGE_ORDER)[number]);
  return idx !== -1 ? idx + 1 : 1;
}

export function calculateChamberPoints(attempts: number): number {
  const normalizedAttempts = Math.max(1, attempts || 1);
  const rawPoints =
    GAME_CONFIG.POINTS_PER_CHAMBER - (normalizedAttempts - 1) * GAME_CONFIG.PENALTY_PER_ERROR;
  return Math.max(GAME_CONFIG.MIN_POINTS_PER_CHAMBER, rawPoints);
}

export function formatScoreDisplay(score: number): string {
  return score >= GAME_CONFIG.MAX_POINTS ? '10' : score.toFixed(1);
}

export function computeFinalScore(
  rawScore: number,
  completedCount: number,
  hasNoErrors = false,
): number {
  if (completedCount === STAGE_ORDER.length && hasNoErrors) {
    return GAME_CONFIG.MAX_POINTS;
  }
  const rounded = Math.round(rawScore * 10) / 10;
  if (completedCount === STAGE_ORDER.length) {
    return Math.max(GAME_CONFIG.MIN_FULL_SCORE, Math.min(GAME_CONFIG.MAX_POINTS, rounded));
  }
  return Math.max(0, Math.min(GAME_CONFIG.MAX_POINTS, rounded));
}

export function resolveEndingMode(
  finalScore: number,
  completedCount: number,
  isEarlyDiploma: boolean,
): EndingMode {
  if (isEarlyDiploma || completedCount < STAGE_ORDER.length) {
    return 'bad_trapped';
  }
  return finalScore >= GAME_CONFIG.GOOD_ENDING_SCORE ? 'good_alex_saved' : 'escape_alex_lost';
}

export function computeTruncatedWheatKg(grains: number): number {
  const exactKg = (grains * GAME_CONFIG.GRAIN_WEIGHT_GRAMS) / 1000;
  return Math.floor(exactKg);
}

export function validateWheatIntegerInput(raw: string): {
  valid: boolean;
  value?: number;
  errorType?: 'empty' | 'non_integer';
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, errorType: 'empty' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, errorType: 'non_integer' };
  }
  return { valid: true, value: parseInt(trimmed, 10) };
}

export function computePaperThickness(folds: number): {
  layers: number;
  mm: number;
  cm: number;
  meters: number;
} {
  const layers = Math.pow(2, folds);
  const mm = 0.1 * layers;
  const cm = mm / 10;
  const meters = mm / 1000;
  return { layers, mm, cm, meters };
}
