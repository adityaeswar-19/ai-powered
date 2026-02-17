import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ArrowsPointingOutIcon } from '../icons/ArrowsPointingOutIcon';
import { ArrowsPointingInIcon } from '../icons/ArrowsPointingInIcon';

const LandingPage: React.FC = () => {
  const [name, setName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { login } = useAuth();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      login(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Full Screen Toggle Button */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleFullscreen}
          className="p-3 bg-gray-800/50 hover:bg-gray-700/80 text-gray-400 hover:text-purple-400 rounded-xl transition-all border border-white/5 backdrop-blur-md shadow-2xl"
          title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullscreen ? (
            <ArrowsPointingInIcon className="h-6 w-6" />
          ) : (
            <ArrowsPointingOutIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="text-center max-w-lg w-full z-10">
        <div className="flex items-center justify-center gap-3 mb-2">
            <SparklesIcon className="text-purple-400 h-10 w-10 animate-pulse" />
            <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-indigo-500 tracking-tight">
              AI Learning
            </h1>
        </div>
        <h2 className="text-3xl font-bold text-gray-300 mb-4 italic">Platform</h2>
        <p className="text-xl text-gray-400 max-w-sm mx-auto leading-relaxed">
          The most powerful personal AI tutor designed for modern students.
        </p>

        <form onSubmit={handleSubmit} className="mt-12 flex flex-col items-center gap-6 w-full px-4">
            <div className="relative w-full max-w-sm group">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name to begin"
                className="w-full bg-gray-800/80 border border-gray-700 rounded-2xl px-6 py-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all backdrop-blur-sm group-hover:border-purple-500/50 placeholder-gray-600"
                aria-label="Your name"
              />
            </div>
            <Button
                type="submit"
                disabled={!name.trim()}
                className="px-12 py-4 text-xl rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transition-all active:scale-95"
            >
              Start Learning
            </Button>
        </form>
      </div>
      
      <footer className="absolute bottom-8 text-center text-gray-500 text-xs tracking-widest uppercase">
          <p className="flex items-center gap-2">
            <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
            Powered by Gemini
            <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
            Built for modern learning
            <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
          </p>
      </footer>
    </div>
  );
};

export default LandingPage;