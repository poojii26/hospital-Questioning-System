export type EngineVersion = 'v1' | 'v2';

export interface TripleFact {
  id: string;
  lineNumber: number;
  subject: string;
  relation: string;
  object: string;
  raw: string;
}

export interface SkippedLine {
  lineNumber: number;
  raw: string;
  reason: string;
}

export interface KnowledgeBase {
  facts: TripleFact[];
  skippedLines: SkippedLine[];
  duplicateCount: number;
  doctors: string[];
  departments: string[];
  facilities: string[];
  services: string[];
  doctorToDept: Map<string, string>;
  doctorToSpec: Map<string, string>;
  deptToDoctors: Map<string, string[]>;
  deptToTiming: Map<string, string>;
  deptToFacilities: Map<string, string[]>;
  facilityToDepts: Map<string, string[]>;
  serviceToStatus: Map<string, string>;
  specKeywordToDoctors: Map<string, string[]>;
}

export interface FiredRuleTrace {
  ruleId: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9';
  label: string;
  chained: boolean;
  chainPath?: string;
  outputSentence: string;
  factsUsed: TripleFact[];
}

export interface RuleEvaluationRow {
  ruleId: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9';
  title: string;
  fired: boolean;
  skippedReason: string;
  chained?: boolean;
}

export interface QueryExecutionResult {
  question: string;
  version: EngineVersion;
  answer: string;
  isNotAvailable: boolean;
  tokens: string[];
  matchedIntents: { intent: string; matchedWords: string[] }[];
  matchedEntities: { type: 'Doctor' | 'Department' | 'Facility' | 'Service' | 'Specialization Keyword'; value: string; matchedText: string }[];
  guardCheck: {
    fired: boolean;
    wordBeforeDepartment?: string;
    reason: string;
  };
  firedRules: FiredRuleTrace[];
  ruleWaterfall: RuleEvaluationRow[];
  factsUsed: TripleFact[];
  executionTimeMs: number;
  v1FaultLikely?: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
}

const SPEC_STOPWORDS = new Set(['care', 'and', 'of', 'in', 'the', 'for', 'services', 'service', 'problems', 'problem', 'medicine']);

const GUARD_IGNORED_WORDS = new Set([
  's',
  'the',
  'a',
  'an',
  'this',
  'that',
  'their',
  'his',
  'her',
  'its',
  'my',
  'your',
  'our',
  'which',
  'what',
  'each',
  'every',
  'any',
  'some',
  'hospital',
  'same',
  'own',
  'which',
  'whose',
]);

const TIMING_WORDS_V2 = new Set(['timing', 'timings', 'time', 'when', 'open', 'hours', 'hour', 'schedule']);
const TIMING_WORDS_V1 = new Set(['timing', 'timings', 'time', 'hours']);

const FACILITY_WORDS = new Set(['facility', 'facilities', 'equipment']);
const DOCTOR_WORDS = new Set(['doctor', 'doctors', 'who', 'physician', 'physicians']);
const SPECIALIZATION_WORDS = new Set([
  'specialization',
  'specializations',
  'specialize',
  'specializes',
  'speciality',
  'specialty',
  'treat',
  'treats',
]);
const LISTING_WORDS = new Set(['all', 'list', 'every']);

const NOT_AVAILABLE_MSG = 'Sorry, information is not available.';

function addToMapArray(map: Map<string, string[]>, key: string, value: string) {
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
  }
  map.set(key, existing);
}

export function parseHospitalDocument(rawText: string): KnowledgeBase {
  const lines = rawText.split(/\r?\n/);
  const facts: TripleFact[] = [];
  const skippedLines: SkippedLine[] = [];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;

  lines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    if (!trimmed.includes('|')) {
      skippedLines.push({
        lineNumber,
        raw: trimmed,
        reason: 'Missing "|" delimiter for subject | relation | object triple.',
      });
      return;
    }

    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
      skippedLines.push({
        lineNumber,
        raw: trimmed,
        reason: `Expected 3 non-empty fields separated by "|", found ${parts.length}.`,
      });
      return;
    }

    const [subject, relation, object] = parts;
    if (
      subject.toLowerCase() === 'subject' &&
      relation.toLowerCase() === 'relation' &&
      object.toLowerCase() === 'object'
    ) {
      return;
    }

    const dedupeKey = `${subject.toLowerCase()}|${relation.toLowerCase()}|${object.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) {
      duplicateCount += 1;
      return;
    }
    seenKeys.add(dedupeKey);

    facts.push({
      id: `F-${facts.length + 1}`,
      lineNumber,
      subject,
      relation: relation.toLowerCase(),
      object,
      raw: `${subject} | ${relation} | ${object}`,
    });
  });

  const doctorToDept = new Map<string, string>();
  const doctorToSpec = new Map<string, string>();
  const deptToDoctors = new Map<string, string[]>();
  const deptToTiming = new Map<string, string>();
  const deptToFacilities = new Map<string, string[]>();
  const facilityToDepts = new Map<string, string[]>();
  const serviceToStatus = new Map<string, string>();
  const specKeywordToDoctors = new Map<string, string[]>();

  const doctors: string[] = [];
  const departmentsSet = new Set<string>();
  const facilitiesSet = new Set<string>();
  const services: string[] = [];

  for (const fact of facts) {
    if (fact.relation === 'works_in') {
      doctorToDept.set(fact.subject, fact.object);
      if (!doctors.includes(fact.subject)) doctors.push(fact.subject);
      departmentsSet.add(fact.object);
      addToMapArray(deptToDoctors, fact.object, fact.subject);
    } else if (fact.relation === 'specialization') {
      doctorToSpec.set(fact.subject, fact.object);
      if (!doctors.includes(fact.subject)) doctors.push(fact.subject);
      const specTokens = tokenizeWords(fact.object);
      for (const tok of specTokens) {
        if (tok.length >= 3 && !SPEC_STOPWORDS.has(tok)) {
          addToMapArray(specKeywordToDoctors, tok, fact.subject);
        }
      }
    } else if (fact.relation === 'timing') {
      departmentsSet.add(fact.subject);
      deptToTiming.set(fact.subject, fact.object);
    } else if (fact.relation === 'facility') {
      departmentsSet.add(fact.subject);
      facilitiesSet.add(fact.object);
      addToMapArray(deptToFacilities, fact.subject, fact.object);
      addToMapArray(facilityToDepts, fact.object, fact.subject);
    } else if (fact.relation === 'status') {
      if (!services.includes(fact.subject)) services.push(fact.subject);
      serviceToStatus.set(fact.subject, fact.object);
    }
  }

  return {
    facts,
    skippedLines,
    duplicateCount,
    doctors,
    departments: Array.from(departmentsSet),
    facilities: Array.from(facilitiesSet),
    services,
    doctorToDept,
    doctorToSpec,
    deptToDoctors,
    deptToTiming,
    deptToFacilities,
    facilityToDepts,
    serviceToStatus,
    specKeywordToDoctors,
  };
}

export function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+/g);
  return matches ? matches : [];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(lowerQuestion: string, phrase: string): boolean {
  const cleanPhrase = phrase.toLowerCase().trim();
  if (!cleanPhrase) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(cleanPhrase)}([^a-z0-9]|$)`, 'i');
  return pattern.test(lowerQuestion);
}

function findMatchingWords(tokens: string[], lowerQ: string, wordSet: Set<string>, version: EngineVersion): string[] {
  const matched: string[] = [];
  if (version === 'v2') {
    for (const tok of tokens) {
      if (wordSet.has(tok) && !matched.includes(tok)) {
        matched.push(tok);
      }
    }
  } else {
    // v1 bug (F6): substring matching anywhere in the lower-cased question
    for (const candidate of wordSet) {
      if (lowerQ.includes(candidate) && !matched.includes(candidate)) {
        matched.push(candidate);
      }
    }
  }
  return matched;
}

function findFactsFor(kb: KnowledgeBase, subject: string, relation?: string, object?: string): TripleFact[] {
  return kb.facts.filter(
    (f) =>
      f.subject.toLowerCase() === subject.toLowerCase() &&
      (!relation || f.relation.toLowerCase() === relation.toLowerCase()) &&
      (!object || f.object.toLowerCase() === object.toLowerCase())
  );
}

export function runHospitalQuery(
  question: string,
  kb: KnowledgeBase,
  version: EngineVersion = 'v2'
): QueryExecutionResult {
  const t0 = performance.now();
  const trimmedQ = question.trim();
  const lowerQ = trimmedQ.toLowerCase();
  const tokens = tokenizeWords(trimmedQ);

  if (!trimmedQ) {
    return {
      question,
      version,
      answer: NOT_AVAILABLE_MSG,
      isNotAvailable: true,
      tokens: [],
      matchedIntents: [],
      matchedEntities: [],
      guardCheck: { fired: false, reason: 'Empty question.' },
      firedRules: [
        {
          ruleId: 'R9',
          label: 'Fallback / Not-available guard',
          chained: false,
          outputSentence: NOT_AVAILABLE_MSG,
          factsUsed: [],
        },
      ],
      ruleWaterfall: [
        { ruleId: 'R9', title: 'Fallback / Unknown-department guard', fired: true, skippedReason: 'No input provided' },
      ],
      factsUsed: [],
      executionTimeMs: Number((performance.now() - t0).toFixed(4)),
    };
  }

  // 1. Intent Detection
  const timingSet = version === 'v2' ? TIMING_WORDS_V2 : TIMING_WORDS_V1;
  const matchedTimingWords = findMatchingWords(tokens, lowerQ, timingSet, version);
  const matchedFacilityWords = findMatchingWords(tokens, lowerQ, FACILITY_WORDS, version);
  const matchedDoctorWords = findMatchingWords(tokens, lowerQ, DOCTOR_WORDS, version);
  const matchedSpecWords = findMatchingWords(tokens, lowerQ, SPECIALIZATION_WORDS, version);
  const matchedListingWords = findMatchingWords(tokens, lowerQ, LISTING_WORDS, version);

  const hasTimingIntent = matchedTimingWords.length > 0;
  const hasFacilityIntent = matchedFacilityWords.length > 0;
  const hasDoctorIntent = matchedDoctorWords.length > 0;
  const hasSpecIntent = matchedSpecWords.length > 0;
  const hasListingIntent = matchedListingWords.length > 0;

  const matchedIntents: { intent: string; matchedWords: string[] }[] = [];
  if (hasTimingIntent) matchedIntents.push({ intent: 'timing', matchedWords: matchedTimingWords });
  if (hasFacilityIntent) matchedIntents.push({ intent: 'facility', matchedWords: matchedFacilityWords });
  if (hasDoctorIntent) matchedIntents.push({ intent: 'doctor', matchedWords: matchedDoctorWords });
  if (hasSpecIntent) matchedIntents.push({ intent: 'specialization', matchedWords: matchedSpecWords });
  if (hasListingIntent) matchedIntents.push({ intent: 'listing', matchedWords: matchedListingWords });

  // 2. Entity Extraction (whole-word / whole-phrase matching in v2; loose in v1)
  const matchedDoctors: { doctor: string; phrase: string }[] = [];
  for (const doc of kb.doctors) {
    const surnameTokens = tokenizeWords(doc).filter((w) => w !== 'dr');
    const fullDocMatch = version === 'v2' ? containsWholePhrase(lowerQ, doc) : lowerQ.includes(doc.toLowerCase());
    const surnameMatch = surnameTokens.some((part) =>
      version === 'v2' ? tokens.includes(part) : lowerQ.includes(part)
    );
    if (fullDocMatch || surnameMatch) {
      matchedDoctors.push({ doctor: doc, phrase: fullDocMatch ? doc : surnameTokens.find((p) => tokens.includes(p)) ?? doc });
    }
  }

  const matchedDepts: string[] = [];
  for (const dept of kb.departments) {
    const isMatch = version === 'v2' ? containsWholePhrase(lowerQ, dept) : lowerQ.includes(dept.toLowerCase());
    if (isMatch) matchedDepts.push(dept);
  }

  const matchedFacilities: string[] = [];
  for (const fac of kb.facilities) {
    const isMatch = version === 'v2' ? containsWholePhrase(lowerQ, fac) : lowerQ.includes(fac.toLowerCase());
    if (isMatch) matchedFacilities.push(fac);
  }

  const matchedServices: string[] = [];
  for (const svc of kb.services) {
    const svcTokens = tokenizeWords(svc);
    const fullMatch = version === 'v2' ? containsWholePhrase(lowerQ, svc) : lowerQ.includes(svc.toLowerCase());
    const primaryTokenMatch =
      svcTokens.length > 0 &&
      (svcTokens[0].length >= 5) &&
      (version === 'v2' ? tokens.includes(svcTokens[0]) : lowerQ.includes(svcTokens[0]));
    if (fullMatch || primaryTokenMatch) {
      matchedServices.push(svc);
    }
  }

  const matchedSpecKeywords: { keyword: string; doctors: string[] }[] = [];
  for (const [kw, docs] of kb.specKeywordToDoctors.entries()) {
    const isMatch = version === 'v2' ? tokens.includes(kw) : lowerQ.includes(kw);
    if (isMatch) {
      matchedSpecKeywords.push({ keyword: kw, doctors: docs });
    }
  }

  const matchedEntities: QueryExecutionResult['matchedEntities'] = [
    ...matchedDoctors.map((d) => ({ type: 'Doctor' as const, value: d.doctor, matchedText: d.phrase })),
    ...matchedDepts.map((d) => ({ type: 'Department' as const, value: d, matchedText: d })),
    ...matchedFacilities.map((f) => ({ type: 'Facility' as const, value: f, matchedText: f })),
    ...matchedServices.map((s) => ({ type: 'Service' as const, value: s, matchedText: s })),
    ...matchedSpecKeywords.map((k) => ({
      type: 'Specialization Keyword' as const,
      value: k.doctors.join(', '),
      matchedText: k.keyword,
    })),
  ];

  // 3. Unknown-Department Guard (<word> department)
  const deptSetLower = new Set(kb.departments.map((d) => d.toLowerCase()));
  let guardFired = false;
  let guardWord: string | undefined;
  let guardReason = 'No unknown "<word> department" phrase detected.';

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === 'department' || tokens[i] === 'departments') {
      const prev = tokens[i - 1];
      if (GUARD_IGNORED_WORDS.has(prev)) {
        if (prev === 's') {
          guardReason = 'Ignored possessive "\'s department" before running rules.';
        }
        continue;
      }
      if (!deptSetLower.has(prev)) {
        guardFired = true;
        guardWord = prev;
        guardReason = `"${prev} department" is not a recognized department in the Knowledge Base.`;
        break;
      }
    }
  }

  const firedRules: FiredRuleTrace[] = [];
  const ruleWaterfall: RuleEvaluationRow[] = [];

  if (guardFired) {
    ruleWaterfall.push(
      { ruleId: 'R1', title: 'Doctor department / specialization lookup', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R2', title: 'Department doctor lookup', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R3', title: 'Specialization keyword doctor lookup', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R4', title: 'Department or chained doctor timing', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R5', title: 'Department or chained doctor facility', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R6', title: 'Reverse facility -> department lookup', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R7', title: 'Hospital service status lookup', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R8', title: 'List all doctors or all facilities', fired: false, skippedReason: 'Blocked by unknown-department guard' },
      { ruleId: 'R9', title: 'Unknown-department guard / Not-available fallback', fired: true, skippedReason: guardReason }
    );

    firedRules.push({
      ruleId: 'R9',
      label: 'Unknown-department guard triggered',
      chained: false,
      outputSentence: NOT_AVAILABLE_MSG,
      factsUsed: [],
    });

    return {
      question,
      version,
      answer: NOT_AVAILABLE_MSG,
      isNotAvailable: true,
      tokens,
      matchedIntents,
      matchedEntities,
      guardCheck: { fired: true, wordBeforeDepartment: guardWord, reason: guardReason },
      firedRules,
      ruleWaterfall,
      factsUsed: [],
      executionTimeMs: Number((performance.now() - t0).toFixed(4)),
    };
  }

  // 4. Evaluate Rules R1 -> R8
  const sentences: string[] = [];
  const usedFactsMap = new Map<string, TripleFact>();
  const addFact = (f: TripleFact) => usedFactsMap.set(f.id, f);

  let earlyStopped = false;
  let resolvedDoctorFromR3: string | undefined;

  const pushRuleResult = (
    ruleId: FiredRuleTrace['ruleId'],
    label: string,
    sentence: string,
    facts: TripleFact[],
    chained = false,
    chainPath?: string
  ) => {
    sentences.push(sentence);
    facts.forEach(addFact);
    firedRules.push({
      ruleId,
      label,
      chained,
      chainPath,
      outputSentence: sentence,
      factsUsed: facts,
    });
    if (version === 'v1') {
      earlyStopped = true;
    }
  };

  // R1: Doctor is named & no timing or facility word -> return doctor's dept or specialization (v2 only; missing in v1 = F1)
  if (version === 'v1') {
    ruleWaterfall.push({
      ruleId: 'R1',
      title: 'Doctor department / specialization lookup',
      fired: false,
      skippedReason: 'Not implemented in v1 (Fault F1)',
    });
  } else if (matchedDoctors.length > 0 && !hasTimingIntent && !hasFacilityIntent) {
    const r1Outputs: string[] = [];
    const r1Facts: TripleFact[] = [];
    for (const { doctor } of matchedDoctors) {
      const askSpec = hasSpecIntent || matchedSpecKeywords.some((k) => k.doctors.includes(doctor));
      if (askSpec && kb.doctorToSpec.has(doctor)) {
        const spec = kb.doctorToSpec.get(doctor)!;
        r1Outputs.push(`${doctor}'s specialization is ${spec}.`);
        r1Facts.push(...findFactsFor(kb, doctor, 'specialization'));
      } else if (kb.doctorToDept.has(doctor)) {
        const dept = kb.doctorToDept.get(doctor)!;
        r1Outputs.push(`${doctor} works in ${dept} department.`);
        r1Facts.push(...findFactsFor(kb, doctor, 'works_in'));
      }
    }
    if (r1Outputs.length > 0) {
      pushRuleResult('R1', 'Doctor details lookup', r1Outputs.join(' '), r1Facts);
      ruleWaterfall.push({ ruleId: 'R1', title: 'Doctor department / specialization lookup', fired: true, skippedReason: 'Matched named doctor without timing/facility intent' });
    } else {
      ruleWaterfall.push({ ruleId: 'R1', title: 'Doctor department / specialization lookup', fired: false, skippedReason: 'No matching doctor facts found' });
    }
  } else {
    ruleWaterfall.push({
      ruleId: 'R1',
      title: 'Doctor department / specialization lookup',
      fired: false,
      skippedReason: matchedDoctors.length === 0 ? 'No doctor named in question' : 'Question contains timing or facility intent',
    });
  }

  // R2: Doctor word + department named, no doctor named -> list doctors in department
  const asksDeptExistence =
    version === 'v2' &&
    matchedDepts.length > 0 &&
    matchedDoctors.length === 0 &&
    !hasTimingIntent &&
    !hasFacilityIntent &&
    containsWholePhrase(lowerQ, 'is there') &&
    (tokens.includes('department') || tokens.includes('departments'));

  if (earlyStopped) {
    ruleWaterfall.push({ ruleId: 'R2', title: 'Department doctor lookup', fired: false, skippedReason: 'Skipped due to v1 early return (Fault F5)' });
  } else if ((hasDoctorIntent || asksDeptExistence) && matchedDepts.length > 0 && matchedDoctors.length === 0) {
    const r2Outputs: string[] = [];
    const r2Facts: TripleFact[] = [];
    for (const dept of matchedDepts) {
      const docs = kb.deptToDoctors.get(dept) ?? [];
      if (asksDeptExistence) {
        const timing = kb.deptToTiming.get(dept);
        const docPart = docs.length > 0 ? `Doctors: ${docs.join(', ')}` : '';
        const timePart = timing ? `Timing: ${timing}` : '';
        const details = [docPart, timePart].filter(Boolean).join('; ');
        r2Outputs.push(`${dept} department is available${details ? ` (${details})` : ''}.`);
        docs.forEach((d) => r2Facts.push(...findFactsFor(kb, d, 'works_in', dept)));
        if (timing) r2Facts.push(...findFactsFor(kb, dept, 'timing'));
      } else if (docs.length > 0) {
        const verb = docs.length === 1 ? 'works' : 'work';
        r2Outputs.push(`${docs.join(', ')} ${verb} in ${dept} department.`);
        docs.forEach((d) => r2Facts.push(...findFactsFor(kb, d, 'works_in', dept)));
      }
    }
    if (r2Outputs.length > 0) {
      pushRuleResult('R2', asksDeptExistence ? 'Department existence & doctor lookup' : 'Department doctor lookup', r2Outputs.join(' '), r2Facts);
      ruleWaterfall.push({
        ruleId: 'R2',
        title: 'Department doctor lookup',
        fired: true,
        skippedReason: asksDeptExistence ? 'Matched explicit department existence query' : 'Matched doctor intent + department entity',
      });
    } else {
      ruleWaterfall.push({ ruleId: 'R2', title: 'Department doctor lookup', fired: false, skippedReason: 'No doctors indexed for matched department' });
    }
  } else {
    ruleWaterfall.push({
      ruleId: 'R2',
      title: 'Department doctor lookup',
      fired: false,
      skippedReason: !hasDoctorIntent
        ? 'No doctor intent word'
        : matchedDepts.length === 0
        ? 'No known department named'
        : 'A specific doctor was already named',
    });
  }

  // R3: Doctor word present, no doctor or department named, and a word matches a specialization keyword (v2 only; missing in v1 = F1)
  if (version === 'v1') {
    ruleWaterfall.push({
      ruleId: 'R3',
      title: 'Specialization keyword doctor lookup',
      fired: false,
      skippedReason: 'Not implemented in v1 (Fault F1)',
    });
  } else if (hasDoctorIntent && matchedDoctors.length === 0 && matchedDepts.length === 0 && matchedSpecKeywords.length > 0) {
    const matchedDocsUnique: string[] = [];
    for (const item of matchedSpecKeywords) {
      for (const doc of item.doctors) {
        if (!matchedDocsUnique.includes(doc)) matchedDocsUnique.push(doc);
      }
    }
    const r3Outputs: string[] = [];
    const r3Facts: TripleFact[] = [];
    for (const doc of matchedDocsUnique) {
      const spec = kb.doctorToSpec.get(doc);
      if (spec) {
        r3Outputs.push(`${doc} specializes in ${spec}.`);
        r3Facts.push(...findFactsFor(kb, doc, 'specialization'));
        if (!resolvedDoctorFromR3) resolvedDoctorFromR3 = doc;
      }
    }
    if (r3Outputs.length > 0) {
      pushRuleResult('R3', 'Specialization keyword lookup', r3Outputs.join(' '), r3Facts);
      ruleWaterfall.push({ ruleId: 'R3', title: 'Specialization keyword doctor lookup', fired: true, skippedReason: `Matched specialization keyword (${matchedSpecKeywords.map((k) => k.keyword).join(', ')})` });
    } else {
      ruleWaterfall.push({ ruleId: 'R3', title: 'Specialization keyword doctor lookup', fired: false, skippedReason: 'No specialization facts found' });
    }
  } else {
    ruleWaterfall.push({
      ruleId: 'R3',
      title: 'Specialization keyword doctor lookup',
      fired: false,
      skippedReason: !hasDoctorIntent
        ? 'No doctor intent word'
        : matchedSpecKeywords.length === 0
        ? 'No specialization keyword matched'
        : 'Doctor or department already explicitly named',
    });
  }

  // R4: Timing word + department named, OR doctor named (v2 chains doctor -> works_in -> timing; v1 requires department = F4)
  if (earlyStopped) {
    ruleWaterfall.push({ ruleId: 'R4', title: 'Department or chained doctor timing', fired: false, skippedReason: 'Skipped due to v1 early return (Fault F5)' });
  } else if (hasTimingIntent && (matchedDepts.length > 0 || (version === 'v2' && (matchedDoctors.length > 0 || resolvedDoctorFromR3)))) {
    const r4Outputs: string[] = [];
    const r4Facts: TripleFact[] = [];
    let isChained = false;
    let chainPath: string | undefined;

    if (matchedDepts.length > 0) {
      for (const dept of matchedDepts) {
        const timing = kb.deptToTiming.get(dept);
        if (timing) {
          r4Outputs.push(`${dept} timing is ${timing}.`);
          r4Facts.push(...findFactsFor(kb, dept, 'timing'));
        }
      }
    } else if (version === 'v2') {
      const targetDoctors = matchedDoctors.length > 0 ? matchedDoctors.map((d) => d.doctor) : resolvedDoctorFromR3 ? [resolvedDoctorFromR3] : [];
      for (const doc of targetDoctors) {
        const dept = kb.doctorToDept.get(doc);
        if (dept && kb.deptToTiming.has(dept)) {
          const timing = kb.deptToTiming.get(dept)!;
          isChained = true;
          chainPath = `${doc} -> works_in -> ${dept} -> timing -> ${timing}`;
          r4Outputs.push(`${dept} timing is ${timing}.`);
          r4Facts.push(...findFactsFor(kb, doc, 'works_in'), ...findFactsFor(kb, dept, 'timing'));
        }
      }
    }

    if (r4Outputs.length > 0) {
      pushRuleResult('R4', isChained ? 'Chained doctor timing lookup' : 'Department timing lookup', r4Outputs.join(' '), r4Facts, isChained, chainPath);
      ruleWaterfall.push({
        ruleId: 'R4',
        title: 'Department or chained doctor timing',
        fired: true,
        chained: isChained,
        skippedReason: isChained ? `Chained via works_in (${chainPath})` : 'Matched timing intent + department',
      });
    } else {
      ruleWaterfall.push({ ruleId: 'R4', title: 'Department or chained doctor timing', fired: false, skippedReason: 'No timing fact found for target department' });
    }
  } else {
    ruleWaterfall.push({
      ruleId: 'R4',
      title: 'Department or chained doctor timing',
      fired: false,
      skippedReason: !hasTimingIntent
        ? 'No timing intent word matched'
        : version === 'v1' && matchedDoctors.length > 0
        ? 'v1 lacks chained doctor -> department lookup (Fault F4)'
        : 'No department or doctor entity matched',
    });
  }

  // R5: Facility word + department named, OR doctor named (v2 chains doctor -> works_in -> facility)
  if (earlyStopped) {
    ruleWaterfall.push({ ruleId: 'R5', title: 'Department or chained doctor facility', fired: false, skippedReason: 'Skipped due to v1 early return (Fault F5)' });
  } else if (hasFacilityIntent && (matchedDepts.length > 0 || (version === 'v2' && matchedDoctors.length > 0))) {
    const r5Outputs: string[] = [];
    const r5Facts: TripleFact[] = [];
    let isChained = false;
    let chainPath: string | undefined;

    if (matchedDepts.length > 0) {
      for (const dept of matchedDepts) {
        const facs = kb.deptToFacilities.get(dept) ?? [];
        if (facs.length > 0) {
          r5Outputs.push(`${dept} provides ${facs.join(', ')} facility.`);
          facs.forEach((f) => r5Facts.push(...findFactsFor(kb, dept, 'facility', f)));
        }
      }
    } else if (version === 'v2') {
      for (const { doctor } of matchedDoctors) {
        const dept = kb.doctorToDept.get(doctor);
        const facs = dept ? kb.deptToFacilities.get(dept) ?? [] : [];
        if (dept && facs.length > 0) {
          isChained = true;
          chainPath = `${doctor} -> works_in -> ${dept} -> facility -> ${facs.join(', ')}`;
          r5Outputs.push(`${dept} provides ${facs.join(', ')} facility.`);
          r5Facts.push(...findFactsFor(kb, doctor, 'works_in'));
          facs.forEach((f) => r5Facts.push(...findFactsFor(kb, dept, 'facility', f)));
        }
      }
    }

    if (r5Outputs.length > 0) {
      pushRuleResult('R5', isChained ? 'Chained doctor facility lookup' : 'Department facility lookup', r5Outputs.join(' '), r5Facts, isChained, chainPath);
      ruleWaterfall.push({
        ruleId: 'R5',
        title: 'Department or chained doctor facility',
        fired: true,
        chained: isChained,
        skippedReason: isChained ? `Chained via works_in (${chainPath})` : 'Matched facility intent + department',
      });
    } else {
      ruleWaterfall.push({ ruleId: 'R5', title: 'Department or chained doctor facility', fired: false, skippedReason: 'No facility fact found for target department' });
    }
  } else {
    ruleWaterfall.push({
      ruleId: 'R5',
      title: 'Department or chained doctor facility',
      fired: false,
      skippedReason: !hasFacilityIntent ? 'No facility intent word matched' : 'No department or doctor entity matched',
    });
  }

  // R6: Facility name appears in question -> reverse lookup department (v2 only; missing in v1 = F2)
  if (version === 'v1') {
    ruleWaterfall.push({
      ruleId: 'R6',
      title: 'Reverse facility -> department lookup',
      fired: false,
      skippedReason: 'Not implemented in v1 (Fault F2)',
    });
  } else if (matchedFacilities.length > 0) {
    const r6Outputs: string[] = [];
    const r6Facts: TripleFact[] = [];
    for (const fac of matchedFacilities) {
      const depts = kb.facilityToDepts.get(fac) ?? [];
      if (depts.length > 0) {
        r6Outputs.push(`${fac} is provided by ${depts.join(', ')}.`);
        depts.forEach((d) => r6Facts.push(...findFactsFor(kb, d, 'facility', fac)));
      }
    }
    if (r6Outputs.length > 0) {
      pushRuleResult('R6', 'Reverse facility lookup', r6Outputs.join(' '), r6Facts);
      ruleWaterfall.push({ ruleId: 'R6', title: 'Reverse facility -> department lookup', fired: true, skippedReason: `Matched facility name (${matchedFacilities.join(', ')})` });
    } else {
      ruleWaterfall.push({ ruleId: 'R6', title: 'Reverse facility -> department lookup', fired: false, skippedReason: 'No department found for facility' });
    }
  } else {
    ruleWaterfall.push({ ruleId: 'R6', title: 'Reverse facility -> department lookup', fired: false, skippedReason: 'No known facility name in question' });
  }

  // R7: Hospital service appears -> return service status
  if (earlyStopped) {
    ruleWaterfall.push({ ruleId: 'R7', title: 'Hospital service status lookup', fired: false, skippedReason: 'Skipped due to v1 early return (Fault F5)' });
  } else if (matchedServices.length > 0) {
    const r7Outputs: string[] = [];
    const r7Facts: TripleFact[] = [];
    for (const svc of matchedServices) {
      const status = kb.serviceToStatus.get(svc);
      if (status) {
        r7Outputs.push(`${svc} is ${status}.`);
        r7Facts.push(...findFactsFor(kb, svc, 'status'));
      }
    }
    if (r7Outputs.length > 0) {
      pushRuleResult('R7', 'Hospital service status', r7Outputs.join(' '), r7Facts);
      ruleWaterfall.push({ ruleId: 'R7', title: 'Hospital service status lookup', fired: true, skippedReason: `Matched hospital service (${matchedServices.join(', ')})` });
    } else {
      ruleWaterfall.push({ ruleId: 'R7', title: 'Hospital service status lookup', fired: false, skippedReason: 'No service status fact found' });
    }
  } else {
    ruleWaterfall.push({ ruleId: 'R7', title: 'Hospital service status lookup', fired: false, skippedReason: 'No hospital service keyword matched' });
  }

  // R8: Doctor word + listing word, OR facility word with no department/doctor/facility (v2 only; missing in v1 = F5)
  if (version === 'v1') {
    ruleWaterfall.push({
      ruleId: 'R8',
      title: 'List all doctors or all facilities',
      fired: false,
      skippedReason: 'Not implemented in v1 (Fault F5)',
    });
  } else {
    const listDoctorsCondition = hasDoctorIntent && hasListingIntent && matchedDepts.length === 0 && matchedDoctors.length === 0;
    const listFacilitiesCondition =
      hasFacilityIntent && matchedDepts.length === 0 && matchedDoctors.length === 0 && matchedFacilities.length === 0;

    if (listDoctorsCondition || listFacilitiesCondition) {
      const r8Outputs: string[] = [];
      const r8Facts: TripleFact[] = [];

      if (listDoctorsCondition && kb.doctors.length > 0) {
        const entries = kb.doctors.map((d) => `${d} (${kb.doctorToDept.get(d) ?? 'General'})`);
        r8Outputs.push(`Doctors: ${entries.join(', ')}.`);
        kb.doctors.forEach((d) => r8Facts.push(...findFactsFor(kb, d, 'works_in')));
      }
      if (listFacilitiesCondition && kb.facilities.length > 0) {
        const entries: string[] = [];
        for (const [dept, facs] of kb.deptToFacilities.entries()) {
          entries.push(`${dept} - ${facs.join(', ')}`);
          facs.forEach((f) => r8Facts.push(...findFactsFor(kb, dept, 'facility', f)));
        }
        r8Outputs.push(`Facilities: ${entries.join('; ')}.`);
      }

      if (r8Outputs.length > 0) {
        pushRuleResult('R8', 'Full directory listing', r8Outputs.join(' '), r8Facts);
        ruleWaterfall.push({
          ruleId: 'R8',
          title: 'List all doctors or all facilities',
          fired: true,
          skippedReason: listDoctorsCondition ? 'Matched doctor + listing intent' : 'Matched facility intent with no specific department',
        });
      } else {
        ruleWaterfall.push({ ruleId: 'R8', title: 'List all doctors or all facilities', fired: false, skippedReason: 'Knowledge Base list empty' });
      }
    } else {
      ruleWaterfall.push({
        ruleId: 'R8',
        title: 'List all doctors or all facilities',
        fired: false,
        skippedReason: 'Listing condition not satisfied',
      });
    }
  }

  // R9: Fallback if nothing fired
  if (sentences.length === 0) {
    firedRules.push({
      ruleId: 'R9',
      label: 'No rule fired -> Not-available fallback',
      chained: false,
      outputSentence: NOT_AVAILABLE_MSG,
      factsUsed: [],
    });
    ruleWaterfall.push({
      ruleId: 'R9',
      title: 'Unknown-department guard / Not-available fallback',
      fired: true,
      skippedReason: 'No prior rule R1–R8 produced an answer',
    });
  } else {
    ruleWaterfall.push({
      ruleId: 'R9',
      title: 'Unknown-department guard / Not-available fallback',
      fired: false,
      skippedReason: `Skipped because ${firedRules.map((r) => r.ruleId).join(', ')} answered the query`,
    });
  }

  const finalAnswer = sentences.length > 0 ? sentences.join(' ') : NOT_AVAILABLE_MSG;

  return {
    question,
    version,
    answer: finalAnswer,
    isNotAvailable: sentences.length === 0,
    tokens,
    matchedIntents,
    matchedEntities,
    guardCheck: { fired: false, reason: guardReason },
    firedRules,
    ruleWaterfall,
    factsUsed: Array.from(usedFactsMap.values()),
    executionTimeMs: Number((performance.now() - t0).toFixed(4)),
  };
}

export function evaluateAnswerMatch(answer: string, expectedKeywords: string[]): boolean {
  const lower = answer.toLowerCase();
  return expectedKeywords.every((kw) => lower.includes(kw.toLowerCase()));
}
