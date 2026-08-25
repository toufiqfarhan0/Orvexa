import { useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { HeroSection } from './components/HeroSection.js';
import { WorkflowSection } from './components/WorkflowSection.js';
import { SafetyArchitectureSection } from './components/SafetyArchitectureSection.js';
import { TrueForgeIntegrationSection } from './components/TrueForgeIntegrationSection.js';
import { InteractiveProofConsole } from './components/InteractiveProofConsole.js';
import { FinalCtaSection } from './components/FinalCtaSection.js';
import { Footer } from './components/Footer.js';
import { MigrationConsoleModal } from './components/MigrationConsoleModal.js';

export function App() {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <Navbar onOpenConsole={() => setConsoleOpen(true)} />

      {/* Main Content Sections */}
      <main style={{ flex: 1 }}>
        <HeroSection onOpenConsole={() => setConsoleOpen(true)} />
        <WorkflowSection />
        <SafetyArchitectureSection />
        <TrueForgeIntegrationSection />
        <InteractiveProofConsole />
        <FinalCtaSection onOpenConsole={() => setConsoleOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Engine Telemetry Modal */}
      <MigrationConsoleModal isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

export default App;
