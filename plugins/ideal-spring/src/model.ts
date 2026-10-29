import type {PluginState, PluginView} from '@ardesia/plugin-sdk';

export interface SpringParameters {
  readonly massKg: number;
  readonly stiffnessNPerM: number;
  readonly initialDisplacementM: number;
  readonly initialVelocityMPerS: number;
  readonly timeS: number;
}

export interface SpringState extends PluginState {
  readonly schemaVersion: '1.0.0';
  readonly value: SpringParameters;
}

export interface SpringEvaluation {
  readonly state: SpringState;
  readonly angularFrequencyRadPerS: number;
  readonly frequencyHz: number;
  readonly periodS: number;
  readonly amplitudeM: number;
  readonly displacementM: number;
  readonly velocityMPerS: number;
  readonly accelerationMPerS2: number;
  readonly forceN: number;
  readonly elasticEnergyJ: number;
  readonly kineticEnergyJ: number;
  readonly mechanicalEnergyJ: number;
  readonly initialEnergyJ: number;
}

export class SpringStateError extends Error {
  readonly code = 'INVALID_STATE';
  constructor(message: string) { super(message); this.name = 'SpringStateError'; }
}

const ranges = {
  massKg: {min: 0.1, max: 10},
  stiffnessNPerM: {min: 1, max: 200},
  initialDisplacementM: {min: -0.5, max: 0.5},
  initialVelocityMPerS: {min: -2, max: 2},
  timeS: {min: 0, max: 60},
} as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every(key => allowed.includes(key));
}

/** No coercion, clamping, inferred defaults or implicit state migration. */
export function parseSpringState(candidate: unknown): SpringState {
  if (!record(candidate) || !exactKeys(candidate, ['schemaVersion', 'value']) || candidate.schemaVersion !== '1.0.0') {
    throw new SpringStateError('Versione o struttura dello stato della molla non compatibile.');
  }
  const input = candidate.value;
  if (!record(input) || !exactKeys(input, Object.keys(ranges))) {
    throw new SpringStateError('Lo stato deve contenere esattamente massa, rigidità, posizione iniziale, velocità iniziale e tempo.');
  }
  for (const key of Object.keys(ranges) as Array<keyof SpringParameters>) {
    const value = input[key];
    const {min, max} = ranges[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new SpringStateError(`Parametro ${key} fuori dall’intervallo ammesso [${min}, ${max}].`);
    }
  }
  return {
    schemaVersion: '1.0.0',
    value: {
      massKg: input.massKg as number,
      stiffnessNPerM: input.stiffnessNPerM as number,
      initialDisplacementM: input.initialDisplacementM as number,
      initialVelocityMPerS: input.initialVelocityMPerS as number,
      timeS: input.timeS as number,
    },
  };
}

function phasePoint(parameters: SpringParameters, timeS: number) {
  const {massKg: m, stiffnessNPerM: k, initialDisplacementM: x0, initialVelocityMPerS: v0} = parameters;
  const omega = Math.sqrt(k / m);
  const phase = omega * timeS;
  const x = x0 * Math.cos(phase) + (v0 / omega) * Math.sin(phase);
  const v = -x0 * omega * Math.sin(phase) + v0 * Math.cos(phase);
  return {omega, x, v};
}

/** Exact solution of m x'' = -k x for a horizontal, undamped ideal spring. */
export function evaluateSpring(candidate: unknown): SpringEvaluation {
  const state = parseSpringState(candidate);
  const parameters = state.value;
  const {massKg: m, stiffnessNPerM: k, initialDisplacementM: x0, initialVelocityMPerS: v0, timeS} = parameters;
  const {omega, x, v} = phasePoint(parameters, timeS);
  const elasticEnergyJ = 0.5 * k * x * x;
  const kineticEnergyJ = 0.5 * m * v * v;
  return {
    state,
    angularFrequencyRadPerS: omega,
    frequencyHz: omega / (2 * Math.PI),
    periodS: (2 * Math.PI) / omega,
    amplitudeM: Math.hypot(x0, v0 / omega),
    displacementM: x,
    velocityMPerS: v,
    accelerationMPerS2: -(k / m) * x,
    forceN: -k * x,
    elasticEnergyJ,
    kineticEnergyJ,
    mechanicalEnergyJ: elasticEnergyJ + kineticEnergyJ,
    initialEnergyJ: 0.5 * k * x0 * x0 + 0.5 * m * v0 * v0,
  };
}

/** Scientific data, plain text and geometric quantities; never executable markup. */
export function springView(result: SpringEvaluation): PluginView {
  const p = result.state.value;
  const startS = Math.max(0, Math.min(p.timeS - result.periodS, ranges.timeS.max - 2 * result.periodS));
  const points = Array.from({length: 257}, (_, index) => {
    const time = Math.min(ranges.timeS.max, startS + index * (2 * result.periodS) / 256);
    return {x: time, y: phasePoint(p, time).x};
  });
  return {
    title: 'Molla ideale',
    summary: 'Una massa si muove su un piano orizzontale senza attrito. La molla la richiama verso x = 0. Modifica i parametri e osserva lo stesso stato nel grafico e nel disegno.',
    parameters: [
      {key: 'massKg', label: 'Massa', unit: 'kg', ...ranges.massKg, step: 0.1, value: p.massKg},
      {key: 'stiffnessNPerM', label: 'Rigidità', unit: 'N/m', ...ranges.stiffnessNPerM, step: 1, value: p.stiffnessNPerM},
      {key: 'initialDisplacementM', label: 'Posizione iniziale', unit: 'm', ...ranges.initialDisplacementM, step: 0.01, value: p.initialDisplacementM},
      {key: 'initialVelocityMPerS', label: 'Velocità iniziale', unit: 'm/s', ...ranges.initialVelocityMPerS, step: 0.1, value: p.initialVelocityMPerS},
      {key: 'timeS', label: 'Tempo', unit: 's', ...ranges.timeS, step: 0.05, value: p.timeS},
    ],
    metrics: [
      {label: 'Posizione', value: result.displacementM, unit: 'm'},
      {label: 'Velocità', value: result.velocityMPerS, unit: 'm/s'},
      {label: 'Forza elastica', value: result.forceN, unit: 'N'},
      {label: 'Periodo', value: result.periodS, unit: 's'},
      {label: 'Frequenza', value: result.frequencyHz, unit: 'Hz'},
      {label: 'Energia elastica', value: result.elasticEnergyJ, unit: 'J'},
      {label: 'Energia cinetica', value: result.kineticEnergyJ, unit: 'J'},
      {label: 'Energia totale', value: result.mechanicalEnergyJ, unit: 'J'},
    ],
    plot: {
      xLabel: 'Tempo', xUnit: 's', yLabel: 'Posizione', yUnit: 'm',
      series: [{id: 'displacement', label: 'x(t)', points}],
    },
    diagram: {kind: 'spring', displacement: result.displacementM, amplitude: result.amplitudeM},
    explanation: [
      'La forza elastica è F = −kx: se la massa si trova a destra dell’equilibrio, la molla tira a sinistra. Se si trova a sinistra, la spinge a destra. Il segno descrive la direzione.',
      'Dalla seconda legge di Newton, m x″ = −kx. La pulsazione è ω = √(k/m), il periodo T = 2π√(m/k) e la frequenza f = 1/T. Quadruplicare la massa raddoppia il periodo; quadruplicare la rigidità lo dimezza.',
      'Con x(0) = x₀ e v(0) = v₀, la soluzione è x(t) = x₀ cos(ωt) + (v₀/ω) sin(ωt). La velocità è v(t) = −ωx₀ sin(ωt) + v₀ cos(ωt). Il grafico mostra due periodi nell’intervallo 0–60 s, attorno al tempo scelto dove possibile.',
      'L’energia elastica U = kx²/2 e quella cinetica K = mv²/2 si scambiano durante il moto. L’energia totale E = U + K resta costante perché non c’è attrito. Cambiare i parametri o le condizioni iniziali definisce un nuovo esperimento, quindi può cambiare E.',
      'Modello ideale: molla senza massa, legge di Hooke lineare, nessuno smorzamento e nessuna forza esterna orizzontale. x misura lo spostamento dall’equilibrio. Gli intervalli dei controlli delimitano questa attività e non certificano il limite elastico di una molla reale. Il disegno adatta la scala all’ampiezza ed è uno schema, non una misura geometrica.',
    ],
  };
}
