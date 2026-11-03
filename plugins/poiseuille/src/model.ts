import {isBoundedJson, type PluginState, type PluginView} from '@ardesia/plugin-sdk';

interface Geometry {radiusM: number; lengthM: number; viscosityPaS: number; densityKgPerM3: number;}
type Driving = {pressureDropPa: number; flowRateM3PerS?: never} | {flowRateM3PerS: number; pressureDropPa?: never};
export interface PoiseuilleState extends PluginState {schemaVersion: '1.0.0'; value: Geometry & Driving;}
export class PoiseuilleStateError extends Error {readonly code = 'INVALID_STATE';}
const ranges = {
  radiusM: {min: 0.0001, max: 0.01, step: 0.0001, label: 'Raggio', unit: 'm'},
  lengthM: {min: 0.01, max: 10, step: 0.01, label: 'Lunghezza del tratto sviluppato', unit: 'm'},
  viscosityPaS: {min: 0.0001, max: 1, step: 0.0001, label: 'Viscosità dinamica', unit: 'Pa·s'},
  densityKgPerM3: {min: 1, max: 2000, step: 1, label: 'Densità', unit: 'kg/m³'},
  pressureDropPa: {min: -10000, max: 10000, step: 1, label: 'Differenza di pressione', unit: 'Pa'},
  flowRateM3PerS: {min: -0.001, max: 0.001, step: 1e-9, label: 'Portata imposta', unit: 'm³/s'},
} as const;
const invalid = (message: string): never => {throw new PoiseuilleStateError(message);};

/** Exactly one boundary condition, no defaults, coercion or migration of saved states. */
export function parsePoiseuilleState(candidate: unknown): PoiseuilleState {
  if (!isBoundedJson(candidate) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return invalid('Stato non valido.');
  const state = candidate as Record<string, unknown>;
  if (Object.keys(state).sort().join(',') !== 'schemaVersion,value' || state.schemaVersion !== '1.0.0') return invalid('Versione dello stato non compatibile.');
  if (!state.value || typeof state.value !== 'object' || Array.isArray(state.value)) return invalid('Parametri mancanti.');
  const p = state.value as Record<string, unknown>;
  const pressure = Object.hasOwn(p, 'pressureDropPa'), flow = Object.hasOwn(p, 'flowRateM3PerS');
  if (pressure === flow) return invalid('Imposta esattamente una condizione: differenza di pressione oppure portata.');
  const keys = ['radiusM', 'lengthM', 'viscosityPaS', 'densityKgPerM3', pressure ? 'pressureDropPa' : 'flowRateM3PerS'];
  if (Object.keys(p).length !== keys.length || keys.some(key => !Object.hasOwn(p, key))) return invalid('Campi scientifici mancanti o aggiuntivi.');
  for (const key of keys as (keyof typeof ranges)[]) {
    const n = p[key], range = ranges[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < range.min || n > range.max) return invalid(`${range.label}: usa un numero SI tra ${range.min} e ${range.max}.`);
  }
  return {schemaVersion: '1.0.0', value: {...p} as unknown as Geometry & Driving};
}

export function evaluatePoiseuille(candidate: unknown) {
  const state = parsePoiseuilleState(candidate), p = state.value;
  const areaM2 = Math.PI * p.radiusM ** 2;
  const resistancePaSPerM3 = 8 * p.viscosityPaS * p.lengthM / (Math.PI * p.radiusM ** 4);
  const pressureDropPa = p.pressureDropPa ?? p.flowRateM3PerS! * resistancePaSPerM3;
  const flowRateM3PerS = p.flowRateM3PerS ?? pressureDropPa / resistancePaSPerM3;
  const meanVelocityMPerS = flowRateM3PerS / areaM2;
  const reynolds = p.densityKgPerM3 * Math.abs(meanVelocityMPerS) * 2 * p.radiusM / p.viscosityPaS;
  // Conservative activity exclusion, never a certification of physical laminarity/development.
  if (reynolds >= 2000) return invalid('Re ≥ 2000: questo esperimento esce dal dominio prudenziale dell’attività. Riduci la forzante; il regime laminare e sviluppato resta un’ipotesi.');
  return {state, areaM2, resistancePaSPerM3, pressureDropPa, flowRateM3PerS, meanVelocityMPerS,
    maximumVelocityMPerS: 2 * meanVelocityMPerS, reynolds};
}
export type PoiseuilleEvaluation = ReturnType<typeof evaluatePoiseuille>;

export function poiseuilleView(result: PoiseuilleEvaluation): PluginView {
  const p = result.state.value, pressureControl = Object.hasOwn(p, 'pressureDropPa');
  const keys = ['radiusM', 'lengthM', 'viscosityPaS', 'densityKgPerM3', pressureControl ? 'pressureDropPa' : 'flowRateM3PerS'] as (keyof typeof ranges)[];
  return {
    title: 'Flusso di Poiseuille · bozza',
    summary: `Condizione fissata: ${pressureControl ? 'differenza di pressione' : 'portata'}. Fluido newtoniano incomprimibile, flusso stazionario laminare già sviluppato in un tubo cilindrico rigido orizzontale, parete ferma senza slittamento.`,
    parameters: keys.map(key => ({key, ...ranges[key], value: p[key as keyof typeof p]!})),
    metrics: [
      {label: 'Portata', value: result.flowRateM3PerS, unit: 'm³/s'},
      {label: 'Differenza di pressione', value: result.pressureDropPa, unit: 'Pa'},
      {label: 'Area', value: result.areaM2, unit: 'm²'},
      {label: 'Velocità media', value: result.meanVelocityMPerS, unit: 'm/s'},
      {label: 'Velocità sull’asse (con segno)', value: result.maximumVelocityMPerS, unit: 'm/s'},
      {label: 'Reynolds indicativo, ipotesi da verificare', value: result.reynolds, unit: ''},
    ],
    plot: {xLabel: 'Posizione lungo un diametro', xUnit: 'm', yLabel: 'Velocità assiale', yUnit: 'm/s', series: [{id: 'axial-velocity', label: 'u(s) = 2ū[1 − (s/R)²], r = |s|',
      points: Array.from({length: 129}, (_, i) => {const fraction = i / 64 - 1; return {x: fraction * p.radiusM, y: result.maximumVelocityMPerS * (1 - fraction ** 2)};})}]},
    explanation: [
      'Obiettivo: distinguere la grandezza imposta da quella che risponde. Prerequisiti: pressione, portata Q = volume/tempo, area del cerchio e proporzioni. Prima di cambiare R, prevedi come cambieranno Q, Δp e la velocità media.',
      'Il bilancio viscoso con parete senza slittamento dà u(r) = Δp(R² − r²)/(4μL), dove r ≥ 0 è la distanza dall’asse. Sommando gli anelli di area 2πr dr si ottiene Q = πR⁴Δp/(8μL). Quindi ū = Q/(πR²) e la velocità sull’asse è 2ū. Il grafico percorre un diametro con coordinata s da −R a R e r = |s|; tutti i numeri derivano dallo stesso stato SI.',
      pressureControl ? 'Attività e feedback: mantieni Δp, μ e L fissi, raddoppia R. Previsione corretta: area ×4, Q ×16, ū ×4. Se hai previsto Q ×4, hai considerato solo l’area: recupera anche l’aumento ×4 della velocità media.' : 'Attività e feedback: mantieni Q, μ e L fissi, raddoppia R. Previsione corretta: area ×4, ū ÷4, Δp ÷16. Se hai previsto Q ×16, stai usando la condizione di pressione fissata al posto di quella di portata fissata.',
      'Transfer: a Q e R fissi, raddoppiare insieme μ e L richiede Δp ×4. Un confronto a pressione fissata risponde a una domanda diversa. Ogni confronto è condizionato al permanere delle ipotesi; a Δp fissa, R ×2 porta Re ×8 e può uscire dal dominio.',
      'Re = ρ|ū|2R/μ è indicativo: Re < 2000 non dimostra da solo né flusso laminare né sviluppo completo. L è la distanza fra due sezioni nel tratto già sviluppato, oltre l’ingresso; non è una verifica della lunghezza di sviluppo. I valori iniziali sono sintetici, non un fluido reale approvato.',
      'Il segno di Δp = p_ingresso − p_uscita fissa l’asse positivo; un valore negativo inverte Q e il profilo. A forzante nulla il fluido è fermo. Non ci sono traccianti animati o stime di turbolenza, stenosi, sangue reale, tubi deformabili, ingresso o CFD generale.',
      'Contenuto DRAFT: verifica numerica e review tecnica non sono approvazione scientifica o editoriale umana. Le spiegazioni non attribuiscono padronanza e questa vista non registra risposte dello studente.',
    ],
  };
}
