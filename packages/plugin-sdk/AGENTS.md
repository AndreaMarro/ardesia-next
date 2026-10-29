# Plugin SDK

Public contracts only. No React, browser persistence, Core internals or executable loading.
Manifest v1 requires explicit SDK, hash, signature, license, publisher key ID and source revision.
Publisher keys come from a host trust store, never a self-asserted key in the manifest.
No capabilities are granted by default. Lifecycle and catalog DTOs are not working installers.
Breaking contract change requires a version, migration plan and consumer test.
