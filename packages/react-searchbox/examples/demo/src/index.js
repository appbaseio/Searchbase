import { createRoot } from 'react-dom/client';
import React from 'react';

import App from './App';
const container = document.getElementById('root');
const root = createRoot(container); // createRoot(container!) if you use TypeScript

root.render(<App />);
