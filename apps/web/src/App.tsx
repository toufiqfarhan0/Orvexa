import { RouterProvider, useRouter, normalizePath } from './router/Router.js';
import { LandingPage } from './pages/LandingPage.js';
import { MigrationConsolePage } from './pages/MigrationConsolePage.js';
import { ResearchPage } from './pages/ResearchPage.js';

function AppContent() {
  const { currentPath } = useRouter();
  const normalizedPath = normalizePath(currentPath);
  const isConsole = normalizedPath === '/console';
  const isResearch = normalizedPath === '/research';
  const isLanding = !isConsole && !isResearch;

  return (
    <>
      <div style={{ display: isLanding ? 'block' : 'none' }}>
        <LandingPage />
      </div>
      <div style={{ display: isConsole ? 'block' : 'none' }}>
        <MigrationConsolePage />
      </div>
      <div style={{ display: isResearch ? 'block' : 'none' }}>
        <ResearchPage />
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
