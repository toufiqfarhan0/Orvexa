import { RouterProvider, useRouter, normalizePath } from './router/Router.js';
import { LandingPage } from './pages/LandingPage.js';
import { MigrationConsolePage } from './pages/MigrationConsolePage.js';

function AppContent() {
  const { currentPath } = useRouter();

  if (normalizePath(currentPath) === '/console') {
    return <MigrationConsolePage />;
  }

  return <LandingPage />;
}

export function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}

export default App;
