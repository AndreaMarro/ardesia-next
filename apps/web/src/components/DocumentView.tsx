import type {LessonDocument} from '@ardesia/contracts';
import {ObjectContent} from './ObjectContent';
export function DocumentView({document, mode, onSelect}: {document: LessonDocument; mode: 'notebook' | 'reader'; onSelect: (id: string) => void}) {
  const objects = [...document.objects].sort((a,b) => a.y - b.y || a.x - b.x);
  return <section className={`document-view ${mode}`} aria-label={mode === 'notebook' ? 'Taccuino della lezione' : 'Lettura della lezione'}>
    <article className="reading-page">
      <p className="document-meta">{mode === 'notebook' ? 'Il mio taccuino' : 'Lettura personale'} · Bozza</p>
      <h2>{document.title}</h2>
      {objects.length === 0 && <p>La pagina è pronta. Aggiungi il primo oggetto dalla lavagna.</p>}
      {objects.map((object, index) => <section key={object.id} className={`reading-object type-${object.type}`} data-object-id={object.id}>
        <div className="reading-object-heading"><h3>{object.type === 'ink' ? 'Annotazione' : object.title}</h3>{mode === 'notebook' && <button className="text-button" aria-label={`Modifica ${object.title}`} onClick={() => onSelect(object.id)}>Modifica</button>}</div>
        <ObjectContent object={object} links/>
        {object.type === 'source' && <p className="source-revision">{object.data.sourceRevision}</p>}
        {mode === 'notebook' && <span className="object-revision">{String(index + 1).padStart(2,'0')} · revisione {object.revision}</span>}
      </section>)}
    </article>
  </section>;
}
