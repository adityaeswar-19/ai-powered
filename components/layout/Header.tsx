import React, { useState, useEffect } from 'react';
import { SparklesIcon } from '../icons/SparklesIcon';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import RamAgent from '../features/RamAgent';
import { FeatureId } from '../../constants';
import { ArrowsPointingOutIcon } from '../icons/ArrowsPointingOutIcon';
import { ArrowsPointingInIcon } from '../icons/ArrowsPointingInIcon';

interface HeaderProps {
    onNavigate: (featureId: FeatureId) => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <header className="relative text-center">
       <div className="flex items-center justify-center gap-3">
        <SparklesIcon className="text-purple-400 h-8 w-8" />
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
          AI Learning Platform
        </h1>
       </div>
      <p className="mt-2 text-lg text-gray-400">Your personal AI-powered learning partner.</p>
      
      {user && (
        <>
            <div className="absolute top-0 right-0 flex items-center gap-2 sm:gap-4 bg-gray-900/50 p-2 rounded-xl backdrop-blur-md border border-white/5 z-20 shadow-xl">
                <button
                    onClick={toggleFullscreen}
                    className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-lg transition-all"
                    title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
                >
                    {isFullscreen ? (
                        <ArrowsPointingInIcon className="h-5 w-5" />
                    ) : (
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                    )}
                </button>
                <div className="h-6 w-[1px] bg-gray-700 mx-1 hidden sm:block"></div>
                <span className="text-gray-300 hidden sm:inline font-medium text-sm">Hi, {user.name}!</span>
                <Button onClick={logout} className="bg-gray-700 hover:bg-gray-600 text-[10px] uppercase tracking-wider py-1.5 px-3">
                    Logout
                </Button>
            </div>
            {/* Ram Agent is now fixed-position, so it can live anywhere in the DOM */}
            <RamAgent onNavigate={onNavigate} />
        </>
      )}
    </header>
  );
};

export default Header;
