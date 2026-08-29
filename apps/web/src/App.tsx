import { RouterProvider, useRouter, normalizePath } from './router/Router.js';
import { LandingPage } from './pages/LandingPage.js';
import { MigrationConsolePage } from './pages/MigrationConsolePage.js';

function AppContent() {
  const { currentPath } = useRouter();
  const isConsole = normalizePath(currentPath) === '/console';

  return (
    <>
      <div style={{ display: isConsole ? 'none' : 'block' }}>
        <LandingPage />
      </div>
      <div style={{ display: isConsole ? 'block' : 'none' }}>
        <MigrationConsolePage />
      </div>
    </>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}

export default App;
