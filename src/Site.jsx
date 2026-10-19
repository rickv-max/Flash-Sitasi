import App from './App';
import InfoPage from './pages/InfoPage';
import { PUBLIC_PAGES } from '../shared/site-content';

export default function Site({ path = typeof window !== 'undefined' ? window.location.pathname : '/' }) {
  const normalized = path.replace(/\/+$/, '') || '/';
  const page = PUBLIC_PAGES[normalized];
  return page ? <InfoPage page={page} /> : <App />;
}
