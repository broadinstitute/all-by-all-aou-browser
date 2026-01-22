import { createRoot } from 'react-dom/client';
import Main from './Main';

const mount = document.getElementById('root');

if (mount) {
  const root = createRoot(mount);
  root.render(<Main />);
}

