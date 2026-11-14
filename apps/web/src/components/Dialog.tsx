import {useEffect, useRef, useId, type ReactNode} from 'react';
import {X} from './Icons';
export function Dialog({title, children, onClose, className = ''}: {title: string; children: ReactNode; onClose: () => void; className?: string}) {
  const titleId=useId();
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(() => {const element=ref.current; element?.showModal(); return () => element?.close();}, []);
  return <dialog className={'dialog ' + className} ref={ref} onCancel={event => {event.preventDefault(); onClose();}} onClose={onClose} aria-labelledby={titleId}><header><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Chiudi finestra" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
