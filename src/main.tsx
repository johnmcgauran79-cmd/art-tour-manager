import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installChunkReloadHandler } from './lib/chunkReload'

installChunkReloadHandler();

createRoot(document.getElementById("root")!).render(<App />);
