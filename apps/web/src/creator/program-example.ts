import {PROGRAM_RENDERER,type ExtensionDefinition} from '@ardesia/contracts';

export function initialProgram():ExtensionDefinition{
  return {format:'ardesia-extension/1',typeId:'user.'+crypto.randomUUID(),version:1,name:'Il mio atelier',description:'Una raccolta di idee inventata con codice. Cambia struttura, comportamento e interfaccia.',license:'Tutti i diritti riservati',renderer:PROGRAM_RENDERER,fallback:'Atelier programmabile: raccogli idee, disegna connessioni e modifica l’esperienza.',body:{initialState:{draft:'',ideas:[],next:1},code:`function update({state, event}) {
  const s = {...state, ideas: [...state.ideas]};
  if (event.action === 'edit') s.draft = event.value;
  if (event.action === 'add' && s.draft.trim()) {
    s.ideas.push({id: s.next++, text: s.draft.trim()});
    s.draft = '';
  }
  if (event.action.startsWith('remove.')) {
    s.ideas = s.ideas.filter(idea => idea.id !== Number(event.action.split('.')[1]));
  }
  return {state: s, view: {tag: 'section', children: [
    {tag: 'h3', children: ['Dai forma a un’idea']},
    {tag: 'p', children: ['Ogni scheda è un punto di partenza. Il codice decide cosa succede dopo.']},
    {tag: 'label', children: ['La prossima idea',
      {tag: 'input', key: 'idea-input', attrs: {value: s.draft, 'aria-label': 'La prossima idea', maxLength: 120}, events: {input: 'edit'}}]},
    {tag: 'button', events: {click: 'add'}, children: ['Aggiungi idea']},
    {tag: 'svg', attrs: {viewBox: '0 0 400 80', 'aria-label': 'Punti della raccolta', role: 'img'}, children:
      s.ideas.slice(0, 16).map((idea, i) => ({tag: 'circle', key: String(idea.id), attrs: {cx: 15 + i * 24, cy: 40, r: 7, fill: '#235e50'}}))},
    {tag: 'ul', children: s.ideas.map(idea => ({tag: 'li', key: String(idea.id), children: [
      {tag: 'span', children: [idea.text]},
      {tag: 'button', attrs: {'aria-label': 'Rimuovi ' + idea.text}, events: {click: 'remove.' + idea.id}, children: ['Rimuovi']}
    ]}))}
  ]}};
}`}};
}
