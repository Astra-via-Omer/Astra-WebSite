import { test } from 'node:test';
import assert from 'node:assert/strict';
import { investorDisplayName, investorInitials } from '../src/investors/presentation';
import { assertMembership } from '../src/investors/policy';

test('personal welcomes prefer the investor name and retain international names', () => {
  assert.equal(investorDisplayName('person@example.invalid', { full_name: 'Alex Morgan', astra_investor_name: 'Alex' }), 'Alex');
  assert.equal(investorDisplayName('person@example.invalid', { full_name: 'עומר אביעד' }), 'עומר אביעד');
  assert.equal(investorDisplayName('alex.morgan@example.invalid'), 'Alex Morgan');
  assert.equal(investorDisplayName('person@example.invalid', { astra_investor_name: {}, full_name: '   ', name: 'Morgan' }), 'Morgan');
});

test('presentation names are bounded and have normalized whitespace', () => {
  assert.equal(investorDisplayName('person@example.invalid', { astra_investor_name: '  Alex\n\t Morgan\u0000 ' }), 'Alex Morgan');
  assert.equal(investorDisplayName('person@example.invalid', { full_name: 'A'.repeat(1000) }).length, 80);
  assert.equal(investorInitials('  Alex  Morgan '), 'AM');
});

test('a presentation name or user metadata cannot approve investor access', () => {
  const user = { email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: { astra_investor_name: 'Administrator', role: 'admin', investor_room: true } };
  assert.throws(() => assertMembership(user, false, null));
});
