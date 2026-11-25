import React, { useMemo, useState } from 'react';
import { Check, X, ArrowUpRight, Search } from 'lucide-react';
import {
  ALL_BENCHMARK_QUESTIONS,
  DatasetMode,
  EXPANDED_RAW_DOCUMENT,
  ORIGINAL_RAW_DOCUMENT,
} from '../engine/hospitalData';
import { evaluateAnswerMatch, parseHospitalDocument, runHospitalQuery } from '../engine/qaEngine';

interface BenchmarkSuiteProps {
  onSelectQuestionForStudio: (question: string, mode: DatasetMode, compare: boolean) => void;
}

export const BenchmarkSuite: React.FC<BenchmarkSuiteProps> = ({ onSelectQuestionForStudio }) => {
  const [searchText, setSearchText] = useState('');

  const originalKB = useMemo(() => parseHospitalDocument(ORIGINAL_RAW_DOCUMENT), []);
  const expandedKB = useMemo(() => parseHospitalDocument(EXPANDED_RAW_DOCUMENT), []);

  const evaluatedRows = useMemo(() => {
    return ALL_BENCHMARK_QUESTIONS.map((q) => {
      const kb = q.source === 'pdf' ? originalKB : expandedKB;
      const expected =
        q.source === 'pdf' && q.expectedKeywordsOriginal
          ? q.expectedKeywordsOriginal
          : q.expectedKeywordsExpanded;

      const resV1 = runHospitalQuery(q.question, kb, 'v1');
      const resV2 = runHospitalQuery(q.question, kb, 'v2');

      return {
        item: q,
        v1Pass: evaluateAnswerMatch(resV1.answer, expected),
        v2Pass: evaluateAnswerMatch(resV2.answer, expected),
        v2Answer: resV2.answer,
        v2Rules: resV2.firedRules.map((r) => (r.chained ? `${r.ruleId} + Chain` : r.ruleId)).join(', '),
      };
    });
  }, [originalKB, expandedKB]);

  const visibleRows = useMemo(() => {
    const qLower = searchText.trim().toLowerCase();
    return evaluatedRows.filter((row) => {
      if (qLower && !row.item.question.toLowerCase().includes(qLower) && !row.item.category.toLowerCase().includes(qLower)) {
        return false;
      }
      return true;
    });
  }, [evaluatedRows, searchText]);

  const totals = useMemo(() => {
    const total = visibleRows.length;
    const v1 = visibleRows.filter((r) => r.v1Pass).length;
    const v2 = visibleRows.filter((r) => r.v2Pass).length;
    return { total, v1, v2 };
  }, [visibleRows]);

  return (
    <section id="benchmark" className="py-16 bg-white">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-sky-800 mb-1">Full Question Bank</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">
              54 Test Questions (26 Original + 28 New)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Live comparison of old v1 ({totals.v1}/{totals.total}) vs final v2 ({totals.v2}/{totals.total}). Click any row to test it above.
            </p>
          </div>

        </div>

        {/* Simple Search Input */}
        <div className="mt-5 relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Filter questions or categories (e.g. Chained, MRI, Trap)..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-800"
          />
        </div>

        {/* Clean Table */}
        <div className="mt-4 border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px] text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-3 px-4 w-14">No.</th>
                <th className="py-3 px-4 w-2/5">Question</th>
                <th className="py-3 px-4 w-2/5">Answer (v2)</th>
                <th className="py-3 px-4">v1</th>
                <th className="py-3 px-4">v2</th>
                <th className="py-3 px-4 text-right">Try</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRows.map(({ item, v1Pass, v2Pass, v2Answer, v2Rules }) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700 tabular-nums align-top">
                    {item.id}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="font-medium text-slate-900 text-sm">{item.question}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.category} · {v2Rules}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-slate-700 align-top">{v2Answer}</td>
                  <td className="py-3 px-4 align-top">
                    {v1Pass ? (
                      <Check className="w-4 h-4 text-emerald-700" aria-label="Pass" />
                    ) : (
                      <X className="w-4 h-4 text-rose-700" aria-label="Fail" />
                    )}
                  </td>
                  <td className="py-3 px-4 align-top">
                    {v2Pass ? (
                      <Check className="w-4 h-4 text-emerald-700" aria-label="Pass" />
                    ) : (
                      <X className="w-4 h-4 text-rose-700" aria-label="Fail" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-right align-top">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectQuestionForStudio(
                          item.question,
                          item.source === 'pdf' ? 'original' : 'expanded',
                          !v1Pass
                        )
                      }
                      className="inline-flex items-center gap-1 font-medium text-sky-800 hover:underline cursor-pointer"
                    >
                      <span>Ask</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
