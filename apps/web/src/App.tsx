import { useEffect, useState } from 'react';

export function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? setApiStatus('ok') : setApiStatus('down')))
      .catch(() => setApiStatus('down'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Distributed RAG Web Scraper</h1>
      <p>
        API status: <strong>{apiStatus}</strong>
      </p>
      <p>Dashboard, search, and Q&amp;A pages arrive in Phase 7.</p>
    </main>
  );
}
