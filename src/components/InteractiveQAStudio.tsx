import React, { useMemo, useState } from 'react';
import {
  Search,
  GitBranch,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import {
  KnowledgeBase,
  QueryExecutionResult,
  runHospitalQuery,
} from '../engine/qaEngine';
import { DatasetMode } from '../engine/hospitalData';

export interface QueryHistoryEntry {
  id: string;
  timestamp: string;
  question: string;
  datasetMode: DatasetMode;
  v2Answer: string;
  v1Answer: string;
  v2Rules: string;
  v1Differs: boolean;
  chained: boolean;
}

interface InteractiveQAStudioProps {
  questionInput: string;
  onQuestionInputChange: (val: string) => void;
  datasetMode: DatasetMode;
  onDatasetModeChange: (mode: DatasetMode) => void;
  compareV1V2: boolean;
  onCompareV1V2Change: (compare: boolean) => void;
  knowledgeBase: KnowledgeBase;
  history: QueryHistoryEntry[];
  onRunAndRecord: (question: string) => void;
  onClearHistory: () => void;
}

const QUICK_QUESTIONS: { label: string; question: string; expanded?: boolean }[] = [
  { label: 'Chained Timing (Q15)', question: "What are the timings of Dr. Meera's department?" },
  { label: 'Multi-Part (Q18)', question: 'What are the timing and facility of Neurology?' },
  { label: 'Heart Doctor (Q11)', question: 'Which doctor treats heart problems?' },
  { label: 'Substring Trap (Q26)', question: 'Does Neurology offer whole body scanning?' },
  { label: 'MRI Reverse Lookup (Q33)', question: 'Which department has MRI Scanner?', expanded: true },
  { label: 'Dermatology Multi (Q50)', question: 'Who works in Dermatology and what are its timings?', expanded: true },
];

export const InteractiveQAStudio: React.FC<InteractiveQAStudioProps> = ({
  questionInput,
  onQuestionInputChange,
  datasetMode,
  onDatasetModeChange,
  compareV1V2,
  onCompareV1V2Change,
  knowledgeBase,
  history,
  onRunAndRecord,
  onClearHistory,
}) => {
  const [showTrace, setShowTrace] = useState(false);

  const v2Result: QueryExecutionResult = useMemo(
    () => runHospitalQuery(questionInput, knowledgeBase, 'v2'),
    [questionInput, knowledgeBase]
  );

  const v1Result: QueryExecutionResult = useMemo(
    () => runHospitalQuery(questionInput, knowledgeBase, 'v1'),
    [questionInput, knowledgeBase]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    onRunAndRecord(questionInput);
  };

  return (
    <section id="studio" className="py-16 border-b border-slate-200 bg-slate-50">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-sky-800 mb-1">Interactive Assistant</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">
              Ask a Question
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-white rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onDatasetModeChange('original')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  datasetMode === 'original' ? 'bg-sky-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PDF Original (10 Facts)
              </button>
              <button
                type="button"
                onClick={() => onDatasetModeChange('expanded')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  datasetMode === 'expanded' ? 'bg-sky-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expanded (28 Facts)
              </button>
            </div>
          </div>
        </div>

        {/* Question Bar */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="hospital-question-input" className="sr-only">
              Ask a hospital question
            </label>
            <input
              id="hospital-question-input"
              type="text"
              value={questionInput}
              onChange={(e) => onQuestionInputChange(e.target.value)}
              placeholder="Ask about doctors, departments, timings, or facilities..."
              className="w-full pl-10 pr-4 py-3 text-base bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-800"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 text-sm font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Get Answer
          </button>
        </form>

        {/* Simple Quick Question Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.expanded && datasetMode === 'original') {
                  onDatasetModeChange('expanded');
                }
                onQuestionInputChange(item.question);
                onRunAndRecord(item.question);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                questionInput.trim().toLowerCase() === item.question.toLowerCase()
                  ? 'bg-sky-800 text-white border-sky-800 font-medium'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Clean 2-Column Workspace: Answer (Left) + History (Right) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Answer Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-500">
                System Answer · {v2Result.firedRules.map((r) => (r.chained ? `${r.ruleId} + Chain` : r.ruleId)).join(', ')}
              </span>

              <button
                type="button"
                onClick={() => onCompareV1V2Change(!compareV1V2)}
                className="text-xs font-medium text-sky-800 hover:underline cursor-pointer"
              >
                {compareV1V2 ? 'Hide Old v1 Comparison' : 'Compare with Old v1'}
              </button>
            </div>

            <p className="mt-5 text-xl font-semibold text-slate-900 leading-relaxed">
              {v2Result.answer}
            </p>

            {/* Chained path if applicable */}
            {v2Result.firedRules.some((r) => r.chained && r.chainPath) && (
              <div className="mt-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs font-mono text-sky-900 flex items-center gap-2">
                <GitBranch className="w-4 h-4 shrink-0" />
                <span>
                  {v2Result.firedRules.find((r) => r.chained)?.chainPath}
                </span>
              </div>
            )}

            {/* Old v1 comparison */}
            {compareV1V2 && (
              <div className="mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Old Draft (v1) answered:</span>
                  <span
                    className={`font-mono font-medium ${
                      v1Result.answer === v2Result.answer ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {v1Result.answer === v2Result.answer ? '✓ Same' : '✕ Wrong / Incomplete'}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-800">{v1Result.answer}</p>
              </div>
            )}

            {/* Simple Expandable Trace Toggle */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowTrace(!showTrace)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                {showTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showTrace ? 'Hide Reasoning Steps' : 'See How the AI Reasoned'}</span>
              </button>

              {showTrace && (
                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <p className="font-medium text-slate-500">1. Words Read</p>
                    <p className="font-mono text-slate-800 mt-1">
                      {v2Result.tokens.join(' · ') || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-500">2. Intents &amp; Entities Found</p>
                    <p className="font-mono text-slate-800 mt-1">
                      Intents: {v2Result.matchedIntents.map((m) => m.intent).join(', ') || 'None'} · Entities:{' '}
                      {v2Result.matchedEntities.map((e) => `${e.value} (${e.type})`).join(', ') || 'None'}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-500">3. Facts Used from Knowledge Base</p>
                    {v2Result.factsUsed.length > 0 ? (
                      <ul className="mt-1 space-y-1 font-mono text-slate-800">
                        {v2Result.factsUsed.map((f) => (
                          <li key={f.id}>
                            <Check className="w-3.5 h-3.5 text-emerald-700 inline mr-1.5" />
                            {f.raw}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-mono text-slate-600 mt-1">No matching triples — fallback rule R9 used.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clean History Ledger */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-800" />
                <h3 className="text-sm font-semibold text-slate-900">Recent Questions</h3>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto">
              {history.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  Your asked questions will appear here.
                </p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.datasetMode !== datasetMode) {
                        onDatasetModeChange(item.datasetMode);
                      }
                      onQuestionInputChange(item.question);
                    }}
                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{item.v2Rules}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{item.question}</p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{item.v2Answer}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
