import React, { useState } from 'react';
import { Plus, RotateCcw, Pencil } from 'lucide-react';
import { KnowledgeBase } from '../engine/qaEngine';
import { DatasetMode } from '../engine/hospitalData';

interface KnowledgeBaseStudioProps {
  rawDocument: string;
  onRawDocumentChange: (nextText: string) => void;
  datasetMode: DatasetMode;
  onResetDocument: (mode: DatasetMode) => void;
  knowledgeBase: KnowledgeBase;
  onQueryFromGraph: (question: string) => void;
}

export const KnowledgeBaseStudio: React.FC<KnowledgeBaseStudioProps> = ({
  rawDocument,
  onRawDocumentChange,
  datasetMode,
  onResetDocument,
  knowledgeBase,
  onQueryFromGraph,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [subject, setSubject] = useState('');
  const [relation, setRelation] = useState<'works_in' | 'specialization' | 'timing' | 'facility' | 'status'>('works_in');
  const [objectVal, setObjectVal] = useState('');

  const handleAddTriple = (e: React.FormEvent) => {
    e.preventDefault();
    const s = subject.trim();
    const o = objectVal.trim();
    if (!s || !o) return;
    onRawDocumentChange(rawDocument.trimEnd() + `\n${s} | ${relation} | ${o}`);
    setSubject('');
    setObjectVal('');
  };

  return (
    <section id="knowledge-base" className="py-16 border-b border-slate-200 bg-slate-50">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-sky-800 mb-1">Hospital Directory</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">
              Facts Stored in the Knowledge Base
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Click any doctor, equipment, or service below to ask about it automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onResetDocument(datasetMode === 'original' ? 'expanded' : 'original')}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />
              Switch to {datasetMode === 'original' ? 'Expanded (28 Facts)' : 'Original (10 Facts)'}
            </button>
            <button
              type="button"
              onClick={() => setShowEditor(!showEditor)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                showEditor
                  ? 'bg-sky-800 text-white border-sky-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Pencil className="w-3.5 h-3.5 inline mr-1.5" />
              {showEditor ? 'Hide Fact Editor' : 'Edit / Add Facts'}
            </button>
          </div>
        </div>

        {/* Clean Department Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBase.departments.map((dept) => {
            const doctors = knowledgeBase.deptToDoctors.get(dept) ?? [];
            const timing = knowledgeBase.deptToTiming.get(dept) ?? 'Not listed';
            const facilities = knowledgeBase.deptToFacilities.get(dept) ?? [];

            return (
              <div key={dept} className="p-5 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">{dept}</h3>
                  <span className="font-mono text-xs text-slate-500">{timing}</span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Doctor: </span>
                    {doctors.length > 0 ? (
                      doctors.map((doc) => (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => onQueryFromGraph(`What are the timings of ${doc}'s department?`)}
                          className="font-medium text-sky-800 hover:underline mr-2 cursor-pointer"
                        >
                          {doc} ({knowledgeBase.doctorToSpec.get(doc) ?? 'Specialist'})
                        </button>
                      ))
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500">Equipment: </span>
                    {facilities.length > 0 ? (
                      facilities.map((fac) => (
                        <button
                          key={fac}
                          type="button"
                          onClick={() => onQueryFromGraph(`Which department has ${fac}?`)}
                          className="font-mono text-slate-800 hover:text-sky-800 hover:underline mr-2 cursor-pointer"
                        >
                          {fac}
                        </button>
                      ))
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hospital Services Strip */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-slate-500">24/7 &amp; Support Services:</span>
          {knowledgeBase.services.map((svc) => (
            <button
              key={svc}
              type="button"
              onClick={() => onQueryFromGraph(`Is ${svc.toLowerCase()} available?`)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-sky-800 rounded-lg transition-colors cursor-pointer"
            >
              <span className="font-semibold text-slate-900">{svc}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="font-mono text-emerald-700">{knowledgeBase.serviceToStatus.get(svc)}</span>
            </button>
          ))}
        </div>

        {/* Collapsible Raw Fact Editor */}
        {showEditor && (
          <div className="mt-8 p-6 bg-white border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800">hospital.txt ({knowledgeBase.facts.length} facts)</span>
              {knowledgeBase.skippedLines.length > 0 && (
                <span className="text-amber-700 font-medium">
                  {knowledgeBase.skippedLines.length} malformed line(s) skipped
                </span>
              )}
            </div>

            <textarea
              value={rawDocument}
              onChange={(e) => onRawDocumentChange(e.target.value)}
              rows={9}
              spellCheck={false}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-800"
            />

            <form onSubmit={handleAddTriple} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (e.g. Dr. Sana)"
                className="sm:col-span-4 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value as typeof relation)}
                className="sm:col-span-3 px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="works_in">works_in</option>
                <option value="specialization">specialization</option>
                <option value="timing">timing</option>
                <option value="facility">facility</option>
                <option value="status">status</option>
              </select>
              <input
                type="text"
                value={objectVal}
                onChange={(e) => setObjectVal(e.target.value)}
                placeholder="Object (e.g. Eye Care)"
                className="sm:col-span-3 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
};
