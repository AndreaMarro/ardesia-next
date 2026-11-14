import {AnnotatedMaterial,MaterialView} from '../materials/MaterialView';
import {ExtensionView, ExtensionExperiment} from '../creator/ExtensionView';
import {memo} from 'react';
import {inkPath} from './board-geometry';
import {Link2} from './Icons';
import type {EducationalObject,InkObject} from '@ardesia/contracts';
import {MathFormula} from './MathFormula';
import {LabContent} from './LabContent';

export const ObjectContent = memo(function ObjectContent({object, links = false,experiments=links,annotations=[]}: {object: EducationalObject; links?: boolean;experiments?:boolean;annotations?:InkObject[]}) {
  switch(object.type) {
    case 'material': return annotations.length?<AnnotatedMaterial object={object} annotations={annotations}/>:<MaterialView data={object.data}/>;
    case 'extension': return experiments ? <ExtensionExperiment key={object.id+':'+object.revision} data={object.data}/> : <ExtensionView data={object.data}/>;
    case 'lab': return <LabContent object={object} compact={!links}/>;
    case 'note': return <p className="note-text">{object.data.text || 'Scrivi una nota dal pannello dell’oggetto.'}</p>;
    case 'formula': return <><MathFormula latex={object.data.latex}/><p className="formula-description">{object.data.description}</p></>;
    case 'source': return <div className="source-content"><Link2 size={19} aria-hidden/><div>{links ? <a href={object.data.url} target="_blank" rel="noreferrer">{object.data.publisher}</a> : <span>{object.data.publisher}</span>}<small>{object.data.locator}</small></div></div>;
    case 'ink': {
      const path = inkPath(object.data.points, object.data.width);
      return <svg className="ink-content" viewBox={`0 0 ${object.width} ${object.height}`} aria-label="Annotazione a penna" role="img"><path d={path} fill={object.data.color}/></svg>;
    }
  }
});
