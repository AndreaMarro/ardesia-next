import {useEffect, useRef, type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Dialog({title, children, onClose}: {title: string; children: ReactNode; onClose: () => void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(() => {const element=ref.current; element?.showModal(); return () => element?.close();}, []);
  return <dialog className="dialog" ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby="dialog-title"><header><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Chiudi finestra" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
