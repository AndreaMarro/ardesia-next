import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import {MousePointer2, SquarePen, Type, SquareFunction, Link2, Undo2} from 'lucide-react';
import type {EducationalObject, LessonDocument, NewEducationalObject} from '@ardesia/contracts';
import {ObjectContent} from './ObjectContent';

type Point = {x: number; y: number; pressure: number};
type Props = {
  document: LessonDocument; selectedId: string | null; onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onAdd: (type: 'note' | 'formula' | 'source') => void;
  onInk: (object: NewEducationalObject) => void; onUndo: () => void; canUndo: boolean;
};
export function Board(props: Props) {
  const {document, selectedId, onSelect, onMove, onAdd, onInk, onUndo, canUndo} = props;
  const [tool, setTool] = useState<'select' | 'pen'>('select');
  const [compact, setCompact] = useState(window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const query=window.matchMedia('(max-width: 760px)');
    const update=() => {setCompact(query.matches); if(query.matches) setTool('select');};
    query.addEventListener('change',update); return () => query.removeEventListener('change',update);
  },[]);
  const [points, setPoints] = useState<Point[]>([]);
  const surface = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const drag = useRef<{id: string; startX: number; startY: number; x: number; y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState<{id: string; x: number; y: number} | null>(null);
  function point(e: PointerEvent): Point {
    const rect = surface.current!.getBoundingClientRect();
    return {x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5};
  }
  function startInk(e: PointerEvent<HTMLDivElement>) {
    if(tool !== 'pen' || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; setPoints([point(e)]);
  }
  function moveInk(e: PointerEvent<HTMLDivElement>) {
    if(drawing.current) setPoints(current => current.length < 19990 ? [...current, point(e)] : current);
  }
  function finishInk(e: PointerEvent<HTMLDivElement>) {
    if(!drawing.current) return;
    drawing.current = false;
    const all = [...points, point(e)]; setPoints([]);
    if(all.length < 2) return;
    const minX = Math.min(...all.map(p => p.x)), minY = Math.min(...all.map(p => p.y));
    const width = Math.max(2, Math.max(...all.map(p => p.x)) - minX), height = Math.max(2, Math.max(...all.map(p => p.y)) - minY);
    onInk({id: crypto.randomUUID(), type: 'ink', title: 'Annotazione a penna', x: minX, y: minY, width, height,
      data: {points: all.map(p => ({...p, x: p.x - minX, y: p.y - minY})), color: '#203e62', width: 2.5}});
  }
  function startDrag(e: PointerEvent<HTMLButtonElement>, object: EducationalObject) {
    if(tool !== 'select' || e.button !== 0 || window.matchMedia('(max-width: 760px)').matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {id: object.id, startX: e.clientX, startY: e.clientY, x: object.x, y: object.y};
  }
  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    if(!drag.current) return;
    setDragOffset({id: drag.current.id, x: e.clientX - drag.current.startX, y: e.clientY - drag.current.startY});
  }
  function finishDrag(e: PointerEvent<HTMLButtonElement>) {
    const value = drag.current; drag.current = null; setDragOffset(null);
    if(!value) return;
    const x = e.clientX - value.startX, y = e.clientY - value.startY;
    if(Math.abs(x) + Math.abs(y) > 4) onMove(value.id, Math.max(0, value.x + x), Math.max(0, value.y + y));
  }
  function keyboardMove(e: KeyboardEvent, object: EducationalObject) {
    const steps: Record<string, [number, number]> = {ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10]};
    const step = steps[e.key]; if(!e.altKey || !step) return;
    e.preventDefault(); onMove(object.id, Math.max(0, object.x + step[0]), Math.max(0, object.y + step[1]));
  }
  return <section className={`board-region ${tool === 'pen' ? 'drawing' : ''}`} aria-label="Lavagna della lezione">
    <div className="board-scroll"><div className="board-surface" ref={surface} onPointerDown={startInk} onPointerMove={moveInk} onPointerUp={finishInk} onPointerCancel={() => {drawing.current = false; setPoints([]);}}>
      <span className="board-context">La domanda di partenza</span>
      <svg className="connections" aria-hidden="true">
        {document.connections.map((connection, i) => {
          const a = document.objects.find(o => o.id === connection.from), b = document.objects.find(o => o.id === connection.to);
          if(!a || !b) return null;
          const x1 = a.x + a.width, y1 = a.y + a.height / 2, x2 = b.x, y2 = b.y + b.height / 3;
          return <g key={connection.id} stroke={i % 2 ? 'var(--sage)' : 'var(--primary)'} fill="none"><path d={`M${x1},${y1} C${x1+45},${y1} ${x2-40},${y2} ${x2},${y2}`} strokeWidth="1.5" strokeDasharray={i % 2 ? undefined : '5 5'}/><circle cx={x1} cy={y1} r="4" fill="currentColor"/><circle cx={x2} cy={y2} r="4" fill="currentColor"/></g>;
        })}
      </svg>
      {document.objects.length === 0 && <div className="canvas-empty"><h2>Ogni lezione comincia da una domanda.</h2><p>Aggiungi una nota, una formula o una fonte. Ritroverai gli stessi oggetti anche nel taccuino.</p><button className="primary-button" onClick={() => onAdd('note')}>Scrivi la prima nota</button></div>}
      {[...document.objects].sort((a,b) => a.y-b.y || a.x-b.x).map(object => <button key={object.id} data-testid={`object-${object.id}`} className={`board-object type-${object.type} ${object.id === selectedId ? 'selected' : ''}`} aria-label={`Apri ${object.title}`} aria-pressed={object.id === selectedId}
        style={{left: object.x, top: object.y, width: object.width, minHeight: object.height, transform: dragOffset?.id === object.id ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined}}
        onClick={() => onSelect(object.id)} onPointerDown={e => startDrag(e, object)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => {drag.current = null; setDragOffset(null);}} onKeyDown={e => keyboardMove(e, object)}>
        {object.type !== 'ink' && <h2>{object.title}</h2>}<ObjectContent object={object}/>
      </button>)}
      {points.length > 0 && <svg className="live-ink" aria-hidden><polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#203e62" strokeWidth="2.5" strokeLinecap="round"/></svg>}
    </div></div>
    <div className="board-toolbar" role="toolbar" aria-label="Strumenti lavagna">
      <button aria-label="Seleziona oggetti" title="Seleziona · Alt + frecce per spostare" aria-pressed={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={21}/></button>
      {!compact && <button aria-label="Penna" title="Penna · lavagna ampia" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}><SquarePen size={21}/></button>}
      <span className="toolbar-divider"/>
      <button aria-label="Aggiungi nota" title="Aggiungi nota" onClick={() => {setTool('select'); onAdd('note');}}><Type size={22}/></button>
      <button aria-label="Aggiungi formula" title="Aggiungi formula" onClick={() => {setTool('select'); onAdd('formula');}}><SquareFunction size={22}/></button>
      <button aria-label="Aggiungi fonte" title="Aggiungi fonte" onClick={() => {setTool('select'); onAdd('source');}}><Link2 size={21}/></button>
      <span className="toolbar-divider"/>
      <button aria-label="Annulla ultima modifica" title="Annulla ultima modifica" disabled={!canUndo} onClick={onUndo}><Undo2 size={21}/></button>
    </div>
  </section>;
}
