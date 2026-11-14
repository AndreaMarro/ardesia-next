# Web experience

Own only this application. Use public package APIs and shared design tokens.
All mutation goes through Core commands; local React state is only transient UI.
Lavagna, Taccuino and Lezione render the same object IDs and revisions.
M3 uses the authenticated Remote Client and PostgreSQL authority. Browser storage holds account-scoped recovery, navigation and the explicit reduced own-lesson copy of ADR0010; historical M0 storage is import input. Offline UI uses no authenticated facade or plugin execution. Do not unmount dirty editors on network loss; guard explicit transitions and freeze input while awaiting them. Read generated status before claiming remote acceptance.
Keep every action functional and keyboard labelled; touch targets at least 44px.
Use Pointer Events for drawing; physical pen tests remain NOT_RUN.
Never render arbitrary HTML or untrusted executable bundles.
KaTeX uses `trust: false`; source links must be http(s).
No DRAFT content presented as reviewed or published.
