import { SiteHeader, SiteFooter } from './SiteChrome';
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <><a className="skip" href="#main-content">Skip to content</a><SiteHeader />
    <main id="main-content" tabIndex={-1} className="legal-page"><p className="eyebrow">Astra-via · Information</p><h1>{title}</h1><p className="page-intro">{intro}</p><p className="updated">Updated 24 October 2026 · עודכן 24 באוקטובר 2026</p>
      <nav className="language-links" aria-label="Page languages"><a href="#english">English</a><a href="#hebrew" lang="he">עברית</a></nav>{children}
      <aside className="notice"><p>Contact Astra-via: <a href="mailto:support@astra-via.com">support@astra-via.com</a>. See the product privacy notice and service-provider list for private products. A customer agreement may add service-specific terms.</p><p lang="he" dir="rtl">ליצירת קשר עם Astra-via: <a href="mailto:support@astra-via.com">support@astra-via.com</a>. למוצרים הפרטיים ראו את הודעת הפרטיות ורשימת ספקי השירות. הסכם לקוח עשוי להוסיף תנאים לשירות מסוים.</p></aside>
    </main><SiteFooter /></>;
}
