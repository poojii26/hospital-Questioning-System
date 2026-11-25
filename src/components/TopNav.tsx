import React from 'react';

interface TopNavProps {
  onAskClick: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onAskClick }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          MedLogic QA
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Primary">
          <a href="#studio" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Ask AI
          </a>
          <a href="#knowledge-base" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Hospital Info
          </a>
          <a href="#benchmark" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            All 54 Questions
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onAskClick}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ask a Question
          </button>
        </div>
      </div>
    </header>
  );
};
