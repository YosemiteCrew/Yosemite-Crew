# Security Policy

This policy explains how to report a security vulnerability in Yosemite Crew and what to expect after you do. It is for anyone (contributors, users, or outside researchers) who finds a potential security issue. For everyday secret-handling rules while contributing, see the Security and Secret Hygiene section of [CONTRIBUTING.md](./CONTRIBUTING.md).

## Reporting a Vulnerability

Please report a suspected vulnerability privately. Do not open a public issue, discussion or pull request for it.

- **Preferred:** use private vulnerability reporting on this repository. Open the **Security** tab and choose **Report a vulnerability**, or go straight to the [private report form](https://github.com/YosemiteCrew/Yosemite-Crew/security/advisories/new).
- **Email:** `security at yosemitecrew.com`, if you cannot use the form.

Include what you can: the affected app and version, a description of the issue, and steps to reproduce it. A partial report is welcome.

## What to Expect

- **Acknowledgement within 2 business days** of your report.
- We triage the report, tell you whether we accept it, and keep you updated until it is resolved.
- **Coordinated disclosure:** please keep the issue confidential and give us up to **90 days** from acknowledgement to release a fix before any public disclosure. We are usually faster, and we will agree the disclosure date with you.
- We credit you in the advisory and the release notes, unless you prefer not to be named.

## Supported Versions

Security fixes are made for the latest release only, and they are free of charge. Earlier releases do not receive fixes, so please update.

| Product                     | Receives security fixes          |
| --------------------------- | -------------------------------- |
| Hosted web app and API      | Yes, always the current version  |
| Self-hosted web app and API | Latest release                   |
| Desktop app                 | Latest release                   |
| Mobile app                  | Latest version in the app stores |
| Published packages          | Latest published version         |
| Any earlier release         | No                               |

## How Fixes Are Announced

Once a fix is available, we publish a security advisory on this repository and list the fix in the release notes. The advisory names the affected versions, the impact and severity, and how to update.

## Safe Harbour

We will not take legal action against good-faith research that follows this policy: avoid privacy violations, data destruction and service disruption, access no more data than you need to show the issue, and give us time to fix it before any disclosure.

There is no bug bounty program at this time.

## Security Features

Suggestions that would improve the product's security are welcome in the discussion forum. This does not apply to vulnerabilities: report those privately as described above.
