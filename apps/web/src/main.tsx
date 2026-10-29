import {createRoot} from 'react-dom/client';
import {App} from './App';
import {openWorkspace} from './workspace';
import '@ardesia/ui/tokens.css';
import 'katex/dist/katex.min.css';
import './styles.css';

const root=createRoot(document.getElementById('root')!);
root.render(<main className="boot-screen"><h1>Ardesia</h1><p>Apro il tuo spazio…</p></main>);
void openWorkspace().then(core => root.render(<App core={core}/>)).catch(() => root.render(
  <main className="boot-screen"><h1>Il tuo spazio è al sicuro.</h1><p>Non è stato possibile aprire i dati di questo browser. Non li abbiamo sostituiti né cancellati.</p><p>Chiudi eventuali altre schede della preview e riprova. Per il salvataggio serve un browser aggiornato con i dati locali abilitati.</p><button className="primary-button" onClick={() => location.reload()}>Riprova</button></main>
));
