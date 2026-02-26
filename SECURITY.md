# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in OpenOrbit, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues by emailing **security@openorbit.dev** or by using [GitHub's private vulnerability reporting](https://github.com/openorbit/openorbit/security/advisories/new).

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- Affected versions / components
- Potential impact and severity
- Any suggested remediation

### Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial assessment**: Within 5 business days
- **Fix or mitigation**: Dependent on severity and complexity

## Trust Model

OpenOrbit is a **personal desktop application** designed to run locally on your own machine. It is not a multi-tenant or server-hosted platform.

- The local RPC server binds to localhost by default and uses token-based authentication
- Browser automation sessions use isolated user data directories
- API keys and credentials are stored locally in the application database
- Extensions run in-process with application-level privileges

## Scope

### In Scope

- Remote code execution
- Authentication or authorization bypass in the RPC server
- Credential leakage or exposure
- Cross-site scripting (XSS) in the Electron renderer
- Insecure defaults that expose user data

### Out of Scope

- Vulnerabilities requiring physical access to the user's machine
- Issues in third-party dependencies (report these upstream)
- Social engineering attacks
- Denial of service against the local application
- Issues that require the user to explicitly disable security features

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |
| < 1.0   | No                 |

## Acknowledgments

We appreciate the security research community's efforts in helping keep OpenOrbit safe. Reporters who follow responsible disclosure will be credited in release notes (unless they prefer to remain anonymous).
