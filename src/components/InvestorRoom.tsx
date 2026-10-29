'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from './SiteChrome';
import InvestorPublicationList from './InvestorPublicationList';
import { AstraMethod, InvestorDispatch, InvestorIdentity, InvestorOverview, LoginIntroduction, RoomWelcome, type InvestorDocument, type InvestorPerson } from './InvestorExperience';

type Doc = InvestorDocument;
type Person = InvestorPerson;
type Question = { id: string; email: string; question: string; answer: string; created_at: string };
type State = { member: Person; admin: boolean; canRead: boolean; nda: { nda_text: string; nda_version: string }; documents: Doc[]; categories: string[]; questions: Question[] };
type Grant = { user_id: string; document_id: string; can_view: boolean; can_download: boolean };
type Event = { id: string; occurred_at: string; actor_email: string; action: string; document_id: string | null; copy_id: string | null; details: Record<string, unknown> };
type Share = { id: string; sender_email: string; recipient_email: string; document_id: string; status: string };
type Administration = { members: Person[]; grants: Grant[]; shares: Share[]; events: Event[]; offset: number };
type Run = (action: Record<string, unknown> | FormData) => Promise<Record<string, unknown>>;
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function InvestorRoom({ config }: { config: { enabled: boolean; url: string; key: string; passwordReset: boolean } }) {
  const [auth] = useState<SupabaseClient | null>(() => config.enabled ? createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null);
  const [signedIn, setSignedIn] = useState(false), [state, setState] = useState<State | null>(null), [admin, setAdmin] = useState<Administration | null>(null);
  const [tab, setTab] = useState('overview'), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null), [shareDoc, setShareDoc] = useState<Doc | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [invitation, setInvitation] = useState(''); const generation = useRef(0); const previewUrl = useRef('');
  const closePreview = useCallback(() => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); previewUrl.current = ''; setPreview(null); }, []);
  const clearPrivate = useCallback(() => { generation.current++; setState(null); setAdmin(null); setInvitation(''); setShareDoc(null); setTab('overview'); closePreview(); }, [closePreview]);
  const request = useCallback(async (url: string, options?: RequestInit) => {
    const { data } = await auth!.auth.getSession();
    if (!data.session) throw Error('Sign in to the investor room.');
    const fetchWith = (token: string) => fetch(url, { ...options, cache: 'no-store', headers: { ...options?.headers, Authorization: `Bearer ${token}` } });
    let response = await fetchWith(data.session.access_token);
    if (response.status === 401) {
      const refreshed = await auth!.auth.refreshSession();
      if (refreshed.data.session && !refreshed.error) response = await fetchWith(refreshed.data.session.access_token);
      if (response.status === 401) await auth!.auth.signOut({ scope: 'local' });
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) clearPrivate();
      const result = await response.json().catch(() => ({})); throw Error(result.error || 'The request failed. Try again.');
    }
    return response;
  }, [auth, clearPrivate]);
  const loadPublicationPreview = useCallback(async (doc: Doc, signal: AbortSignal) => {
    const current = generation.current;
    const response = await request(`/api/investors/document/${doc.id}`, { signal });
    const blob = await response.blob();
    if (signal.aborted || generation.current !== current) throw new DOMException('Preview cancelled.', 'AbortError');
    return blob;
  }, [request]);
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
    const token = fragment.get('token_hash'), type = fragment.get('type');
    if (token && (type === 'invite' || type === 'recovery')) {
      history.replaceState(null, '', location.pathname);
      setRecovering(type === 'recovery');
      auth.auth.verifyOtp({ token_hash: token, type }).then(({ error }) => { if (error) { setRecovering(false); setError('This account link has expired or was already used. Request a new link or contact the administrator.'); } });
    }
    const { data } = auth.auth.onAuthStateChange((event, session) => { setSignedIn(!!session); if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { window.scrollTo({ top: 0, behavior: 'instant' }); if (location.hash === '#ir-enter') history.replaceState(null, '', location.pathname + location.search); } if (event === 'PASSWORD_RECOVERY') setRecovering(true); if (!session) { setRecovering(false); clearPrivate(); } });
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
    <main id="investor-main" tabIndex={-1}>
      <RoomWelcome member={state?.member} signedIn={signedIn} />
      {error && <div className="ir-notice ir-error" role="alert">{error}</div>}{message && <div className="ir-notice" role="status">{message}</div>}
      {!config.enabled ? <section className="ir-panel"><h2>Private access is being prepared</h2><p>Contact <a href="mailto:support@astra-via.com">support@astra-via.com</a> for investor access.</p></section> : !signedIn ? <div className="ir-login-grid">
        <LoginIntroduction />
        <Login auth={auth!} onError={setError} passwordReset={config.passwordReset} />
      </div> : <>
        <InvestorIdentity member={state?.member} onAccount={state?.canRead ? () => setTab('account') : undefined} onSignOut={signOut} />
        {recovering && <section className="ir-panel"><h2>Choose a new password</h2><p>Your investor permissions remain subject to approval.</p><SetPassword auth={auth!} initiallyOpen onSaved={() => { setRecovering(false); setMessage('Password updated.'); }} /></section>}
        {!recovering && state && !state.canRead && <section className="ir-panel"><SetPassword auth={auth!} /></section>}
        {!state ? <section className="ir-panel"><h2>Checking your access</h2><p>Access requires an active invitation and approval. If you need help, contact support@astra-via.com.</p></section> : <>
          {!recovering && !state.canRead && <section className="ir-panel ir-agreement"><p className="eyebrow">BEFORE YOU ENTER</p><h2>Confidentiality agreement</h2>{state.nda.nda_text ? <><div className="ir-nda-text">{state.nda.nda_text}</div><p className="ir-small">Version {state.nda.nda_version}</p><form onSubmit={event => { event.preventDefault(); void run({ action: 'accept-nda', version: state.nda.nda_version }).catch(() => {}); }}><label className="ir-check"><input type="checkbox" required /> I have read and accept this confidentiality agreement.</label><button className="ir-primary" disabled={busy}>Accept and enter</button></form></> : <p>The administrator is preparing the confidentiality agreement. Documents will be available after it is published and accepted.</p>}</section>}
          {!recovering && state.canRead && <>
            <nav className="ir-tabs" aria-label="Investor room sections">{[['overview', 'Your space'], ['documents', 'Documents'], ['updates', 'Astra updates'], ['questions', 'Conversation'], ['account', 'Your account'], ...(state.admin ? [['admin', 'Manage room']] : [])].map(([key, label], i) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); if (key === 'admin') refresh(true).catch(e => setError(e.message)); }}><span className="ir-tab-number" aria-hidden="true">0{i + 1}</span>{label}</button>)}</nav>
            <div className="ir-tab-content" key={tab}>
            {tab === 'overview' && <InvestorOverview member={state.member} documents={state.documents.filter(d => d.published)} onTab={setTab} onOpen={doc => void openDocument(doc, false)} />}
            {tab === 'updates' && <InvestorDispatch documents={state.documents.filter(d => d.published)} onOpen={doc => void openDocument(doc, false)} />}
            {tab === 'documents' && <DocumentLibrary state={state} busy={busy} onOpen={openDocument} onShare={setShareDoc} />}
            {tab === 'questions' && <section className="ir-panel ir-conversation"><p className="ir-code-label">04 / AN OPEN CONVERSATION</p><h2>What’s on <em>your mind?</em></h2><p>A good question can open an entirely new perspective. Your conversation is private between you and the Astra investor team.</p><form onSubmit={e => void submit(e, 'question')}><label>Your question<textarea name="question" placeholder="What would you like to explore?" required maxLength={4000} rows={4} /></label><button className="ir-primary" disabled={busy}>Send your question <span aria-hidden="true">↗</span></button></form><Questions questions={state.questions} /></section>}
            {tab === 'account' && <section className="ir-panel"><p className="ir-code-label">05 / YOUR PERSONAL CONNECTION</p><h2>Your account. <em>Your space.</em></h2><ProfileName auth={auth!} name={state.member.display_name || ''} onSaved={() => void refresh().catch(e => setError(e.message))} /><h3>Access & privacy</h3><p>Signed in as <strong>{state.member.email}</strong>. {state.member.expires_at ? `Access expires ${date(state.member.expires_at)}.` : 'Access remains subject to administrator approval.'}</p><p>We record account identity, access requests, document delivery, copy IDs, confidentiality acceptance, questions, sharing requests, and permission changes to manage investor relations and protect confidential materials. Investor room administrators can inspect these records.</p><p>Documents are stored privately on Google Cloud. Supabase handles accounts, permissions and investor records. Your email and the delivery timestamp appear in your personalized document copies. A delivery event means the server issued a copy; it does not prove that a person read or saved it.</p><p>Colleague access requests require approval and a separate account. External forwarding, screenshots and copies outside this portal cannot be reliably tracked or prevented. Revoking portal access does not recall downloaded files.</p><p>Investor records are retained while needed for investor relations, security and applicable business obligations. Contact <a href="mailto:support@astra-via.com">support@astra-via.com</a> to ask about access or retention. <Link href="/privacy">Product privacy notice</Link>.</p><SetPassword auth={auth!} /></section>}
            {tab === 'admin' && state.admin && (admin ? <Admin state={state} management={admin} run={run} busy={busy} loadPreview={loadPublicationPreview} onOpen={doc => void openDocument(doc, false)} refresh={offset => refresh(true, offset).catch(e => setError(e.message))} /> : <p>Loading management controls…</p>)}
            </div>
          </>}
        </>}
      </>}
      <AstraMethod />
      <p className="ir-confidential"><span aria-hidden="true">{'[ PRIVATE BY DESIGN ]'}</span> Individual access · Personalized copies · <a href="mailto:support@astra-via.com">Get in touch</a></p>
      {invitation && <section className="ir-panel"><h3>Invitation created</h3><p>No email has been sent. Copy this one-time link and share it privately with the investor. It expires under the Supabase invitation settings.</p><label>Private invitation link<input readOnly value={invitation} onFocus={e => e.target.select()} /></label><button onClick={() => setInvitation('')}>Hide link</button></section>}
    </main><SiteFooter />
    {preview && <div className="ir-modal" role="dialog" aria-modal="true" aria-labelledby="ir-preview-title"><div className="ir-modal-header"><h2 id="ir-preview-title">{preview.title}</h2><button autoFocus onClick={closePreview}>Close preview ✕</button></div><p className="ir-small">Personalized copy. Preview access cannot prevent screenshots or copying.</p><iframe title={`Personalized PDF: ${preview.title}`} src={`${preview.url}#toolbar=0`} /></div>}
    {shareDoc && <div className="ir-modal ir-share-modal" role="dialog" aria-modal="true" aria-labelledby="ir-share-title"><div className="ir-modal-header"><h2 id="ir-share-title">Request colleague access</h2><button autoFocus onClick={() => setShareDoc(null)}>Close ✕</button></div><p>{shareDoc.title}</p><p>The administrator reviews each request. Your colleague will need a verified account and their own approval.</p><form onSubmit={e => void submit(e, 'share')}><input type="hidden" name="document_id" value={shareDoc.id} /><label>Colleague’s email<input type="email" name="email" required maxLength={254} /></label><button className="ir-primary" disabled={busy}>Submit access request</button></form></div>}
  </div>;
}

function DocumentLibrary({ state, busy, onOpen, onShare }: { state: State; busy: boolean; onOpen: (doc: Doc, download: boolean) => Promise<void>; onShare: (doc: Doc) => void }) {
  const [category, setCategory] = useState('All documents');
  const filtered = state.documents.filter(d => category === 'All documents' || d.category === category);
  return <section><div className="ir-library-heading"><div><p className="ir-code-label">02 / THE EVIDENCE ROOM</p><h2>Explore the <em>substance.</em></h2><p>Your approved materials. A personal copy, a clear trail.</p></div><label>Filter by category<select value={category} onChange={e => setCategory(e.target.value)}>{['All documents', ...state.categories].map(c => <option key={c}>{c}</option>)}</select></label></div><div className="ir-documents">{filtered.map((doc, i) => <article className="ir-document" key={doc.id}><div className="ir-doc-top"><span className="ir-code-label">{String(i + 1).padStart(2, '0')} / {doc.category}</span><span className="ir-pdf">PDF</span>{state.admin && <small>{doc.published ? 'Published' : 'Draft'}</small>}</div><h3>{doc.title}</h3><p>{doc.description}</p><div className="ir-document-version">VERSION {doc.version} <span>·</span> {doc.pages} PAGES</div><div className="ir-doc-actions"><button className="ir-primary" disabled={busy} onClick={() => void onOpen(doc, false)}>Open document <span aria-hidden="true">↗</span></button>{(doc.can_download || state.admin) && <button disabled={busy} onClick={() => void onOpen(doc, true)}>Download PDF</button>}<button disabled={busy} onClick={() => onShare(doc)}>Request colleague access</button></div></article>)}</div>{!filtered.length && <section className="ir-library-empty"><span className="ir-empty-brackets" aria-hidden="true">{'[ · ]'}</span><div><p className="ir-code-label">ROOM TO EXPLORE</p><h3>{state.documents.length ? 'A different perspective, perhaps?' : 'The first chapter is still ahead.'}</h3><p>{state.documents.length ? 'No materials in this category yet. Choose another category to keep exploring.' : state.admin ? 'Upload a PDF in Manage room, then publish it and choose who can explore it.' : 'Your approved documents will appear here as the team shares them with you.'}</p></div></section>}</section>;
}

function ProfileName({ auth, name, onSaved }: { auth: SupabaseClient; name: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <form className="ir-profile-form" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage('');
    const displayName = String(new FormData(e.currentTarget).get('display_name')).trim();
    try {
      const { error } = await auth.auth.updateUser({ data: { astra_investor_name: displayName } });
      if (error) throw error;
      setMessage('Your welcome has been updated.'); onSaved();
    } catch { setMessage('Your name could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }}><label>How would you like to be welcomed?<input name="display_name" defaultValue={name} autoComplete="name" maxLength={80} required /></label><button className="ir-primary" disabled={busy}>{busy ? 'Saving…' : 'Save your name'}</button><p role="status" className="ir-small">{message}</p></form>;
}

function Login({ auth, onError, passwordReset }: { auth: SupabaseClient; onError: (text: string) => void; passwordReset: boolean }) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); onError(''); const form = new FormData(e.currentTarget);
    try {
      const { error } = await auth.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) });
      if (error) onError('Sign-in failed. Check your credentials and invitation.');
    } catch { onError('We could not connect. Please try signing in again.'); }
    finally { setBusy(false); }
  }
  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); onError(''); setSent(false); const form = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/investors/reset', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(form.get('email')) }) });
      if (!response.ok) throw Error('Reset request failed');
      setSent(true);
    } catch { onError('The reset request could not be completed. Try again later or contact support@astra-via.com.'); }
    finally { setBusy(false); }
  }
  return <section className="ir-panel ir-login" id="ir-enter" tabIndex={-1}><div className="ir-card-top"><span className="ir-code-label">INVESTOR ROOM</span><span className="ir-login-status"><i /> BY INVITATION</span></div><h2>Enter your <em>orbit.</em></h2><p>Good to have you here. Sign in to your personal space.</p><form onSubmit={login}><label>Email address<input name="email" type="email" placeholder="you@company.com" autoComplete="username" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label><button className="ir-primary" disabled={busy}>{busy ? 'Opening your space…' : <>Enter investor room <span aria-hidden="true">↗</span></>}</button></form>{passwordReset ? <details><summary>Forgot your password?</summary><form onSubmit={reset}><label>Account email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><button disabled={busy}>Request password reset</button></form>{sent && <p role="status">If an eligible account exists, password reset instructions will be sent.</p>}</details> : <p className="ir-small">Password help? <a href="mailto:support@astra-via.com?subject=Investor%20Room%20account%20help">Contact investor support</a>.</p>}<p className="ir-login-note">First time here? Follow your invitation link to verify your email, then choose a password in Your account.</p><p className="ir-small">ASTRA VIA LTD · Private access for approved recipients. Account, confidentiality and document-delivery records support this room. <Link href="/privacy">Privacy</Link> · <Link href="/legal">Terms</Link> · <Link href="/subprocessors">Service providers</Link>. Materials are not a public offer or investment advice; forward-looking statements involve uncertainty.</p><div className="ir-login-footer"><span aria-hidden="true">{'{ }'}</span><span>INDIVIDUAL ACCESS. A SHARED AMBITION.</span></div></section>;
}
function SetPassword({ auth, initiallyOpen = false, onSaved }: { auth: SupabaseClient; initiallyOpen?: boolean; onSaved?: () => void }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  return <details open={initiallyOpen || undefined}><summary>Set or change your password</summary><form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); if (data.get('password') !== data.get('confirm')) { setMessage('The passwords do not match.'); return; } setBusy(true); const { error } = await auth.auth.updateUser({ password: String(data.get('password')) }); setMessage(error ? 'The password could not be updated. Try a stronger password or sign in again.' : 'Password updated.'); setBusy(false); if (!error) { form.reset(); onSaved?.(); } }}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} required /></label><button disabled={busy}>Save password</button><p role="status">{message}</p></form></details>;
}
function Questions({ questions, run, busy }: { questions: Question[]; run?: Run; busy?: boolean }) {
  return <div className="ir-questions">{questions.map(q => <article key={q.id}><p className="ir-small">{run && `${q.email} · `}{date(q.created_at)}</p><h3>{q.question}</h3><p className="ir-answer">{q.answer || 'Awaiting a reply.'}</p>{run && <form onSubmit={e => { e.preventDefault(); void run({ action: 'answer', id: q.id, answer: new FormData(e.currentTarget).get('answer') }).catch(() => {}); }}><label>Private reply<textarea name="answer" defaultValue={q.answer} maxLength={8000} rows={3} required /></label><button disabled={busy}>Save reply</button></form>}</article>)}</div>;
}
function Admin({ state, management, run, busy, refresh, loadPreview, onOpen }: { state: State; management: Administration; run: Run; busy: boolean; refresh: (offset: number) => void; loadPreview: (doc: Doc, signal: AbortSignal) => Promise<Blob>; onOpen: (doc: Doc) => void }) {
  const [section, setSection] = useState('Documents');
  return <div className="ir-admin"><nav className="ir-subtabs" aria-label="Management sections">{['Documents', 'Investors', 'Permissions', 'Confidentiality', 'Questions', 'Sharing', 'Audit'].map(s => <button key={s} aria-current={section === s ? 'page' : undefined} onClick={() => setSection(s)}>{s}</button>)}</nav>
    {section === 'Documents' && <><section className="ir-panel"><h2>Upload a document</h2><p>PDF only · up to 25 MB · 200 pages. Uploads start as drafts. Use a new upload for each version so prior copies remain traceable.</p><form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; try { await run(new FormData(form)); form.reset(); } catch {} }}><div className="ir-form-grid"><label>Document title<input name="title" maxLength={200} required /></label><label>Version<input name="version" placeholder="e.g. 2026.10" maxLength={40} required /></label><label>Category<select name="category">{state.categories.map(c => <option key={c}>{c}</option>)}</select></label><label>PDF file<input name="file" type="file" accept="application/pdf,.pdf" required /></label></div><label>Description<textarea name="description" maxLength={2000} rows={2} /></label><button className="ir-primary" disabled={busy}>Upload private PDF</button></form></section><section className="ir-panel"><h2>Publication</h2><p>Publication makes a document available only to investors who also have a grant.</p><InvestorPublicationList documents={state.documents} busy={busy} loadPreview={loadPreview} onOpen={onOpen} onPublish={doc => void run({ action: 'publish', document_id: doc.id, published: !doc.published }).catch(() => {})} /></section></>}
    {section === 'Investors' && <><section className="ir-panel"><h2>Add an investor</h2><p>Existing Astra accounts retain their other permissions. New accounts receive only Investor Room approval. Creating an invitation generates a private link; no email is sent.</p><MemberForm busy={busy} run={run} /></section>{management.members.map(person => <details key={person.user_id} className="ir-panel"><summary>{person.email} · {person.role} · {person.approved ? 'Allowed' : 'Blocked'}</summary><MemberForm key={JSON.stringify(person)} person={person} run={run} busy={busy} /></details>)}</>}
    {section === 'Permissions' && <section className="ir-panel"><h2>Document permissions</h2><p>Grant each investor access to individual documents. Download approval is separate from preview access.</p>{management.members.filter(m => m.role !== 'admin').map(m => <details key={m.user_id}><summary>{m.email}</summary>{state.documents.map(d => { const grant = management.grants.find(g => g.user_id === m.user_id && g.document_id === d.id); return <div key={d.id} className="ir-list-row"><span>{d.title} · {d.version}</span><label className="ir-check"><input type="checkbox" checked={grant?.can_view || false} disabled={busy} onChange={e => void run({ action: 'grant', user_id: m.user_id, document_id: d.id, can_view: e.target.checked, can_download: e.target.checked && grant?.can_download }).catch(() => {})} /> Preview</label><label className="ir-check"><input type="checkbox" checked={grant?.can_download || false} disabled={busy || !grant?.can_view} onChange={e => void run({ action: 'grant', user_id: m.user_id, document_id: d.id, can_view: true, can_download: e.target.checked }).catch(() => {})} /> Download</label></div>; })}</details>)}</section>}
    {section === 'Confidentiality' && <section className="ir-panel"><h2>Publish your approved confidentiality agreement</h2><p>Paste the agreement approved for your investor process. Every publication creates a new version and requires investors to accept it before further document access. This records acceptance; it does not provide an electronic signature service.</p><form onSubmit={e => { e.preventDefault(); void run({ action: 'save-nda', text: new FormData(e.currentTarget).get('text') }).catch(() => {}); }}><label>Agreement text<textarea name="text" defaultValue={state.nda.nda_text} rows={14} maxLength={30000} required /></label><button className="ir-primary" disabled={busy}>Publish new agreement version</button></form></section>}
    {section === 'Questions' && <section className="ir-panel"><h2>Investor questions</h2><Questions questions={state.questions} run={run} busy={busy} /></section>}
    {section === 'Sharing' && <section className="ir-panel"><h2>Colleague access requests</h2><p>Add a recipient as an investor before approving their request. Approval grants document preview access. Their own sign-in, NDA and approval remain required.</p>{management.shares.map(s => <article key={s.id} className="ir-share-request"><p>{s.sender_email} → {s.recipient_email}</p><p>{state.documents.find(d => d.id === s.document_id)?.title || s.document_id} · {s.status}</p>{s.status === 'pending' && <div className="ir-doc-actions"><button disabled={busy} onClick={() => void run({ action: 'resolve-share', id: s.id, status: 'approved' }).catch(() => {})}>Approve preview access</button><button disabled={busy} onClick={() => void run({ action: 'resolve-share', id: s.id, status: 'declined' }).catch(() => {})}>Decline</button></div>}</article>)}{!management.shares.length && <p>No sharing requests yet.</p>}</section>}
    {section === 'Audit' && <section className="ir-panel"><h2>Access & activity audit</h2><p>Server-recorded requests and deliveries. Delivery does not prove reading, saving, or subsequent forwarding outside this portal. Events are append-only for application accounts.</p><div className="ir-audit-scroll"><table><thead><tr><th>Time</th><th>Account</th><th>Action</th><th>Details</th></tr></thead><tbody>{management.events.map(e => <tr key={e.id}><td>{date(e.occurred_at)}</td><td>{e.actor_email}</td><td>{e.action.replaceAll('_', ' ')}</td><td><details><summary>{e.copy_id ? `Copy ${e.copy_id.slice(0, 8)}` : 'Inspect'}</summary><pre>{JSON.stringify({ document_id: e.document_id, copy_id: e.copy_id, ...e.details }, null, 2)}</pre></details></td></tr>)}</tbody></table></div><div className="ir-doc-actions"><button disabled={busy || management.offset === 0} onClick={() => refresh(Math.max(0, management.offset - 100))}>Newer events</button><span>Events {management.offset + 1}–{management.offset + management.events.length}</span><button disabled={busy || management.events.length < 100} onClick={() => refresh(management.offset + 100)}>Older events</button></div></section>}
  </div>;
}
function MemberForm({ person, run, busy }: { person?: Person; run: Run; busy: boolean }) {
  return <form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); try { await run({ action: 'member', ...Object.fromEntries(data), approved: data.get('approved') === 'on', expires_at: data.get('expires_at') ? new Date(String(data.get('expires_at'))).toISOString() : null }); if (!person) form.reset(); } catch {} }}><div className="ir-form-grid"><label>Email<input type="email" name="email" defaultValue={person?.email} readOnly={!!person} required maxLength={254} /></label><label>Organization<input name="organization" defaultValue={person?.organization} maxLength={200} /></label><label>Role<select name="role" defaultValue={person?.role || 'investor'}><option value="investor">Investor</option><option value="admin">Investor administrator</option></select></label><label>Access expiry (your local time)<input type="datetime-local" name="expires_at" defaultValue={person?.expires_at ? new Date(new Date(person.expires_at).getTime() - new Date(person.expires_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} /></label><label>Investor stage<select name="stage" defaultValue={person?.stage || 'invited'}>{['invited', 'reviewing', 'follow-up', 'committed', 'closed'].map(s => <option key={s}>{s}</option>)}</select></label><label className="ir-check"><input type="checkbox" name="approved" defaultChecked={person ? person.approved : true} /> Allow Investor Room access</label></div><button disabled={busy} className="ir-primary">{person ? 'Save investor' : 'Add investor'}</button></form>;
}
