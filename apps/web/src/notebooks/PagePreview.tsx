import {materialPosition, notebookPageSize, type LessonDocument, type PageLayout} from '@ardesia/contracts';
import {inkPath} from '../components/board-geometry';

/** A geometric preview only: no plugin execution and no change to object coordinates. */
export function PagePreview({layout, document}: {layout: PageLayout; document?: LessonDocument}) {
  const size = notebookPageSize(layout), objects = document?.objects.map(object => materialPosition(object, document.objects)) ?? [];
  const outside = objects.filter(object => object.x < 0 || object.y < 0 || object.x + object.width > size.width || object.y + object.height > size.height);
  const visible = objects.filter(object => object.x + object.width >= 0 && object.y + object.height >= 0 && object.x <= size.width && object.y <= size.height);
  return <figure className="notebook-layout-preview"><svg role="img" aria-label="Anteprima della geometria sul nuovo foglio" viewBox={`-30 -30 ${size.width + 60} ${size.height + 60}`}>
    <rect width={size.width} height={size.height} fill={layout.paper === 'ivory' ? '#fffdf3' : '#fff'} stroke="#a7bbb1" strokeWidth="2"/>
    {visible.slice(0, 100).map(object => <g key={object.id} transform={`translate(${object.x} ${object.y})`}>{object.type === 'ink' ? <path d={inkPath(object.data.points, object.data.width)} fill={object.data.color}/> : <rect width={object.width} height={object.height} fill="#63857522" stroke="#638575" strokeWidth="2"/>}</g>)}
  </svg><figcaption>{objects.length ? `${outside.length} oggetti oltre i bordi del formato scelto.` : 'Un foglio vuoto, pronto per scrivere.'}{visible.length > 100 && ' Anteprima dei primi 100 ingombri.'} Gli oggetti mantengono le loro dimensioni; nessun contenuto viene tagliato o spostato.</figcaption></figure>;
}
