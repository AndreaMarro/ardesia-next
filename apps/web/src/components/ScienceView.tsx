import {useId} from 'react';
import type {PluginView} from '@ardesia/plugin-sdk';

export const formatScientific = (value: number): string => new Intl.NumberFormat('it-IT', {maximumSignificantDigits: 5}).format(value);

/** Render a bounded scientific DTO. No model imports or executable plugin UI. */
export function ScienceView({view, compact = false}: {view: PluginView; compact?: boolean}) {
  const plotId = useId();
  const all = view.plot.series.flatMap(series => series.points);
  const minX = Math.min(...all.map(point => point.x)), maxX = Math.max(...all.map(point => point.x));
  const rawMin = Math.min(0, ...all.map(point => point.y)), rawMax = Math.max(0, ...all.map(point => point.y));
  const padding = Math.max((rawMax - rawMin) * 0.12, 0.001);
  const minY = rawMin - padding, maxY = rawMax + padding;
  const x = (n: number) => 54 + (n - minX) / (maxX - minX || 1) * 330;
  const y = (n: number) => 170 - (n - minY) / (maxY - minY) * 146;
  const spring = view.diagram;
  const displacement = spring ? Math.max(-1, Math.min(1, spring.displacement / (spring.amplitude || 1))) : 0;
  const massX = 210 + displacement * 70;
  const coil = Array.from({length: 19}, (_, index) => `${54 + (massX - 72) * index / 18},${index === 0 || index === 18 ? 40 : index % 2 ? 25 : 55}`).join(' ');
  return <div className={`science-view ${compact ? 'compact' : ''}`}>
    {spring && <svg className="spring-diagram" viewBox="0 0 420 94" role="img" aria-label={`Massa sulla molla, posizione ${formatScientific(spring.displacement)} metri rispetto all’equilibrio`}>
      <path d="M40 14V66M32 18l8 8M32 32l8 8M32 46l8 8M32 60l8 6" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M40 40H54" stroke="currentColor" strokeWidth="2"/><polyline points={coil} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d={`M${massX - 18} 40H${massX}`} stroke="var(--primary)" strokeWidth="2.5"/>
      <line x1="210" y1="12" x2="210" y2="78" stroke="var(--muted)" strokeDasharray="3 4"/>
      <rect x={massX} y="19" width="36" height="42" rx="7" fill="var(--primary)"/><text x={massX + 18} y="45" textAnchor="middle" fill="white" fontSize="15">m</text>
      <path d="M48 72H360l-6 -4m6 4l-6 4" stroke="currentColor" fill="none"/><text x="210" y="89" textAnchor="middle" fontSize="10">equilibrio</text><text x="369" y="76" fontSize="12">x</text>
    </svg>}
    <figure className="science-plot">
      <svg viewBox="0 0 420 205" role="img" aria-labelledby={plotId}>
        <title id={plotId}>{view.plot.yLabel} ({view.plot.yUnit}) in funzione di {view.plot.xLabel} ({view.plot.xUnit})</title>
        {[0,1,2,3,4].map(index => {const tick = minX + (maxX-minX)*index/4; return <g key={`x${index}`}><line x1={x(tick)} x2={x(tick)} y1="24" y2="170" stroke="var(--line)"/><text x={x(tick)} y="187" textAnchor="middle" fontSize="10">{formatScientific(tick)}</text></g>;})}
        {[rawMin, 0, rawMax].filter((value,index,array) => array.indexOf(value) === index).map(tick => <g key={`y${tick}`}><line x1="54" x2="384" y1={y(tick)} y2={y(tick)} stroke="var(--line)"/><text x="47" y={y(tick)+4} textAnchor="end" fontSize="10">{formatScientific(tick)}</text></g>)}
        <path d="M54 24V170H384" fill="none" stroke="var(--muted)"/>
        {view.plot.series.map((series,index) => <polyline key={series.id} points={series.points.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} fill="none" stroke={index ? 'var(--sage)' : 'var(--primary)'} strokeWidth="2" strokeLinecap="round"/>)}
        <text x="54" y="14" fontSize="11">{view.plot.yLabel} ({view.plot.yUnit})</text><text x="384" y="203" textAnchor="end" fontSize="11">{view.plot.xLabel} ({view.plot.xUnit})</text>
      </svg>
      {!compact && <figcaption>{view.plot.series.map(series => series.label).join(' · ')}</figcaption>}
    </figure>
    <dl className="science-metrics">{(compact ? view.metrics.slice(0,2) : view.metrics).map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{formatScientific(metric.value)} <span>{metric.unit}</span></dd></div>)}</dl>
    {!compact && <div className="science-explanation">{view.explanation.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</div>}
  </div>;
}
