import React, { useState, useMemo } from 'react';
import Header from './components/layout/Header';
import Tabs from './components/layout/Tabs';
import PersonalTutor from './components/features/PersonalTutor';
import ExamPrepAssistant from './components/features/ExamPrepAssistant';
import CodingMentor from './components/features/CodingMentor';
import { FEATURES, FeatureId } from './constants';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './components/auth/LandingPage';
import Loader from './components/ui/Loader';


const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureId>(FeatureId.TUTOR);
  const { user, isLoading } = useAuth();

  const ActiveComponent = useMemo(() => {
    switch (activeFeature) {
      case FeatureId.TUTOR:
        return PersonalTutor;
      case FeatureId.EXAM_PREP:
        return ExamPrepAssistant;
      case FeatureId.CODING_MENTOR:
        return CodingMentor;
      default:
        return PersonalTutor;
    }
  }, [activeFeature]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <Header onNavigate={setActiveFeature} />
        <main className="mt-8">
          <Tabs
            features={FEATURES}
            activeFeature={activeFeature}
            setActiveFeature={setActiveFeature}
          />
          <div className="mt-6 bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-2xl min-h-[60vh]">
            <ActiveComponent />
          </div>
        </main>
        <footer className="text-center text-gray-500 text-sm mt-8 pb-4">
          <p>Powered by Gemini. Built for modern learning.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;