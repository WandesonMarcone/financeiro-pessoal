import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {configuredGateway} from './access';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App gateway={configuredGateway()}/></React.StrictMode>);

