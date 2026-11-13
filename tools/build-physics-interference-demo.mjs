import {CompositionBodySchema} from '@ardesia/contracts';
// Build-time use of the public safe expression parser; no browser script.
import {compileExpression} from '@ardesia/plugin-host/composition';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = value => new Intl.NumberFormat('it-IT', {maximumSignificantDigits: 6}).format(value);
const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);

export function interferenceDemo(definition) {
  const body = CompositionBodySchema.parse(definition.body), nodes = flatten(body.nodes);
  const scene = nodes.find(node => node.id === 'sharedScene');
  if (!scene || definition.typeId !== 'ardesia.physics.interference') throw Error('Missing canonical interference model');
  const initial = Object.fromEntries(body.fields.map(field => [field.key, field.initial]));
  const cases = [
    {id:'aligned', title:'In fase', phase:0, A2:1, explanation:'Le due oscillazioni sono concordi: l’ampiezza della somma è 2 cm.'},
    {id:'shifted', title:'Sfasate di 120°', phase:120, A2:1, explanation:'L’ampiezza risultante è 1 cm. All’istante selezionato, però, lo spostamento vale 0,5 cm: ampiezza e valore istantaneo sono grandezze diverse.'},
    {id:'cancelled', title:'Opposte e uguali', phase:180, A2:1, explanation:'Gli spostamenti si cancellano in ogni istante: la risultante è la linea blu orizzontale.'},
    {id:'unequal', title:'Opposte e diverse', phase:180, A2:2, explanation:'La seconda onda ha ampiezza doppia. Resta un’oscillazione di ampiezza 1 cm: essere in opposizione di fase non basta per cancellarsi completamente.'},
  ];
  const panels = cases.map(item => {
    const state = {...initial, A1:1, phase:item.phase, A2:item.A2, time:0.125};
    const evaluate = expression => Number(compileExpression(String(expression))(state));
    const numeric = expression => {
      const value = evaluate(expression);
      if (!Number.isFinite(value)) throw Error('Non-finite demo coordinate');
      return Math.round(value * 10000) / 10000;
    };
    const shapes = scene.children.map(node => {
      const p = node.props, x = numeric(p.x), y = numeric(p.y), w = numeric(p.width), h = numeric(p.height);
      if (p.shape === 'line') return `<line x1="${x}" y1="${y}" x2="${x+w}" y2="${y+h}" stroke="${p.color}" stroke-width="${node.id.startsWith('sum')?3.5:1.7}"${node.id.startsWith('second')?' stroke-dasharray="5 3"':''}/>`;
      if (p.shape === 'circle') return `<circle cx="${x}" cy="${y}" r="${Math.abs(w)}" fill="${p.color}"/>`;
      throw Error('Unsupported diagram shape');
    }).join('');
    const output = id => format(evaluate(nodes.find(node => node.id === id).props.expression));
    return `<div class="interference-case case-${item.id}"><h3>${escape(item.title)} · φ = ${item.phase}°</h3><p>A₁ = 1 cm · A₂ = ${item.A2} cm · f = 2 Hz</p><svg viewBox="0 0 ${scene.props.width} ${scene.props.height}" role="img" aria-label="${escape('Interferenza: '+item.title+'. '+item.explanation)}">${shapes}<g class="diagram-labels"><text x="48" y="268">0 s</text><text x="550" y="268" text-anchor="end">1 s</text><text x="4" y="44">+4</text><text x="18" y="144">0</text><text x="4" y="244">−4</text><text x="4" y="22">cm</text></g></svg><dl class="interference-results"><div><dt>Ampiezza risultante</dt><dd>${output('resultantAmplitude')} cm</dd></div><div><dt>Spostamento a 0,125 s</dt><dd>${output('sumValue')} cm</dd></div></dl><p>${escape(item.explanation)}</p></div>`;
  }).join('');
  return `<section id="interferenza" class="interference-demo"><p class="eyebrow">C5 / Un esperimento in quattro confronti</p><h2>Due onde. Una somma da prevedere.</h2><p>Se due onde arrivano insieme, la loro ampiezza si somma sempre? Prevedi il risultato, poi scegli le condizioni. Le curve condividono la stessa scala: una linea piatta significa cancellazione, non un cambio di ingrandimento.</p><p class="wave-key">Prima onda: verde, continua. Seconda: rame, tratteggiata. Somma: blu, più spessa. La linea scura segna t = 0,125 s.</p><fieldset class="interference-picker"><legend>Confronta le oscillazioni nello stesso punto</legend>${cases.map(item=>`<input class="interference-radio" type="radio" name="interference-case" id="wave-${item.id}" value="${item.id}"${item.id==='shifted'?' checked':''}><label for="wave-${item.id}">${escape(item.title)}</label>`).join('')}<div class="interference-cases" aria-live="polite">${panels}</div></fieldset><p>La frequenza e la direzione di oscillazione sono uguali e il mezzo risponde linearmente. Questo è un grafico del tempo in un punto, non una fotografia dell’onda nello spazio. Una cancellazione locale non dimostra una perdita di energia: per il bilancio servono anche sorgenti e campo nello spazio.</p><p>Il laboratorio completo del corso consente di variare separatamente ampiezze, fase e istante; questa anteprima confronta quattro condizioni.</p></section>`;
}
