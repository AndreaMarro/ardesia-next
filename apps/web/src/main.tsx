import {createRoot} from 'react-dom/client';
import {RemoteWorkspace} from './RemoteWorkspace';
import '@ardesia/ui/tokens.css';
import 'katex/dist/katex.min.css';
import './styles.css';
import './studio.css';
import './creator/creator.css';
import './handout/handout.css';
createRoot(document.getElementById('root')!).render(<RemoteWorkspace/>);
