import { useEffect, useState } from 'react';
import { Link, matchRoute, useRoute } from './router';
import { Dashboard } from './pages/Dashboard';
import { Search } from './pages/Search';
import { Ask } from './pages/Ask';
import { Pages } from './pages/Pages';
import { PageDetail } from './pages/PageDetail';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/search', label: 'Search' },
  { to: '/ask', label: 'Ask' },
  { to: '/pages', label: 'Pages' },
];

export function App() {
  const path = useRoute();
  return (
    <div className="min-h-screen">
      <NavBar path={path} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes path={path} />
      </main>
    </div>
  );
}

/** Central route table. `/pages/:id` is matched with a param; everything else is an exact path. */
function Routes({ path }: { path: string }) {
  const pageDetail = matchRoute('/pages/:id', path);
  if (pageDetail?.id && /^\d+$/.test(pageDetail.id)) return <PageDetail id={Number(pageDetail.id)} />;

  switch (path) {
    case '/':
      return <Dashboard />;
    case '/search':
      return <Search />;
    case '/ask':
      return <Ask />;
    case '/pages':
      return <Pages />;
    default:
      return <NotFound />;
  }
}

function NavBar({ path }: { path: string }) {
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span className="font-semibold text-slate-900">RAG Scraper</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.to) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <ApiStatus />
        </nav>
      </div>
    </header>
  );
}

/** A small liveness dot in the nav — reassures during the demo that the API is reachable. */
function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  useEffect(() => {
    let active = true;
    const ping = () =>
      fetch('/api/health')
        .then((r) => active && setStatus(r.ok ? 'ok' : 'down'))
        .catch(() => active && setStatus('down'));
    void ping();
    const timer = window.setInterval(ping, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  const color = status === 'ok' ? 'bg-emerald-500' : status === 'down' ? 'bg-red-500' : 'bg-amber-400';
  return (
    <span className="ml-2 flex items-center gap-1.5 text-xs text-slate-400" title={`API: ${status}`}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      API
    </span>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg text-slate-500">Page not found.</p>
      <Link to="/" className="mt-2 inline-block text-brand-600 hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}
