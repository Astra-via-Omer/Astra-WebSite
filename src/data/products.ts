export type Product = {
  id: string;
  name: string;
  category: string;
  stage: string;
  headline: string;
  description: string;
  features: string[];
  href: string;
  action: string;
  note: string;
};

export const products: Product[] = [
  {
    id: 'workspace',
    name: 'Astra Workspace',
    category: 'Document review',
    stage: 'Early preview',
    headline: 'Build a case you can follow.',
    description: 'Bring PDFs, spreadsheets and public web sources into one evidence workspace. Compare claims with selected sources, explore the reasoning and evidence gaps, and export a report you can discuss and review.',
    features: ['Source library', 'Claim & evidence review', 'Reports & evidence trails'],
    href: 'https://workspace.astra-via.com/',
    action: 'Open Workspace',
    note: 'Sign in to run analyses and save connected work. Assessments support human review.'
  },
  {
    id: 'enigma',
    name: 'Enigma',
    category: 'News intelligence',
    stage: 'Capability demo',
    headline: 'Follow the story. Examine the support.',
    description: 'Watch selected live broadcasts, follow published news and assess claims against available source material. Keep the original sources, assessment history and your own analyst decisions together in a news intelligence desk.',
    features: ['Live broadcast monitoring', 'Published-news analysis', 'Analyst review history'],
    href: 'https://enigma.astra-via.com/',
    action: 'Open Enigma',
    note: 'Published-news text is analysed. Live television speech transcription is planned.'
  },
  {
    id: 'evidence-validation',
    name: 'Evidence Validation',
    category: 'Independent review',
    stage: 'Pilot',
    headline: 'Bring more perspectives to the evidence.',
    description: 'Create evidence-review tasks, collect independent assessments and export a bundle with a clear record of the reviews. Use the workspace directly or connect the review process to your own applications through its integrations.',
    features: ['Review tasks', 'Independent assessments', 'Evidence bundle exports'],
    href: 'https://evidence-validation.astra-via.com/',
    action: 'Open Evidence Validation',
    note: 'An unpaid pilot. Payments and Web3 publication remain planned capabilities.'
  },
  {
    id: 'lab',
    name: 'Astra Lab',
    category: 'Research & methods',
    stage: 'Design preview',
    headline: 'Ask better questions about grounding.',
    description: 'Explore graph-based approaches to evidence and reasoning, inspect sample research threads and sketch new methods. A research space for scientists and philosophers to examine how an assessment is built and what could make it stronger.',
    features: ['Research threads', 'Graph-based grounding', 'Method exploration'],
    href: 'https://lab.astra-via.com/',
    action: 'Enter the Lab',
    note: 'For invited researchers. Compute execution and engine handoff are planned.'
  },
  {
    id: 'colossus',
    name: 'Colossus',
    category: 'AI engines & evaluation',
    stage: 'Engine preview',
    headline: 'Give an assessment a repeatable engine.',
    description: 'Run versioned review engines, inspect structured claims and source quotations, and test how an engine performs against evaluation cases. Colossus also gives connected applications a shared way to request AI assessments.',
    features: ['Versioned engines', 'Evidence review', 'Evaluation cases'],
    href: 'https://colossus.astra-via.com/',
    action: 'Open Colossus',
    note: 'An active Astra account is required. Engine creation and evaluation are available to administrators.'
  }
];
