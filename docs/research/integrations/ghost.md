# Ghost Integration Research

## Status
- Planned.

## Authentication
- Use Ghost Admin API with integration tokens. Requires generating JWT signed with admin key (`id:secret`). Token valid 5 minutes.【turn2view0】
- Alternative: staff tokens for user-specific operations; prefer integration tokens to avoid user credentials.

## Publishing Flow
- Endpoint: `POST /ghost/api/admin/posts/` with payload `{"posts":[{title, html or lexical, status}]}`. Use `?source=html` when sending PortableArticle HTML.【turn2view0】
- Draft vs publish: set `status` to `draft` or `published`.
- Include tags/authors arrays; fallback to owner if omitted.
- Media uploads via `/ghost/api/admin/images/`.

## Features
- Supports copy endpoint (`POST /posts/{id}/copy`) for versioning.
- Accept-Version header required (e.g. `v5.80`); track via config.

## Security
- Admin API keys must stay server-side; never expose to browser.
- Ghost enforces HTTPS on Ghost(Pro); self-hosted sites should configure TLS before enabling integration.

## Sources
- [Ghost Admin API Overview](https://ghost.org/docs/admin-api/)【turn2view0】

