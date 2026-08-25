import React, { useState } from 'react';
import { Navbar } from '../components/Navbar.js';
import { HeroSection } from '../components/HeroSection.js';
import { WorkflowSection } from '../components/WorkflowSection.js';
import { SafetyArchitectureSection } from '../components/SafetyArchitectureSection.js';
import { TrueForgeIntegrationSection } from '../components/TrueForgeIntegrationSection.js';
import { InteractiveProofConsole } from '../components/InteractiveProofConsole.js';
import { FinalCtaSection } from '../components/FinalCtaSection.js';
import { Footer } from '../components/Footer.js';
import { MigrationConsoleModal } from '../components/MigrationConsoleModal.js';
import { useRouter } from '../router/Router.js';

export const LandingPage: React.FC = () => {
  const [telemetryModalOpen, setTelemetryModalOpen] = useState(false);
  const { navigate } = useRouter();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <Navbar onOpenConsole={() => navigate('/console')} />

      {/* Main Content Sections */}
      <main style={{ flex: 1 }}>
        <HeroSection onOpenConsole={() => navigate('/console')} />
        <WorkflowSection />
        <SafetyArchitectureSection />
        <TrueForgeIntegrationSection />
        <InteractiveProofConsole />
        <FinalCtaSection onOpenConsole={() => navigate('/console')} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Engine Telemetry Modal */}
      <MigrationConsoleModal
        isOpen={telemetryModalOpen}
        onClose={() => setTelemetryModalOpen(false)}
      />
    </div>
  );
};
