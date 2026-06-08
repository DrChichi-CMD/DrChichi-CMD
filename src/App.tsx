/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Controller from './components/Controller.tsx';
import Projector from './components/Projector.tsx';

export default function App() {
  const [mode, setMode] = useState<'controller' | 'projector'>('controller');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'projector') {
      setMode('projector');
    }
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-slate-900">
      {mode === 'projector' ? (
        <Projector />
      ) : (
        <Controller />
      )}
    </div>
  );
}
