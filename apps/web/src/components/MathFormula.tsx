import {useMemo} from 'react';
import katex from 'katex';
export function MathFormula({latex}: {latex: string}) {
  const rendered = useMemo(() => {
    try {return katex.renderToString(latex, {throwOnError: true, trust: false, strict: 'warn', output: 'htmlAndMathml', displayMode: true, maxExpand: 1000});}
    catch {return null;}
  }, [latex]);
  return rendered ? <div className="math" aria-label={`Formula: ${latex}`} dangerouslySetInnerHTML={{__html: rendered}} /> : <pre className="math-error">Formula da correggere: {latex}</pre>;
}
