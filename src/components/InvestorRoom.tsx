'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from './SiteChrome';

type Doc = { id: string; title: string; category: string; version: string; description: string; pages: number; published: boolean; can_download?: boolean };
type Person = { user_id: string; email: string; role: string; organization: string; expires_at: string | null; stage: string; approved?: boolean };
type Question = { id: string; email: string; question: string; answer: string; created_at: string };
type State = { member: Person; admin: boolean; needsMfa: boolean; canRead: boolean; nda: { nda_text: string; nda_version: string }; documents: Doc[]; categories: string[]; questions: Question[] };
type Grant = { user_id: string; document_id: string; can_view: boolean; can_download: boolean };
type Event = { id: string; occurred_at: string; actor_email: string; action: string; document_id: string | null; copy_id: string | null; details: Record<string, unknown> };
type Share = { id: string; sender_email: string; recipient_email: string; document_id: string; status: string };
type Administration = { members: Person[]; grants: Grant[]; shares: Share[]; events: Event[]; offset: number };
type Run = (action: Record<string, unknown> | FormData) => Promise<Record<string, unknown>>;
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function InvestorRoom({ config }: { config: { enabled: boolean; url: string; key: string } }) {
  const [auth] = useState<SupabaseClient | null>(() => config.enabled ? createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null);
  const [signedIn, setSignedIn] = useState(false), [state, setState] = useState<State | null>(null), [admin, setAdmin] = useState<Administration | null>(null);
  const [tab, setTab] = useState('documents'), [category, setCategory] = useState('All documents'), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null), [shareDoc, setShareDoc] = useState<Doc | null>(null);
  const [invitation, setInvitation] = useState(''); const generation = useRef(0); const previewUrl = useRef('');
  const closePreview = useCallback(() => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); previewUrl.current = ''; setPreview(null); }, []);
  const clearPrivate = useCallback(() => { generation.current++; setState(null); setAdmin(null); setInvitation(''); setShareDoc(null); closePreview(); }, [closePreview]);
  const request = useCallback(async (url: string, options?: RequestInit) => {
    const { data } = await auth!.auth.getSession();
    if (!data.session) throw Error('Sign in to the investor room.');
    const response = await fetch(url, { ...options, cache: 'no-store', headers: { ...options?.headers, Authorization: `Bearer ${data.session.access_token}` } });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) clearPrivate();
      const result = await response.json().catch(() => ({})); throw Error(result.error || 'The request failed. Try again.');
    }
    return response;
  }, [auth, clearPrivate]);
  const refresh = useCallback(async (withAdmin = false, offset = 0) => {
    const current = generation.current;
    const result = await (await request('/api/investors')).json() as State;
    if (generation.current !== current) return;
    setState(result);
    if (withAdmin && result.admin) {
      const management = await (await request(`/api/investors?admin=1&offset=${offset}`)).json();
      if (generation.current === current) setAdmin(management);
    }
  }, [request]);
  useEffect(() => {
    if (!auth) return;
    const fragment = new URLSearchParams(location.hash.slice(1));
    const inviteToken = fragment.get('token_hash'), type = fragment.get('type');
    if (inviteToken && type === 'invite') {
      history.replaceState(null, '', location.pathname);
      auth.auth.verifyOtp({ token_hash: inviteToken, type: 'invite' }).then(({ error }) => { if (error) setError('The invitation has expired or was already used. Contact the administrator for help.'); });
    }
    const { data } = auth.auth.onAuthStateChange((_event, session) => { setSignedIn(!!session); if (!session) clearPrivate(); });
    return () => { data.subscription.unsubscribe(); closePreview(); };
  }, [auth, clearPrivate, closePreview]);
  useEffect(() => {
    if (!signedIn) return;
    refresh().catch(e => setError(e.message));
    const check = () => { if (document.visibilityState === 'visible') refresh().catch(e => setError(e.message)); };
    const timer = setInterval(check, 15000); window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  }, [signedIn, refresh]);
  const run: Run = async action => {
    setBusy(true); setError(''); setMessage(''); setInvitation('');
    try {
      const current = generation.current;
      const response = await request('/api/investors', action instanceof FormData ? { method: 'POST', body: action } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const result = await response.json();
      if (generation.current !== current) return {};
      await refresh(!!state?.admin, admin?.offset || 0);
      if (result.invitation) setInvitation(String(result.invitation));
      setMessage('Saved.'); return result;
    } catch (e) { const message = e instanceof Error ? e.message : 'The operation failed.'; setError(message); throw e; }
    finally { setBusy(false); }
  };
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); const form = event.currentTarget;
    try { await run({ action, ...Object.fromEntries(new FormData(form)) }); form.reset(); if (action === 'share') setShareDoc(null); } catch {}
  }
  async function openDocument(doc: Doc, download: boolean) {
    setBusy(true); setError(''); const current = generation.current;
    try {
      const response = await request(`/api/investors/document/${doc.id}${download ? '?download=1' : ''}`);
      const blob = await response.blob();
      if (generation.current !== current) return;
      const url = URL.createObjectURL(blob);
      if (download) { const link = document.createElement('a'); link.href = url; link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'Astra-via investor copy.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
      else { closePreview(); previewUrl.current = url; setPreview({ url, title: doc.title }); }
    } catch (e) { setError(e instanceof Error ? e.message : 'This document could not be opened.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!preview && !shareDoc) return;
    const previous = document.activeElement as HTMLElement | null;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closePreview(); setShareDoc(null); }
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('.ir-modal');
      const controls = dialog?.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],iframe');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [preview, shareDoc, closePreview]);
  async function signOut() { clearPrivate(); setError(''); setMessage(''); await auth!.auth.signOut({ scope: 'local' }); }
  return <div className="investor-page">
    <a className="skip" href="#investor-main">Skip to investor room</a><SiteHeader active="investors" />
    <main id="investor-main">
      <div className="ir-heading"><div><p className="eyebrow">ASTRA-VIA / PRIVATE ACCESS</p><h1>Investor Room<span>.</span></h1><p className="ir-lead">A closer look at what we’re building.</p></div><div className="ir-access-badge"><span aria-hidden="true">◈</span> Individual access · Personalized copies</div></div>
      {error && <div className="ir-notice ir-error" role="alert">{error}</div>}{message && <div className="ir-notice" role="status">{message}</div>}
      {!config.enabled ? <section className="ir-panel"><h2>Private access is being prepared</h2><p>Contact <a href="mailto:support@astra-via.com">support@astra-via.com</a> for investor access.</p></section> : !signedIn ? <div className="ir-login-grid">
        <section className="ir-introduction"><p className="eyebrow">BY INVITATION</p><h2>The information behind<br />the conversation.</h2><p>Company materials, financial information, product updates, and a direct channel for your questions.</p><ol><li><span>01</span> Sign in with your invited email.</li><li><span>02</span> Read and accept the confidentiality agreement.</li><li><span>03</span> Explore the documents approved for you.</li></ol><p className="ir-small">Access is personal. Each PDF copy includes your verified email, date, and a unique copy ID.</p></section>
        <Login auth={auth!} onError={setError} />
      </div> : <>
        <div className="ir-account"><span>{state?.member.email || 'Signed in'}{state?.member.organization && ` · ${state.member.organization}`}</span><button onClick={signOut}>Sign out</button></div>
        {(!state || !state.canRead) && <section className="ir-panel"><SetPassword auth={auth!} /></section>}
        {!state ? <section className="ir-panel"><h2>Checking your access</h2><p>Access requires an active invitation and approval. If you need help, contact support@astra-via.com.</p></section> : <>
          {state.needsMfa && <Mfa auth={auth!} onComplete={() => refresh().catch(e => setError(e.message))} />}
          {!state.canRead && <section className="ir-panel ir-agreement"><p className="eyebrow">BEFORE YOU ENTER</p><h2>Confidentiality agreement</h2>{state.nda.nda_text ? <><div className="ir-nda-text">{state.nda.nda_text}</div><p className="ir-small">Version {state.nda.nda_version}</p><form onSubmit={event => { event.preventDefault(); void run({ action: 'accept-nda', version: state.nda.nda_version }).catch(() => {}); }}><label className="ir-check"><input type="checkbox" required /> I have read and accept this confidentiality agreement.</label><button className="ir-primary" disabled={busy}>Accept and enter</button></form></> : <p>The administrator is preparing the confidentiality agreement. Documents will be available after it is published and accepted.</p>}</section>}
          {state.canRead && <>
            <nav className="ir-tabs" aria-label="Investor room sections">{[['documents', 'Documents'], ['questions', 'Private Q&A'], ['account', 'Account & privacy'], ...(state.admin ? [['admin', 'Manage room']] : [])].map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); if (key === 'admin') refresh(true).catch(e => setError(e.message)); }}>{label}</button>)}</nav>
            {tab === 'documents' && <><div className="ir-library-heading"><div><h2>Document library</h2><p>Materials released to your account. All previews and downloads are personalized.</p></div><label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{['All documents', ...state.categories].map(c => <option key={c}>{c}</option>)}</select></label></div><div className="ir-documents">{state.documents.filter(d => category === 'All documents' || d.category === category).map(doc => <article className="ir-document" key={doc.id}><div className="ir-doc-top"><span className="ir-pdf">PDF</span><span>{doc.category}</span>{state.admin && <small>{doc.published ? 'Published' : 'Draft'}</small>}</div><h3>{doc.title}</h3><p>{doc.description}</p><div className="ir-document-version">Version {doc.version} · {doc.pages} pages</div><div className="ir-doc-actions"><button className="ir-primary" disabled={busy} onClick={() => void openDocument(doc, false)}>Open document ↗</button>{(doc.can_download || state.admin) && <button disabled={busy} onClick={() => void openDocument(doc, true)}>Download PDF</button>}<button disabled={busy} onClick={() => setShareDoc(doc)}>Request colleague access</button></div></article>)}</div>{!state.documents.length && <section className="ir-panel"><h3>Your library is ready for materials</h3><p>{state.admin ? 'Open Manage room to upload PDFs and grant investor access.' : 'No documents have been released to your account yet.'}</p></section>}</>}
            {tab === 'questions' && <section className="ir-panel"><h2>A direct conversation</h2><p>Your questions and replies are visible to you and investor room administrators.</p><form onSubmit={e => void submit(e, 'question')}><label>Your question<textarea name="question" required maxLength={4000} rows={4} /></label><button className="ir-primary" disabled={busy}>Send question</button></form><Questions questions={state.questions} /></section>}
            {tab === 'account' && <section className="ir-panel"><h2>Your access & privacy</h2><p>Signed in as <strong>{state.member.email}</strong>. {state.member.expires_at ? `Access expires ${date(state.member.expires_at)}.` : 'Access remains subject to administrator approval.'}</p><p>We record account identity, access requests, document delivery, copy IDs, confidentiality acceptance, questions, sharing requests, and permission changes to manage investor relations and protect confidential materials. Investor room administrators can inspect these records.</p><p>Documents are stored privately on Google Cloud. Supabase handles accounts, permissions and investor records. Your email and the delivery timestamp appear in your personalized document copies. A delivery event means the server issued a copy; it does not prove that a person read or saved it.</p><p>Colleague access requests require approval and a separate account. External forwarding, screenshots and copies outside this portal cannot be reliably tracked or prevented. Revoking portal access does not recall downloaded files.</p><p>Investor records are retained while needed for investor relations, security and applicable business obligations. Contact <a href="mailto:support@astra-via.com">support@astra-via.com</a> to ask about access or retention. <Link href="/privacy">Public website privacy notice</Link>.</p><SetPassword auth={auth!} /></section>}
            {tab === 'admin' && state.admin && (admin ? <Admin state={state} management={admin} run={run} busy={busy} refresh={offset => refresh(true, offset).catch(e => setError(e.message))} /> : <p>Loading management controls…</p>)}
          </>}
        </>}
      </>}
      <p className="ir-confidential">Confidential materials · Access is granted individually · <a href="mailto:support@astra-via.com">Request access</a></p>
      {invitation && <section className="ir-panel"><h3>Invitation created</h3><p>No email has been sent. Copy this one-time link and share it privately with the investor. It expires under the Supabase invitation settings.</p><label>Private invitation link<input readOnly value={invitation} onFocus={e => e.target.select()} /></label><button onClick={() => setInvitation('')}>Hide link</button></section>}
    </main><SiteFooter />
    {preview && <div className="ir-modal" role="dialog" aria-modal="true" aria-labelledby="ir-preview-title"><div className="ir-modal-header"><h2 id="ir-preview-title">{preview.title}</h2><button autoFocus onClick={closePreview}>Close preview ✕</button></div><p className="ir-small">Personalized copy. Preview access cannot prevent screenshots or copying.</p><iframe title={`Personalized PDF: ${preview.title}`} src={`${preview.url}#toolbar=0`} /></div>}
    {shareDoc && <div className="ir-modal ir-share-modal" role="dialog" aria-modal="true" aria-labelledby="ir-share-title"><div className="ir-modal-header"><h2 id="ir-share-title">Request colleague access</h2><button autoFocus onClick={() => setShareDoc(null)}>Close ✕</button></div><p>{shareDoc.title}</p><p>The administrator reviews each request. Your colleague will need a verified account and their own approval.</p><form onSubmit={e => void submit(e, 'share')}><input type="hidden" name="document_id" value={shareDoc.id} /><label>Colleague’s email<input type="email" name="email" required maxLength={254} /></label><button className="ir-primary" disabled={busy}>Submit access request</button></form></div>}
  </div>;
}

function Login({ auth, onError }: { auth: SupabaseClient; onError: (text: string) => void }) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); onError(''); const form = new FormData(e.currentTarget);
    const { error } = await auth.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) });
    if (error) onError('Sign-in failed. Check your credentials and invitation.'); setBusy(false);
  }
  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const form = new FormData(e.currentTarget);
    const { error } = await auth.auth.resetPasswordForEmail(String(form.get('email')), { redirectTo: location.origin + '/investors' });
    if (error) onError('The reset request could not be completed. Try again later.'); else setSent(true); setBusy(false);
  }
  return <section className="ir-panel ir-login"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your room</h2><p>Use your individual invited account.</p><form onSubmit={login}><label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="ir-primary" disabled={busy}>{busy ? 'Please wait…' : 'Sign in →'}</button></form><details><summary>Forgot your password?</summary><form onSubmit={reset}><label>Account email<input name="email" type="email" autoComplete="email" required /></label><button disabled={busy}>Request password reset</button></form>{sent && <p role="status">If an eligible account exists, password reset instructions will be sent.</p>}</details><p className="ir-small">New investor? Use your invitation link to verify your email, then set a password in Account & privacy.</p></section>;
}
function SetPassword({ auth }: { auth: SupabaseClient }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  return <details><summary>Set or change your password</summary><form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); if (data.get('password') !== data.get('confirm')) { setMessage('The passwords do not match.'); return; } setBusy(true); const { error } = await auth.auth.updateUser({ password: String(data.get('password')) }); setMessage(error ? 'The password could not be updated. Try a stronger password or sign in again.' : 'Password updated.'); setBusy(false); if (!error) form.reset(); }}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} required /></label><button disabled={busy}>Save password</button><p role="status">{message}</p></form></details>;
}
function Mfa({ auth, onComplete }: { auth: SupabaseClient; onComplete: () => void }) {
  const [factor, setFactor] = useState(''), [qr, setQr] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { auth.auth.mfa.listFactors().then(({ data }) => { if (data?.totp[0]) setFactor(data.totp[0].id); }); }, [auth]);
  return <section className="ir-panel"><p className="eyebrow">ADMINISTRATOR VERIFICATION</p><h2>Protect your room with an authenticator</h2><p>Administrator actions require a current two-factor verification.</p>{!factor && <button onClick={async () => { setBusy(true); const { data, error } = await auth.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Astra Investor Room' }); if (error) setMessage(error.message); else { setFactor(data.id); setQr(data.totp.qr_code); } setBusy(false); }} disabled={busy}>Set up authenticator</button>}{qr && <><p>Scan this code with your authenticator app, then enter its six-digit code.</p><img className="ir-qr" src={qr} alt="Personal authenticator enrollment QR code" /></>}{factor && <form onSubmit={async e => { e.preventDefault(); setBusy(true); const code = String(new FormData(e.currentTarget).get('code')); const { error } = await auth.auth.mfa.challengeAndVerify({ factorId: factor, code }); if (error) setMessage('The code could not be verified. Try the current code.'); else onComplete(); setBusy(false); }}><label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className="ir-primary" disabled={busy}>Verify</button></form>}<p role="status">{message}</p><SetPassword auth={auth} /></section>;
}
function Questions({ questions, run, busy }: { questions: Question[]; run?: Run; busy?: boolean }) {
  return <div className="ir-questions">{questions.map(q => <article key={q.id}><p className="ir-small">{run && `${q.email} · `}{date(q.created_at)}</p><h3>{q.question}</h3><p className="ir-answer">{q.answer || 'Awaiting a reply.'}</p>{run && <form onSubmit={e => { e.preventDefault(); void run({ action: 'answer', id: q.id, answer: new FormData(e.currentTarget).get('answer') }).catch(() => {}); }}><label>Private reply<textarea name="answer" defaultValue={q.answer} maxLength={8000} rows={3} required /></label><button disabled={busy}>Save reply</button></form>}</article>)}</div>;
}
function Admin({ state, management, run, busy, refresh }: { state: State; management: Administration; run: Run; busy: boolean; refresh: (offset: number) => void }) {
  const [section, setSection] = useState('Documents');
  return <div className="ir-admin"><nav className="ir-subtabs" aria-label="Management sections">{['Documents', 'Investors', 'Permissions', 'Confidentiality', 'Questions', 'Sharing', 'Audit'].map(s => <button key={s} aria-current={section === s ? 'page' : undefined} onClick={() => setSection(s)}>{s}</button>)}</nav>
    {section === 'Documents' && <><section className="ir-panel"><h2>Upload a document</h2><p>PDF only · up to 25 MB · 200 pages. Uploads start as drafts. Use a new upload for each version so prior copies remain traceable.</p><form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; try { await run(new FormData(form)); form.reset(); } catch {} }}><div className="ir-form-grid"><label>Document title<input name="title" maxLength={200} required /></label><label>Version<input name="version" placeholder="e.g. 2026.10" maxLength={40} required /></label><label>Category<select name="category">{state.categories.map(c => <option key={c}>{c}</option>)}</select></label><label>PDF file<input name="file" type="file" accept="application/pdf,.pdf" required /></label></div><label>Description<textarea name="description" maxLength={2000} rows={2} /></label><button className="ir-primary" disabled={busy}>Upload private PDF</button></form></section><section className="ir-panel"><h2>Publication</h2><p>Publication makes a document available only to investors who also have a grant.</p>{state.documents.map(d => <div key={d.id} className="ir-list-row"><span>{d.title} · {d.version}</span><button disabled={busy} onClick={() => void run({ action: 'publish', document_id: d.id, published: !d.published }).catch(() => {})}>{d.published ? 'Withdraw document' : 'Publish document'}</button></div>)}</section></>}
    {section === 'Investors' && <><section className="ir-panel"><h2>Add an investor</h2><p>Existing Astra accounts retain their other permissions. New accounts receive only Investor Room approval. Creating an invitation generates a private link; no email is sent.</p><MemberForm busy={busy} run={run} /></section>{management.members.map(person => <details key={person.user_id} className="ir-panel"><summary>{person.email} · {person.role} · {person.approved ? 'Allowed' : 'Blocked'}</summary><MemberForm key={JSON.stringify(person)} person={person} run={run} busy={busy} /></details>)}</>}
    {section === 'Permissions' && <section className="ir-panel"><h2>Document permissions</h2><p>Grant each investor access to individual documents. Download approval is separate from preview access.</p>{management.members.filter(m => m.role !== 'admin').map(m => <details key={m.user_id}><summary>{m.email}</summary>{state.documents.map(d => { const grant = management.grants.find(g => g.user_id === m.user_id && g.document_id === d.id); return <div key={d.id} className="ir-list-row"><span>{d.title} · {d.version}</span><label className="ir-check"><input type="checkbox" checked={grant?.can_view || false} disabled={busy} onChange={e => void run({ action: 'grant', user_id: m.user_id, document_id: d.id, can_view: e.target.checked, can_download: e.target.checked && grant?.can_download }).catch(() => {})} /> Preview</label><label className="ir-check"><input type="checkbox" checked={grant?.can_download || false} disabled={busy || !grant?.can_view} onChange={e => void run({ action: 'grant', user_id: m.user_id, document_id: d.id, can_view: true, can_download: e.target.checked }).catch(() => {})} /> Download</label></div>; })}</details>)}</section>}
    {section === 'Confidentiality' && <section className="ir-panel"><h2>Publish your approved confidentiality agreement</h2><p>Paste the agreement approved for your investor process. Every publication creates a new version and requires investors to accept it before further document access. This records acceptance; it does not provide an electronic signature service.</p><form onSubmit={e => { e.preventDefault(); void run({ action: 'save-nda', text: new FormData(e.currentTarget).get('text') }).catch(() => {}); }}><label>Agreement text<textarea name="text" defaultValue={state.nda.nda_text} rows={14} maxLength={30000} required /></label><button className="ir-primary" disabled={busy}>Publish new agreement version</button></form></section>}
    {section === 'Questions' && <section className="ir-panel"><h2>Investor questions</h2><Questions questions={state.questions} run={run} busy={busy} /></section>}
    {section === 'Sharing' && <section className="ir-panel"><h2>Colleague access requests</h2><p>Add a recipient as an investor before approving their request. Approval grants document preview access. Their own sign-in, NDA and approval remain required.</p>{management.shares.map(s => <article key={s.id} className="ir-share-request"><p>{s.sender_email} → {s.recipient_email}</p><p>{state.documents.find(d => d.id === s.document_id)?.title || s.document_id} · {s.status}</p>{s.status === 'pending' && <div className="ir-doc-actions"><button disabled={busy} onClick={() => void run({ action: 'resolve-share', id: s.id, status: 'approved' }).catch(() => {})}>Approve preview access</button><button disabled={busy} onClick={() => void run({ action: 'resolve-share', id: s.id, status: 'declined' }).catch(() => {})}>Decline</button></div>}</article>)}{!management.shares.length && <p>No sharing requests yet.</p>}</section>}
    {section === 'Audit' && <section className="ir-panel"><h2>Access & activity audit</h2><p>Server-recorded requests and deliveries. Delivery does not prove reading, saving, or subsequent forwarding outside this portal. Events are append-only for application accounts.</p><div className="ir-audit-scroll"><table><thead><tr><th>Time</th><th>Account</th><th>Action</th><th>Details</th></tr></thead><tbody>{management.events.map(e => <tr key={e.id}><td>{date(e.occurred_at)}</td><td>{e.actor_email}</td><td>{e.action.replaceAll('_', ' ')}</td><td><details><summary>{e.copy_id ? `Copy ${e.copy_id.slice(0, 8)}` : 'Inspect'}</summary><pre>{JSON.stringify({ document_id: e.document_id, copy_id: e.copy_id, ...e.details }, null, 2)}</pre></details></td></tr>)}</tbody></table></div><div className="ir-doc-actions"><button disabled={busy || management.offset === 0} onClick={() => refresh(Math.max(0, management.offset - 100))}>Newer events</button><span>Events {management.offset + 1}–{management.offset + management.events.length}</span><button disabled={busy || management.events.length < 100} onClick={() => refresh(management.offset + 100)}>Older events</button></div></section>}
  </div>;
}
function MemberForm({ person, run, busy }: { person?: Person; run: Run; busy: boolean }) {
  return <form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); try { await run({ action: 'member', ...Object.fromEntries(data), approved: data.get('approved') === 'on', expires_at: data.get('expires_at') ? new Date(String(data.get('expires_at'))).toISOString() : null }); if (!person) form.reset(); } catch {} }}><div className="ir-form-grid"><label>Email<input type="email" name="email" defaultValue={person?.email} readOnly={!!person} required maxLength={254} /></label><label>Organization<input name="organization" defaultValue={person?.organization} maxLength={200} /></label><label>Role<select name="role" defaultValue={person?.role || 'investor'}><option value="investor">Investor</option><option value="admin">Investor administrator (MFA required)</option></select></label><label>Access expiry (your local time)<input type="datetime-local" name="expires_at" defaultValue={person?.expires_at ? new Date(new Date(person.expires_at).getTime() - new Date(person.expires_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} /></label><label>Investor stage<select name="stage" defaultValue={person?.stage || 'invited'}>{['invited', 'reviewing', 'follow-up', 'committed', 'closed'].map(s => <option key={s}>{s}</option>)}</select></label><label className="ir-check"><input type="checkbox" name="approved" defaultChecked={person ? person.approved : true} /> Allow Investor Room access</label></div><button disabled={busy} className="ir-primary">{person ? 'Save investor' : 'Add investor'}</button></form>;
}
