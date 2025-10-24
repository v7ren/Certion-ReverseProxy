import { useState, useEffect } from 'react';
import { Menu, X} from 'lucide-react';

const V7REnvyLanding = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      } as const;
      setCurrentDate(now.toLocaleDateString('en-US', options).toUpperCase());
    };
    
    updateDate();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Global Styles */}
      <style>{`
        @import url('/anurati.css');
        
        .anurati {
          font-family: 'Anurati', sans-serif;
        }
        
        .hero-title {
          animation: fadeInUp 1.2s ease-out;
        }
        
        .hero-philosophy {
          animation: fadeInUp 1.4s ease-out;
        }
        
        .quote-section {
          animation: fadeInUp 1.6s ease-out;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>

      <div className="min-h-screen bg-white text-black overflow-hidden relative">
        {/* Fixed Elements */}
        <div className="fixed top-10 right-10 text-xs font-light text-gray-500 tracking-wide uppercase z-50">
          {currentDate}
        </div>
        
        <div className="anurati fixed right-10 top-1/2 transform -translate-y-1/2 writing-mode-vertical text-xs font-normal text-gray-400 tracking-widest uppercase z-50">
          TRANSFORM
        </div>
        
        <div className="fixed bottom-10 right-10 text-xs font-light text-gray-300 z-50">
          / / /
        </div>

        {/* Geometric Elements */}
        <div className="absolute w-36 h-24 top-[15%] right-[12%] border border-gray-100 transform rotate-45 pointer-events-none z-10"></div>
        <div className="absolute w-20 h-20 bottom-[35%] left-[25%] border border-gray-100 rounded-full pointer-events-none z-10"></div>
        <div className="absolute w-60 h-px top-[35%] right-[8%] bg-gray-100 pointer-events-none z-10"></div>

        {/* Mobile Menu Button */}
        <button 
          className="fixed top-6 left-6 z-50 md:hidden bg-white p-2 rounded-lg shadow-lg"
          onClick={toggleMobileMenu}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={toggleMobileMenu}></div>
            <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl">
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-lg">CERTION</span>
                </div>
                <button onClick={toggleMobileMenu}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex min-h-screen">
          <div className="flex-1 ml-20 pt-16 flex items-start justify-start min-h-screen">
            <div className="max-w-3xl p-10 md:pl-32 md:pr-20 w-full">
              
              {/* Hero Section */}
              <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-5">
                Welcome Back
              </div>
              
              <h1 className="hero-title text-7xl md:text-8xl font-extralight text-black leading-none mb-16 tracking-tight">
                Begin
                <span className="font-semibold block mt-5">Anywhere</span>
              </h1>
              
              <p className="hero-philosophy text-lg font-light text-gray-600 leading-tight mb-3 max-w-md">
                Certified Code. Verified Creators. Zero Doubt.
              </p>
              
              {/* Quote Section */}
              <div className="quote-section border-t border-gray-100 pt-10 mb-5 max-w-lg">
                <div className="text-xs font-normal text-gray-300 tracking-wider uppercase mb-6">
                  Today's Mindset
                </div>
                
                <blockquote className="text-3xl font-light text-black leading-tight italic mb-5">
                  "In a world of anonymous code, be the verified creator."
                </blockquote>
                
                <div className="text-xs font-normal text-gray-400 uppercase tracking-wide">
                  — Ren
                </div>
              </div>
              
              {/* Action Area */}
              <div className="flex items-center gap-12 flex-col md:flex-row md:items-center">
                <button 
                  className="anurati bg-black text-white border-none py-5 px-9 text-xs font-normal tracking-wider uppercase cursor-pointer transition-all duration-300 hover:bg-gray-700 hover:translate-x-1"
                  onClick={() => window.location.href = '/dashboard'}
                >
                  Start today
                </button>
                
                <div className="text-sm font-light text-gray-400 leading-relaxed text-center md:text-left">
                  Ready when you are.<br />
                  Your journey begins now.
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default V7REnvyLanding;