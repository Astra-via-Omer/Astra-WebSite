import { readFileSync } from 'node:fs';
import { investorProgress } from '../src/investors/dispatch';
if (!process.argv[2]) throw Error('Pass the path of a private dispatch JSON file.');
const content = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = investorProgress(content, true)!;
console.log(`Investor dispatch validated: ${result.entries.length} milestones, ${result.metrics.length} metric definitions.`);
