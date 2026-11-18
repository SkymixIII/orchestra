import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StageView } from './components/StageView';
import './styles.css';

// « #scene » : l'écran des instruments, à ouvrir dans une deuxième fenêtre.
const isStage = window.location.hash === '#scene';

createRoot(document.getElementById('root')!).render(<StrictMode>{isStage ? <StageView /> : <App />}</StrictMode>);
