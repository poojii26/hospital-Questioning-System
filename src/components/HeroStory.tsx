import React from 'react';
import { ArrowDown } from 'lucide-react';

interface HeroStoryProps {
  onExploreStudio: () => void;
  onInspectQuestion: (question: string) => void;
}

export const HeroStory: React.FC<HeroStoryProps> = ({ onExploreStudio, onInspectQuestion }) => {
  return (
    <section id="top" className="bg-white border-b border-slate-200">
      <div className="max-w-[1120px] mx-auto px-6 py-16 lg:py-20">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.12]">
            Simple, Honest Hospital Answers Without Guesswork.
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExploreStudio}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors cursor-pointer"
            >
              <span>Try Asking a Question</span>
              <ArrowDown className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onInspectQuestion("What are the timings of Dr. Meera's department?")}
              className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Try Chained Example
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
