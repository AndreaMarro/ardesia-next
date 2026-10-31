# Web experience

Own only this application. Use public package APIs and shared design tokens.
All mutation goes through Core commands; local React state is only transient UI.
Lavagna, Taccuino and Lezione render the same object IDs and revisions.
M3 uses the authenticated Remote Client and PostgreSQL authority. Browser storage holds only account-scoped pending recovery and navigation preferences; historical M0 storage is import input, never confirmed remote state. Read generated status before claiming remote acceptance.
Keep every action functional and keyboard labelled; touch targets at least 44px.
Use Pointer Events for drawing; physical pen tests remain NOT_RUN.
Never render arbitrary HTML or untrusted executable bundles.
KaTeX uses `trust: false`; source links must be http(s).
No DRAFT content presented as reviewed or published.
