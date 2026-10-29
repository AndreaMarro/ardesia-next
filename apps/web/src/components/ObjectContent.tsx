import {Link2} from 'lucide-react';
import type {EducationalObject} from '@ardesia/contracts';
import {MathFormula} from './MathFormula';
import {LabContent} from './LabContent';

export function ObjectContent({object, links = false}: {object: EducationalObject; links?: boolean}) {
  switch(object.type) {
    case 'lab': return <LabContent object={object} compact={!links}/>;
    case 'note': return <p className="note-text">{object.data.text || 'Scrivi una nota dal pannello dell’oggetto.'}</p>;
    case 'formula': return <><MathFormula latex={object.data.latex}/><p className="formula-description">{object.data.description}</p></>;
    case 'source': return <div className="source-content"><Link2 size={19} aria-hidden/><div>{links ? <a href={object.data.url} target="_blank" rel="noreferrer">{object.data.publisher}</a> : <span>{object.data.publisher}</span>}<small>{object.data.locator}</small></div></div>;
    case 'ink': {
      const points = object.data.points.map(p => `${p.x},${p.y}`).join(' ');
      return <svg className="ink-content" viewBox={`0 0 ${object.width} ${object.height}`} aria-label="Annotazione a penna" role="img"><polyline points={points} fill="none" stroke={object.data.color} strokeWidth={object.data.width} strokeLinecap="round" strokeLinejoin="round"/></svg>;
    }
  }
}

