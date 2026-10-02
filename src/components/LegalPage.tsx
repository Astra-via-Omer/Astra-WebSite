import { SiteHeader, SiteFooter } from './SiteChrome';
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <><a className="skip" href="#main-content">Skip to content</a><SiteHeader />
    <main id="main-content" tabIndex={-1} className="legal-page"><p className="eyebrow">Astra-via · Information</p><h1>{title}</h1><p className="page-intro">{intro}</p><p className="updated">Updated 2 October 2026 · עודכן 2 באוקטובר 2026</p>
      <nav className="language-links" aria-label="Page languages"><a href="#english">English</a><a href="#hebrew" lang="he">עברית</a></nav>{children}
      <aside className="notice"><p>Contact Astra-via: <a href="mailto:support@astra-via.com">support@astra-via.com</a>. This notice covers this public website. A separate product or contractual service requires its own applicable notices and terms.</p><p lang="he" dir="rtl">ליצירת קשר עם Astra-via: <a href="mailto:support@astra-via.com">support@astra-via.com</a>. הודעה זו מתייחסת לאתר הציבורי הזה. מוצר או שירות חוזי נפרד מחייבים הודעות ותנאים מתאימים משלהם.</p></aside>
    </main><SiteFooter /></>;
}
