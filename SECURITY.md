# Security Policy

## Supported Versions

We actively support the following versions of Living Documentation Generator:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 🚨 For Critical Security Issues

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing: **[sgharlow@gmail.com]**

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if available)

### 📧 What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Initial Assessment**: We'll provide an initial assessment within 5 business days
- **Updates**: We'll keep you informed of our progress
- **Resolution**: We aim to resolve critical issues within 30 days

### 🛡️ Security Best Practices

When using Living Documentation Generator:

#### For Users
- **Keep Updated**: Always use the latest version
- **Secure Configuration**: Review MCP server configuration
- **File Permissions**: Ensure proper file system permissions
- **Network Security**: Run on trusted networks only

#### For Developers
- **Input Validation**: All file paths and content are validated
- **Sandboxing**: Code analysis runs in isolated contexts
- **No Code Execution**: Analyzers parse code without execution
- **Dependency Security**: Regular dependency updates and audits

### 🔒 Security Features

Living Documentation Generator includes several security measures:

- **Path Sanitization**: Prevents directory traversal attacks
- **Content Filtering**: Sanitizes user-generated content
- **Size Limits**: Prevents resource exhaustion attacks
- **No Remote Code Execution**: Static analysis only
- **Local Operation**: No external network dependencies required

### 🚫 Out of Scope

The following are generally considered out of scope:
- Issues in third-party dependencies (report to respective maintainers)
- Social engineering attacks
- Physical access to systems
- Denial of service through resource exhaustion (unless critical)

### 📋 Security Checklist for Contributors

When contributing code:

- [ ] Validate all user inputs
- [ ] Sanitize file paths and content
- [ ] Avoid executing user-provided code
- [ ] Use secure defaults in configuration
- [ ] Add security tests for new features
- [ ] Review dependencies for known vulnerabilities

### 🔄 Security Updates

Security updates will be:
- Released as patch versions (e.g., 0.1.1 → 0.1.2)
- Documented in release notes
- Announced through GitHub security advisories
- Backported to supported versions when possible

### 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [GitHub Security Features](https://docs.github.com/en/code-security)

---

Thank you for helping keep Living Documentation Generator secure! 🔒