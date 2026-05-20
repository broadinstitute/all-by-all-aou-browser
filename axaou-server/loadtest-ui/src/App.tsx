import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { RunHistory } from './pages/RunHistory';
import { RunDetail } from './pages/RunDetail';

function App() {
  return (
    <BrowserRouter>
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 1200,
        margin: '0 auto',
        padding: 20,
        background: '#f5f5f5',
        minHeight: '100vh',
      }}>
        <nav style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
          <Link to="/" style={{ color: '#2563eb', fontWeight: 'bold' }}>Dashboard</Link>
          <Link to="/runs" style={{ color: '#2563eb' }}>History</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs" element={<RunHistory />} />
          <Route path="/runs/:runId" element={<RunDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
