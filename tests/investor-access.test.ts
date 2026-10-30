import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDocument, assertMembership, assertTab, memberTabs, tabAccessField, type Member, type RoomDocument } from '../src/investors/policy';
const member: Member = { user_id: 'synthetic', email: 'person@example.invalid', role: 'investor', tab_access: ['overview', 'documents', 'updates'], expires_at: null, nda_version: 'v1', stage: 'reviewing', organization: '' };
const doc = { published: true, category: 'Company overview' } as RoomDocument;
test('power user includes all content sections but never management, drafts or automatic downloads', () => {
 const power: Member = { ...member, role: 'power_user', tab_access: [] };
 assert.deepEqual(memberTabs(power), ['overview','documents','updates','questions','account']);
 assert.throws(() => assertTab(power,'admin'), /not approved/);
 assert.doesNotThrow(() => assertDocument(power,doc,null,false));
 assert.throws(() => assertDocument(power,{...doc,published:false},null,false));
 assert.throws(() => assertDocument(power,doc,null,true));
 assert.doesNotThrow(() => assertDocument(power,doc,{can_view:true,can_download:true},true));
});
test('an investor needs both an approved section and individual document permission', () => {
 const granted={can_view:true,can_download:true};
 assert.doesNotThrow(()=>assertDocument(member,doc,granted,false));
 assert.throws(()=>assertDocument({...member,tab_access:['overview']},doc,granted,false));
 assert.throws(()=>assertDocument(member,doc,null,false));
 const updatesOnly={...member,tab_access:['updates']};
 assert.throws(()=>assertDocument(updatesOnly,doc,granted,false));
 assert.doesNotThrow(()=>assertDocument(updatesOnly,{...doc,category:'Investor updates'},granted,false));
 assert.deepEqual(memberTabs({...member,tab_access:[]}),['account']);
 assert.throws(()=>assertTab(member,'questions'), /not approved/);
});
test('unknown roles and forged management tab approvals never grant access', () => {
 assert.throws(()=>assertMembership({email_confirmed_at:'2026-01-01'},true,{...member,role:'invented' as Member['role']}));
 for(const value of [['admin'],['account'],['documents','documents'],null,'all']) assert.throws(()=>tabAccessField(value));
 assert.deepEqual(tabAccessField(['updates','overview']),['overview','updates']);
 assert.deepEqual(memberTabs({...member,tab_access:['admin']}),['account']);
});
