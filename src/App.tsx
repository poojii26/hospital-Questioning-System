import React, { useEffect, useMemo, useState } from 'react';
import { TopNav } from './components/TopNav';
import { HeroStory } from './components/HeroStory';
import { InteractiveQAStudio, QueryHistoryEntry } from './components/InteractiveQAStudio';
import { KnowledgeBaseStudio } from './components/KnowledgeBaseStudio';
import { BenchmarkSuite } from './components/BenchmarkSuite';
import {
  DatasetMode,
  EXPANDED_RAW_DOCUMENT,
  ORIGINAL_RAW_DOCUMENT,
} from './engine/hospitalData';
import { parseHospitalDocument, runHospitalQuery } from './engine/qaEngine';

const HISTORY_STORAGE_KEY = 'medlogic_hospital_qa_history_v1';

const SEEDED_HISTORY: QueryHistoryEntry[] = [
  {
    id: 'seed-1',
    timestamp: 'Q15 · Chained',
    question: "What are the timings of Dr. Meera's department?",
    datasetMode: 'original',
    v2Answer: 'Cardiology timing is 9 AM to 1 PM.',
    v1Answer: 'Sorry, information is not available.',
    v2Rules: 'R4 + Chain',
    v1Differs: true,
    chained: true,
  },
  {
    id: 'seed-2',
    timestamp: 'Q26 · Trap',
    question: 'Does Neurology offer whole body scanning?',
    datasetMode: 'original',
    v2Answer: 'Sorry, information is not available.',
    v1Answer: 'Dr. Arun works in Neurology department.',
    v2Rules: 'R9',
    v1Differs: true,
    chained: false,
  },
  {
    id: 'seed-3',
    timestamp: 'Q18 · Multi',
    question: 'What are the timing and facility of Neurology?',
    datasetMode: 'original',
    v2Answer: 'Neurology timing is 10 AM to 4 PM. Neurology provides Brain Scanning facility.',
    v1Answer: 'Neurology timing is 10 AM to 4 PM.',
    v2Rules: 'R4, R5',
    v1Differs: true,
    chained: false,
  },
];

export default function App() {
  const [datasetMode, setDatasetMode] = useState<DatasetMode>('expanded');
  const [rawDocument, setRawDocument] = useState<string>(EXPANDED_RAW_DOCUMENT);
  const [questionInput, setQuestionInput] = useState<string>(
    "What are the timings of Dr. Meera's department?"
  );
  const [compareV1V2, setCompareV1V2] = useState<boolean>(false);

  const [history, setHistory] = useState<QueryHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QueryHistoryEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return SEEDED_HISTORY;
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  const knowledgeBase = useMemo(() => parseHospitalDocument(rawDocument), [rawDocument]);

  const handleDatasetModeChange = (mode: DatasetMode) => {
    setDatasetMode(mode);
    setRawDocument(mode === 'original' ? ORIGINAL_RAW_DOCUMENT : EXPANDED_RAW_DOCUMENT);
  };

  const scrollToStudio = () => {
    document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const recordQueryRun = (q: string, targetMode: DatasetMode = datasetMode) => {
    const kb =
      targetMode === datasetMode
        ? knowledgeBase
        : parseHospitalDocument(targetMode === 'original' ? ORIGINAL_RAW_DOCUMENT : EXPANDED_RAW_DOCUMENT);

    const v2 = runHospitalQuery(q, kb, 'v2');
    const v1 = runHospitalQuery(q, kb, 'v1');
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const entry: QueryHistoryEntry = {
      id: `q-${Date.now()}`,
      timestamp: nowLabel,
      question: q.trim(),
      datasetMode: targetMode,
      v2Answer: v2.answer,
      v1Answer: v1.answer,
      v2Rules: v2.firedRules.map((r) => (r.chained ? `${r.ruleId} + Chain` : r.ruleId)).join(', '),
      v1Differs: v1.answer !== v2.answer,
      chained: v2.firedRules.some((r) => r.chained),
    };

    setHistory((prev) =>
      [
        entry,
        ...prev.filter(
          (item) =>
            item.question.toLowerCase() !== q.trim().toLowerCase() ||
            item.datasetMode !== targetMode
        ),
      ].slice(0, 25)
    );
  };

  const handleJumpToStudio = (question: string, mode?: DatasetMode, enableCompare = false) => {
    if (mode && mode !== datasetMode) {
      handleDatasetModeChange(mode);
    }
    setQuestionInput(question);
    setCompareV1V2(enableCompare);
    recordQueryRun(question, mode ?? datasetMode);
    scrollToStudio();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav onAskClick={scrollToStudio} />

      <main className="flex-1">
        <HeroStory
          onExploreStudio={scrollToStudio}
          onInspectQuestion={(q) => handleJumpToStudio(q, 'original', true)}
        />

        <InteractiveQAStudio
          questionInput={questionInput}
          onQuestionInputChange={setQuestionInput}
          datasetMode={datasetMode}
          onDatasetModeChange={handleDatasetModeChange}
          compareV1V2={compareV1V2}
          onCompareV1V2Change={setCompareV1V2}
          knowledgeBase={knowledgeBase}
          history={history}
          onRunAndRecord={(q) => recordQueryRun(q)}
          onClearHistory={() => setHistory([])}
        />

        <KnowledgeBaseStudio
          rawDocument={rawDocument}
          onRawDocumentChange={setRawDocument}
          datasetMode={datasetMode}
          onResetDocument={handleDatasetModeChange}
          knowledgeBase={knowledgeBase}
          onQueryFromGraph={(q) => handleJumpToStudio(q)}
        />

        <BenchmarkSuite
          onSelectQuestionForStudio={(q, mode, compare) => handleJumpToStudio(q, mode, compare)}
        />
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="max-w-[1120px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            <strong className="text-slate-800 font-medium">MedLogic Hospital QA</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}
