export type DatasetMode = 'original' | 'expanded';

export interface BenchmarkQuestion {
  id: string;
  number: number;
  question: string;
  category:
    | 'Doctor lookup'
    | 'Timing'
    | 'Facility'
    | 'Service'
    | 'Doctor details'
    | 'Reverse lookup'
    | 'Chained'
    | 'Listing'
    | 'Multi-intent'
    | 'Unavailable'
    | 'Adversarial trap';
  source: 'pdf' | 'expanded';
  expectedRule: string;
  expectedAnswerOriginal?: string;
  expectedKeywordsExpanded: string[];
  /** Keywords that MUST be present in the final v2 answer (case-insensitive) */
  expectedKeywordsOriginal?: string[];
  v1Note?: string;
  faultId?: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
}

export interface FaultChronicle {
  id: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
  title: string;
  severity: 'High' | 'Critical';
  questionsAffected: string[];
  sampleQuestionId: string;
  sampleQuestion: string;
  v1Behavior: string;
  v2Fix: string;
  ruleAddedOrUpdated: string;
}

export interface StoryChapter {
  id: string;
  phase: string;
  title: string;
  subtitle: string;
  accuracyLabel: string;
  summary: string;
  keyTakeaway: string;
  highlightQuestionId: string;
}

export const ORIGINAL_RAW_DOCUMENT = `# Hospital Information Knowledge Base (Original hospital.txt — 10 Facts)
# Format: subject | relation | object
Dr. Meera | works_in | Cardiology
Dr. Meera | specialization | Heart Care
Dr. Arun | works_in | Neurology
Dr. Arun | specialization | Brain Care
Cardiology | timing | 9 AM to 1 PM
Neurology | timing | 10 AM to 4 PM
Cardiology | facility | ECG
Neurology | facility | Brain Scanning
Emergency service | status | Available 24 Hours
Pharmacy | status | Available 24 Hours`;

export const EXPANDED_RAW_DOCUMENT = `# Hospital Information Knowledge Base (Expanded Edition — 28 Facts)
# Format: subject | relation | object
Dr. Meera | works_in | Cardiology
Dr. Meera | specialization | Heart Care
Dr. Arun | works_in | Neurology
Dr. Arun | specialization | Brain Care
Dr. Priya | works_in | Pediatrics
Dr. Priya | specialization | Child Care
Dr. Vikram | works_in | Orthopedics
Dr. Vikram | specialization | Bone and Joint Care
Dr. Kavita | works_in | Dermatology
Dr. Kavita | specialization | Skin Care
Dr. Rohan | works_in | Radiology
Dr. Rohan | specialization | Diagnostic Imaging
Cardiology | timing | 9 AM to 1 PM
Neurology | timing | 10 AM to 4 PM
Pediatrics | timing | 8 AM to 2 PM
Orthopedics | timing | 11 AM to 5 PM
Dermatology | timing | 9 AM to 3 PM
Radiology | timing | 8 AM to 8 PM
Cardiology | facility | ECG
Neurology | facility | Brain Scanning
Pediatrics | facility | Neonatal ICU
Orthopedics | facility | Digital X-Ray
Dermatology | facility | Laser Therapy
Radiology | facility | MRI Scanner
Emergency service | status | Available 24 Hours
Pharmacy | status | Available 24 Hours
Blood bank | status | Available 24 Hours
Diagnostic lab | status | Open 7 AM to 9 PM`;

export const FAULT_CHRONICLES: FaultChronicle[] = [
  {
    id: 'F1',
    title: 'Missing Doctor-to-Department & Specialization Lookups',
    severity: 'High',
    questionsAffected: ['Q9', 'Q10', 'Q11'],
    sampleQuestionId: 'Q11',
    sampleQuestion: 'Which doctor treats heart problems?',
    v1Behavior:
      'v1 only started from a department name. Questions naming a doctor (Q9, Q10) or asking by medical keyword like "heart" (Q11) fell through to not-available.',
    v2Fix:
      'Added R1 (doctor entity -> department or specialization) and R3 (specialization keyword index -> matching doctor).',
    ruleAddedOrUpdated: 'R1, R3',
  },
  {
    id: 'F2',
    title: 'No Reverse Lookup from Facility to Department',
    severity: 'High',
    questionsAffected: ['Q12', 'Q13'],
    sampleQuestionId: 'Q12',
    sampleQuestion: 'Is an ECG available in the hospital?',
    v1Behavior:
      'v1 indexed department -> facility, but not facility -> department. Asking directly about ECG or Brain Scanning returned not-available.',
    v2Fix:
      'Added R6 to index facility names in reverse and return the department providing that equipment.',
    ruleAddedOrUpdated: 'R6',
  },
  {
    id: 'F3',
    title: 'Narrow Timing Trigger Vocabulary',
    severity: 'High',
    questionsAffected: ['Q14'],
    sampleQuestionId: 'Q14',
    sampleQuestion: 'When is Neurology open?',
    v1Behavior:
      'v1 only recognized "timing", "time", and "hours". Phrasing with "when" and "open" failed to trigger the timing rule.',
    v2Fix:
      'Expanded the timing intent word set to include "when" and "open" alongside "timing", "time", and "hours".',
    ruleAddedOrUpdated: 'R4 Intent Set',
  },
  {
    id: 'F4',
    title: 'Missing Chained Inference Across Triples',
    severity: 'High',
    questionsAffected: ['Q15'],
    sampleQuestionId: 'Q15',
    sampleQuestion: "What are the timings of Dr. Meera's department?",
    v1Behavior:
      'v1 required the department name explicitly in the question. Naming Dr. Meera instead of Cardiology caused R4 to miss the timing fact.',
    v2Fix:
      'Updated R4 & R5 to chain doctor -> works_in -> department -> timing/facility, and made the unknown-department guard ignore possessive "\'s".',
    ruleAddedOrUpdated: 'R4 + Chain, R5 + Chain',
  },
  {
    id: 'F5',
    title: 'Early Return Blocked Listings & Multi-Intent Questions',
    severity: 'High',
    questionsAffected: ['Q16', 'Q17', 'Q18'],
    sampleQuestionId: 'Q18',
    sampleQuestion: 'What are the timing and facility of Neurology?',
    v1Behavior:
      'v1 stopped after the first rule matched, returning only Neurology timing and dropping the facility part, while "list all" queries had no rule.',
    v2Fix:
      'Added R8 for listing all doctors or facilities, and changed the engine to evaluate R1–R8 in order and accumulate every fired rule.',
    ruleAddedOrUpdated: 'R8 + Multi-Rule Accumulator',
  },
  {
    id: 'F6',
    title: 'Substring Collision Hallucinated a Confident Wrong Answer',
    severity: 'Critical',
    questionsAffected: ['Q26'],
    sampleQuestionId: 'Q26',
    sampleQuestion: 'Does Neurology offer whole body scanning?',
    v1Behavior:
      'Substring matching detected "who" inside the word "whole" alongside "Neurology", causing R2 to falsely answer "Dr. Arun works in Neurology department."',
    v2Fix:
      'Replaced substring checks with strict whole-word tokenization and exact phrase boundaries for every intent word and entity.',
    ruleAddedOrUpdated: 'Whole-Word Guard (All Rules)',
  },
];

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'chapter-1',
    phase: 'Chapter 01 · The Symbolic Brief',
    title: 'Zero NLP, Zero RAG — Pure Auditable Triples',
    subtitle: 'Ramaiah University · AID201A Artificial Intelligence',
    accuracyLabel: '10 Structured Facts',
    summary:
      'Hospital queries demand exact facts, not probabilistic guesses. Instead of embeddings or language models, the system parses a plain text file into (subject, relation, object) triples and reasons strictly with nine ordered IF-THEN rules.',
    keyTakeaway: 'Every answer traces directly to a fired rule ID and its underlying Knowledge Base triples.',
    highlightQuestionId: 'Q3',
  },
  {
    id: 'chapter-2',
    phase: 'Chapter 02 · The Draft Illusion',
    title: '6 out of 6 on First Draft — Until Direction Reversed',
    subtitle: 'Original Engine (v1) vs Bidirectional Evaluation',
    accuracyLabel: '57.7% Accuracy (15/26)',
    summary:
      'The six original draft test cases (Q1, Q3, Q5, Q7, Q8, Q22) all started from a department name—and v1 passed 100% of them. When tested across 26 bidirectional questions, 11 answers failed across 6 hidden structural faults.',
    keyTakeaway: 'A test set must probe every relation in both directions, not only the common path.',
    highlightQuestionId: 'Q15',
  },
  {
    id: 'chapter-3',
    phase: 'Chapter 03 · The Substring Trap',
    title: 'How "who" Inside "whole" Caused a Confident Hallucination',
    subtitle: 'Fault F6 · Most Serious Clinical Failure',
    accuracyLabel: '1 Critical False Positive',
    summary:
      'In Q26 ("Does Neurology offer whole body scanning?"), v1 matched the substring "who" inside "whole" and confidently returned Dr. Arun’s department instead of admitting the information was unavailable.',
    keyTakeaway: 'In medical information systems, a confident wrong answer is far worse than "Sorry, information is not available."',
    highlightQuestionId: 'Q26',
  },
  {
    id: 'chapter-4',
    phase: 'Chapter 04 · The Nine-Rule Resolution',
    title: 'Chained Inference, Multi-Rule Accumulation & Expansion',
    subtitle: 'Final Engine (v2) + 28 New Benchmark Queries',
    accuracyLabel: '100% Rule Coverage (26/26)',
    summary:
      'Adding R1, R3, R6, and R8, expanding intent sets, enforcing whole-word matching, and chaining doctor -> works_in -> department lifted accuracy from 57.7% to 100%—and scales seamlessly to 28 facts and 54 benchmark questions.',
    keyTakeaway: 'Symbolic rule systems remain transparent, deterministic, and sub-millisecond fast.',
    highlightQuestionId: 'Q41',
  },
];

export const PDF_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id: 'Q1',
    number: 1,
    question: 'Which doctor works in Cardiology?',
    category: 'Doctor lookup',
    source: 'pdf',
    expectedRule: 'R2',
    expectedAnswerOriginal: 'Dr. Meera works in Cardiology department.',
    expectedKeywordsOriginal: ['Dr. Meera', 'Cardiology'],
    expectedKeywordsExpanded: ['Dr. Meera', 'Cardiology'],
  },
  {
    id: 'Q2',
    number: 2,
    question: 'Who works in Neurology?',
    category: 'Doctor lookup',
    source: 'pdf',
    expectedRule: 'R2',
    expectedAnswerOriginal: 'Dr. Arun works in Neurology department.',
    expectedKeywordsOriginal: ['Dr. Arun', 'Neurology'],
    expectedKeywordsExpanded: ['Dr. Arun', 'Neurology'],
  },
  {
    id: 'Q3',
    number: 3,
    question: 'What are the Cardiology timings?',
    category: 'Timing',
    source: 'pdf',
    expectedRule: 'R4',
    expectedAnswerOriginal: 'Cardiology timing is 9 AM to 1 PM.',
    expectedKeywordsOriginal: ['Cardiology', '9 AM to 1 PM'],
    expectedKeywordsExpanded: ['Cardiology', '9 AM to 1 PM'],
  },
  {
    id: 'Q4',
    number: 4,
    question: 'What time does Neurology open?',
    category: 'Timing',
    source: 'pdf',
    expectedRule: 'R4',
    expectedAnswerOriginal: 'Neurology timing is 10 AM to 4 PM.',
    expectedKeywordsOriginal: ['Neurology', '10 AM to 4 PM'],
    expectedKeywordsExpanded: ['Neurology', '10 AM to 4 PM'],
  },
  {
    id: 'Q5',
    number: 5,
    question: 'What facility is available in Neurology?',
    category: 'Facility',
    source: 'pdf',
    expectedRule: 'R5',
    expectedAnswerOriginal: 'Neurology provides Brain Scanning facility.',
    expectedKeywordsOriginal: ['Neurology', 'Brain Scanning'],
    expectedKeywordsExpanded: ['Neurology', 'Brain Scanning'],
  },
  {
    id: 'Q6',
    number: 6,
    question: 'What facility does Cardiology provide?',
    category: 'Facility',
    source: 'pdf',
    expectedRule: 'R5',
    expectedAnswerOriginal: 'Cardiology provides ECG facility.',
    expectedKeywordsOriginal: ['Cardiology', 'ECG'],
    expectedKeywordsExpanded: ['Cardiology', 'ECG'],
  },
  {
    id: 'Q7',
    number: 7,
    question: 'Is emergency service available?',
    category: 'Service',
    source: 'pdf',
    expectedRule: 'R7',
    expectedAnswerOriginal: 'Emergency service is Available 24 Hours.',
    expectedKeywordsOriginal: ['Emergency service', 'Available 24 Hours'],
    expectedKeywordsExpanded: ['Emergency service', 'Available 24 Hours'],
  },
  {
    id: 'Q8',
    number: 8,
    question: 'Is pharmacy available?',
    category: 'Service',
    source: 'pdf',
    expectedRule: 'R7',
    expectedAnswerOriginal: 'Pharmacy is Available 24 Hours.',
    expectedKeywordsOriginal: ['Pharmacy', 'Available 24 Hours'],
    expectedKeywordsExpanded: ['Pharmacy', 'Available 24 Hours'],
  },
  {
    id: 'Q9',
    number: 9,
    question: "What is Dr. Meera's specialization?",
    category: 'Doctor details',
    source: 'pdf',
    expectedRule: 'R1',
    expectedAnswerOriginal: "Dr. Meera's specialization is Heart Care.",
    expectedKeywordsOriginal: ['Dr. Meera', 'Heart Care'],
    expectedKeywordsExpanded: ['Dr. Meera', 'Heart Care'],
    faultId: 'F1',
  },
  {
    id: 'Q10',
    number: 10,
    question: 'Which department does Dr. Arun work in?',
    category: 'Doctor details',
    source: 'pdf',
    expectedRule: 'R1',
    expectedAnswerOriginal: 'Dr. Arun works in Neurology department.',
    expectedKeywordsOriginal: ['Dr. Arun', 'Neurology'],
    expectedKeywordsExpanded: ['Dr. Arun', 'Neurology'],
    faultId: 'F1',
  },
  {
    id: 'Q11',
    number: 11,
    question: 'Which doctor treats heart problems?',
    category: 'Doctor details',
    source: 'pdf',
    expectedRule: 'R3',
    expectedAnswerOriginal: 'Dr. Meera specializes in Heart Care.',
    expectedKeywordsOriginal: ['Dr. Meera', 'Heart Care'],
    expectedKeywordsExpanded: ['Dr. Meera', 'Heart Care'],
    faultId: 'F1',
  },
  {
    id: 'Q12',
    number: 12,
    question: 'Is an ECG available in the hospital?',
    category: 'Reverse lookup',
    source: 'pdf',
    expectedRule: 'R6',
    expectedAnswerOriginal: 'ECG is provided by Cardiology.',
    expectedKeywordsOriginal: ['ECG', 'Cardiology'],
    expectedKeywordsExpanded: ['ECG', 'Cardiology'],
    faultId: 'F2',
  },
  {
    id: 'Q13',
    number: 13,
    question: 'Which department has Brain Scanning?',
    category: 'Reverse lookup',
    source: 'pdf',
    expectedRule: 'R6',
    expectedAnswerOriginal: 'Brain Scanning is provided by Neurology.',
    expectedKeywordsOriginal: ['Brain Scanning', 'Neurology'],
    expectedKeywordsExpanded: ['Brain Scanning', 'Neurology'],
    faultId: 'F2',
  },
  {
    id: 'Q14',
    number: 14,
    question: 'When is Neurology open?',
    category: 'Timing',
    source: 'pdf',
    expectedRule: 'R4',
    expectedAnswerOriginal: 'Neurology timing is 10 AM to 4 PM.',
    expectedKeywordsOriginal: ['Neurology', '10 AM to 4 PM'],
    expectedKeywordsExpanded: ['Neurology', '10 AM to 4 PM'],
    faultId: 'F3',
  },
  {
    id: 'Q15',
    number: 15,
    question: "What are the timings of Dr. Meera's department?",
    category: 'Chained',
    source: 'pdf',
    expectedRule: 'R4 + chain',
    expectedAnswerOriginal: 'Cardiology timing is 9 AM to 1 PM.',
    expectedKeywordsOriginal: ['Cardiology', '9 AM to 1 PM'],
    expectedKeywordsExpanded: ['Cardiology', '9 AM to 1 PM'],
    faultId: 'F4',
  },
  {
    id: 'Q16',
    number: 16,
    question: 'List all doctors.',
    category: 'Listing',
    source: 'pdf',
    expectedRule: 'R8',
    expectedAnswerOriginal: 'Doctors: Dr. Meera (Cardiology), Dr. Arun (Neurology).',
    expectedKeywordsOriginal: ['Dr. Meera', 'Dr. Arun'],
    expectedKeywordsExpanded: ['Dr. Meera', 'Dr. Arun', 'Dr. Priya', 'Dr. Vikram'],
    faultId: 'F5',
  },
  {
    id: 'Q17',
    number: 17,
    question: 'Which facilities are available in the hospital?',
    category: 'Listing',
    source: 'pdf',
    expectedRule: 'R8',
    expectedAnswerOriginal: 'Facilities: Cardiology - ECG; Neurology - Brain Scanning.',
    expectedKeywordsOriginal: ['ECG', 'Brain Scanning'],
    expectedKeywordsExpanded: ['ECG', 'Brain Scanning', 'Neonatal ICU', 'MRI Scanner'],
    faultId: 'F5',
  },
  {
    id: 'Q18',
    number: 18,
    question: 'What are the timing and facility of Neurology?',
    category: 'Multi-intent',
    source: 'pdf',
    expectedRule: 'R4, R5',
    expectedAnswerOriginal:
      'Neurology timing is 10 AM to 4 PM. Neurology provides Brain Scanning facility.',
    expectedKeywordsOriginal: ['10 AM to 4 PM', 'Brain Scanning'],
    expectedKeywordsExpanded: ['10 AM to 4 PM', 'Brain Scanning'],
    faultId: 'F5',
  },
  {
    id: 'Q19',
    number: 19,
    question: 'What time is the emergency service open?',
    category: 'Service',
    source: 'pdf',
    expectedRule: 'R7',
    expectedAnswerOriginal: 'Emergency service is Available 24 Hours.',
    expectedKeywordsOriginal: ['Emergency service', 'Available 24 Hours'],
    expectedKeywordsExpanded: ['Emergency service', 'Available 24 Hours'],
  },
  {
    id: 'Q20',
    number: 20,
    question: 'Is the pharmacy open at night?',
    category: 'Service',
    source: 'pdf',
    expectedRule: 'R7',
    expectedAnswerOriginal: 'Pharmacy is Available 24 Hours.',
    expectedKeywordsOriginal: ['Pharmacy', 'Available 24 Hours'],
    expectedKeywordsExpanded: ['Pharmacy', 'Available 24 Hours'],
  },
  {
    id: 'Q21',
    number: 21,
    question: 'Which doctor is available in Neurology?',
    category: 'Doctor lookup',
    source: 'pdf',
    expectedRule: 'R2',
    expectedAnswerOriginal: 'Dr. Arun works in Neurology department.',
    expectedKeywordsOriginal: ['Dr. Arun', 'Neurology'],
    expectedKeywordsExpanded: ['Dr. Arun', 'Neurology'],
  },
  {
    id: 'Q22',
    number: 22,
    question: 'Where is the dental department?',
    category: 'Unavailable',
    source: 'pdf',
    expectedRule: 'R9',
    expectedAnswerOriginal: 'Sorry, information is not available.',
    expectedKeywordsOriginal: ['Sorry, information is not available'],
    expectedKeywordsExpanded: ['Sorry, information is not available'],
  },
  {
    id: 'Q23',
    number: 23,
    question: 'Which doctor works in Dermatology?',
    category: 'Unavailable',
    source: 'pdf',
    expectedRule: 'R9',
    expectedAnswerOriginal: 'Sorry, information is not available.',
    expectedKeywordsOriginal: ['Sorry, information is not available'],
    expectedKeywordsExpanded: ['Dr. Kavita', 'Dermatology'],
  },
  {
    id: 'Q24',
    number: 24,
    question: 'Does the dental department have an MRI facility?',
    category: 'Unavailable',
    source: 'pdf',
    expectedRule: 'R9',
    expectedAnswerOriginal: 'Sorry, information is not available.',
    expectedKeywordsOriginal: ['Sorry, information is not available'],
    expectedKeywordsExpanded: ['Sorry, information is not available'],
  },
  {
    id: 'Q25',
    number: 25,
    question: 'Is there a radiology department?',
    category: 'Unavailable',
    source: 'pdf',
    expectedRule: 'R9',
    expectedAnswerOriginal: 'Sorry, information is not available.',
    expectedKeywordsOriginal: ['Sorry, information is not available'],
    expectedKeywordsExpanded: ['Dr. Rohan', 'Radiology'],
  },
  {
    id: 'Q26',
    number: 26,
    question: 'Does Neurology offer whole body scanning?',
    category: 'Unavailable',
    source: 'pdf',
    expectedRule: 'R9',
    expectedAnswerOriginal: 'Sorry, information is not available.',
    expectedKeywordsOriginal: ['Sorry, information is not available'],
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
];

export const EXPANDED_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id: 'Q27',
    number: 27,
    question: 'Who works in Pediatrics?',
    category: 'Doctor lookup',
    source: 'expanded',
    expectedRule: 'R2',
    expectedKeywordsExpanded: ['Dr. Priya', 'Pediatrics'],
  },
  {
    id: 'Q28',
    number: 28,
    question: 'What are the Orthopedics timings?',
    category: 'Timing',
    source: 'expanded',
    expectedRule: 'R4',
    expectedKeywordsExpanded: ['Orthopedics', '11 AM to 5 PM'],
  },
  {
    id: 'Q29',
    number: 29,
    question: 'What facility does Radiology provide?',
    category: 'Facility',
    source: 'expanded',
    expectedRule: 'R5',
    expectedKeywordsExpanded: ['Radiology', 'MRI Scanner'],
  },
  {
    id: 'Q30',
    number: 30,
    question: "What is Dr. Kavita's specialization?",
    category: 'Doctor details',
    source: 'expanded',
    expectedRule: 'R1',
    expectedKeywordsExpanded: ['Dr. Kavita', 'Skin Care'],
    faultId: 'F1',
  },
  {
    id: 'Q31',
    number: 31,
    question: 'Which doctor treats bone problems?',
    category: 'Doctor details',
    source: 'expanded',
    expectedRule: 'R3',
    expectedKeywordsExpanded: ['Dr. Vikram', 'Bone and Joint Care'],
    faultId: 'F1',
  },
  {
    id: 'Q32',
    number: 32,
    question: 'Which doctor treats skin problems?',
    category: 'Doctor details',
    source: 'expanded',
    expectedRule: 'R3',
    expectedKeywordsExpanded: ['Dr. Kavita', 'Skin Care'],
    faultId: 'F1',
  },
  {
    id: 'Q33',
    number: 33,
    question: 'Which department has MRI Scanner?',
    category: 'Reverse lookup',
    source: 'expanded',
    expectedRule: 'R6',
    expectedKeywordsExpanded: ['MRI Scanner', 'Radiology'],
    faultId: 'F2',
  },
  {
    id: 'Q34',
    number: 34,
    question: 'Is Digital X-Ray available in the hospital?',
    category: 'Reverse lookup',
    source: 'expanded',
    expectedRule: 'R6',
    expectedKeywordsExpanded: ['Digital X-Ray', 'Orthopedics'],
    faultId: 'F2',
  },
  {
    id: 'Q35',
    number: 35,
    question: 'Which department provides Neonatal ICU?',
    category: 'Reverse lookup',
    source: 'expanded',
    expectedRule: 'R6',
    expectedKeywordsExpanded: ['Neonatal ICU', 'Pediatrics'],
    faultId: 'F2',
  },
  {
    id: 'Q36',
    number: 36,
    question: 'Is the blood bank available?',
    category: 'Service',
    source: 'expanded',
    expectedRule: 'R7',
    expectedKeywordsExpanded: ['Blood bank', 'Available 24 Hours'],
  },
  {
    id: 'Q37',
    number: 37,
    question: 'What time is the diagnostic lab open?',
    category: 'Service',
    source: 'expanded',
    expectedRule: 'R7',
    expectedKeywordsExpanded: ['Diagnostic lab', 'Open 7 AM to 9 PM'],
  },
  {
    id: 'Q38',
    number: 38,
    question: "What facility is in Dr. Meera's department?",
    category: 'Chained',
    source: 'expanded',
    expectedRule: 'R5 + chain',
    expectedKeywordsExpanded: ['Cardiology', 'ECG'],
    faultId: 'F4',
  },
  {
    id: 'Q39',
    number: 39,
    question: "What equipment does Dr. Arun's department have?",
    category: 'Chained',
    source: 'expanded',
    expectedRule: 'R5 + chain',
    expectedKeywordsExpanded: ['Neurology', 'Brain Scanning'],
    faultId: 'F4',
  },
  {
    id: 'Q40',
    number: 40,
    question: "When is Dr. Priya's department open?",
    category: 'Chained',
    source: 'expanded',
    expectedRule: 'R4 + chain',
    expectedKeywordsExpanded: ['Pediatrics', '8 AM to 2 PM'],
    faultId: 'F4',
  },
  {
    id: 'Q41',
    number: 41,
    question: "What are the timings and facilities of Dr. Vikram's department?",
    category: 'Chained',
    source: 'expanded',
    expectedRule: 'R4 + chain, R5 + chain',
    expectedKeywordsExpanded: ['11 AM to 5 PM', 'Digital X-Ray'],
    faultId: 'F4',
  },
  {
    id: 'Q42',
    number: 42,
    question: 'What are the timing and facility of Cardiology?',
    category: 'Multi-intent',
    source: 'expanded',
    expectedRule: 'R4, R5',
    expectedKeywordsExpanded: ['9 AM to 1 PM', 'ECG'],
    faultId: 'F5',
  },
  {
    id: 'Q43',
    number: 43,
    question: 'List every doctor in the hospital.',
    category: 'Listing',
    source: 'expanded',
    expectedRule: 'R8',
    expectedKeywordsExpanded: ['Dr. Meera', 'Dr. Arun', 'Dr. Priya', 'Dr. Vikram', 'Dr. Kavita', 'Dr. Rohan'],
    faultId: 'F5',
  },
  {
    id: 'Q44',
    number: 44,
    question: 'Does Cardiology offer wholesale medicine?',
    category: 'Adversarial trap',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
  {
    id: 'Q45',
    number: 45,
    question: 'Whose equipment is in the dental department?',
    category: 'Adversarial trap',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
  {
    id: 'Q46',
    number: 46,
    question: 'Does Neurology have an openheart suite?',
    category: 'Adversarial trap',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
  {
    id: 'Q47',
    number: 47,
    question: 'Is there a doctorate program in Cardiology?',
    category: 'Adversarial trap',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
  {
    id: 'Q48',
    number: 48,
    question: 'Does Pediatrics offer whole body scanning?',
    category: 'Adversarial trap',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
    faultId: 'F6',
  },
  {
    id: 'Q49',
    number: 49,
    question: 'Which doctor works in Oncology?',
    category: 'Unavailable',
    source: 'expanded',
    expectedRule: 'R9',
    expectedKeywordsExpanded: ['Sorry, information is not available'],
  },
  {
    id: 'Q50',
    number: 50,
    question: 'Who works in Dermatology and what are its timings?',
    category: 'Multi-intent',
    source: 'expanded',
    expectedRule: 'R2, R4',
    expectedKeywordsExpanded: ['Dr. Kavita', '9 AM to 3 PM'],
    faultId: 'F5',
  },
  {
    id: 'Q51',
    number: 51,
    question: 'What facility does Radiology provide and when does it open?',
    category: 'Multi-intent',
    source: 'expanded',
    expectedRule: 'R4, R5',
    expectedKeywordsExpanded: ['MRI Scanner', '8 AM to 8 PM'],
    faultId: 'F5',
  },
  {
    id: 'Q52',
    number: 52,
    question: 'Is emergency service or pharmacy open right now?',
    category: 'Service',
    source: 'expanded',
    expectedRule: 'R7',
    expectedKeywordsExpanded: ['Emergency service', 'Pharmacy', 'Available 24 Hours'],
  },
  {
    id: 'Q53',
    number: 53,
    question: 'Which doctor treats child problems and what is the timing?',
    category: 'Multi-intent',
    source: 'expanded',
    expectedRule: 'R3, R4 + chain',
    expectedKeywordsExpanded: ['Dr. Priya', 'Child Care', '8 AM to 2 PM'],
    faultId: 'F4',
  },
  {
    id: 'Q54',
    number: 54,
    question: 'List all facilities available across the hospital.',
    category: 'Listing',
    source: 'expanded',
    expectedRule: 'R8',
    expectedKeywordsExpanded: ['Cardiology', 'ECG', 'Neonatal ICU', 'Digital X-Ray', 'Laser Therapy', 'MRI Scanner'],
    faultId: 'F5',
  },
];

export const ALL_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  ...PDF_BENCHMARK_QUESTIONS,
  ...EXPANDED_BENCHMARK_QUESTIONS,
];
