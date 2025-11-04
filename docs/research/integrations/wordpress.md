# WordPress Integration Research

## Status
- Beta (works with WordPress.com and self-hosted installs).

## Authentication
- Primary: Application Password per user (`/wp-json/wp/v2/users/{id}/application-passwords`); supports revocation and avoids sharing primary password.【turn14search0】【turn14search2】
- Secondary: JWT plugins (e.g. official JWT Authentication, CoCart) if customers already standardized on token flows; document required headers and secret management.【turn14search1】【turn14search3】【turn14search4】

## Publishing Workflow
- Create/update posts via `POST /wp/v2/posts` (or `POST /wp/v2/posts/{id}` for updates). Map PortableArticle fields to `title`, `content`, `excerpt`, `status`, taxonomy IDs.【turn14search5】
- Media: upload images via `POST /wp/v2/media` before referencing in post HTML; requires `Content-Disposition: attachment; filename=...`.
- Scheduling: set `status=future` and `date_gmt` to schedule.
- Categories/Tags: ensure IDs exist; optionally auto-create via `/wp/v2/categories` if integration has `manage_categories` capability.

## Hardening
- Enforce minimum WordPress 5.6 (Application Passwords in core) and PHP 7.4.
- Recommend customers audit plugins; REST vulnerabilities (e.g. Post SMTP CVE-2025-24000) can leak credentials/logs.【turn14news12】
- Support site-level base path (handles installs in subdirectory).

## UX
- UI should prompt for site URL, username, app password (stored encrypted), default author, optional category/tag mappings.
- Provide “Test connection” that fetches current user to confirm credentials.

## Sources
- [Application Passwords – WordPress.com](https://wordpress.com/plugins/application-passwords)【turn14search0】
- [REST API Handbook: Application Passwords](https://developer.wordpress.org/rest-api/reference/application-passwords/)【turn14search2】
- [REST API Handbook: Posts](https://developer.wordpress.org/rest-api/reference/posts/)【turn14search5】
- [JWT Authentication for WP REST API plugin](https://wordpress.com/plugins/jwt-authentication-for-wp-rest-api)【turn14search1】
- [CoCart JWT Authentication changelog](https://wordpress.org/plugins/cocart-jwt-authentication/)【turn14search3】
- [WordPress plugin security advisory](https://www.techradar.com/pro/security/dangerous-wordpress-plugin-puts-over-160-000-sites-at-risk-heres-what-we-know)【turn14news12】

