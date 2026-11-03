# Security and privacy

This is a local demonstration application. Keep it on loopback unless you have
configured and reviewed the access policy for your own deployment.

- The application creates its own `runtime/` directory and random initial
  administrator credentials. Do not commit this directory or generated exports.
- User passwords are verified using scrypt; the application has no API for
  recovering or displaying stored user passwords.
- Use synthetic examples in public issues. Never include credentials, session
  cookies, exam links, personal records, databases, or unredacted screenshots.
- Review your assessment rules, administrator scope, HTTPS setup, backups, and
  load limits before collecting real assessment data.

The included tests exercise specific behaviors; they are not a security
certification or a substitute for reviewing a deployment.
