# Website validation — 2 October 2026

- Next.js production build and TypeScript validation passed for all routes.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- In-app browser manual checks: four philosopher chapter links select the corresponding chapter; Reduce motion removes transformed/fading backgrounds and switches the journey to ten ordinary reading sections. The selection is retained through internal Next.js navigation and is not stored in browser persistence.
- Keyboard Tab navigation moved between main navigation links with a visible solid focus outline.
- Narrow-screen checks at 320×800 and 390×844: privacy, terms and accessibility pages had no horizontal overflow; Hebrew section marked `lang=he` and `dir=rtl`; its anchor landed below the fixed header. Journey text shading was strengthened after visual review.
- All examined images have alt attributes; decorative portrait backgrounds are hidden from the accessibility tree. Philosophy text, sources and reading-view chapters are present in the accessibility tree.
- Source inventory: no analytics, advertising, cookies or local/session storage implementation; external font import removed. Response headers include nosniff, referrer policy and framing/object/base restrictions.
- Domain HTTPS returned 200; HTTP redirected to HTTPS. Google-managed certificate reported ACTIVE for both astra-via.com and www.astra-via.com.

Limits: this is an internal implementation check, not a full WCAG/Israeli Standard 5568 audit, assistive-technology certification or legal compliance opinion. Company identity, actual email processing, privacy operations and any accessibility-coordinator obligations remain subject to confirmation and professional review. See website-legal-review.md.
