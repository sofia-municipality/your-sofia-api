# Contributing to Your Sofia

Thank you for your interest in contributing to **Your Sofia**! This project is built by the community, for the community. Whether you're a developer, designer, translator, or just someone who cares about making Sofia a better place to live, we welcome your contributions.

[🇧🇬 Прочети на български](CONTRIBUTING.bg.md)

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Reporting Issues](#reporting-issues)
- [Submitting Changes](#submitting-changes)
- [Code Review Process](#code-review-process)
- [Community](#community)
- [License](#license)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone.

### Our Standards

**Positive behaviors:**

- ✅ Using welcoming and inclusive language
- ✅ Being respectful of differing viewpoints and experiences
- ✅ Gracefully accepting constructive criticism
- ✅ Focusing on what is best for the community
- ✅ Showing empathy towards other community members
- ✅ Giving credit where credit is due

**Unacceptable behaviors:**

- ❌ Trolling, insulting/derogatory comments, and personal or political attacks
- ❌ Publishing others' private information without explicit permission
- ❌ Discrimination or exclusion based on any personal characteristic

### Enforcement

Project maintainers have the right and responsibility to remove, edit, or reject comments, commits, code, issues, and other contributions that do not align with this Code of Conduct.

---

## Getting Started

**📦 Monorepo Setup:** Your Sofia consists of two repositories that work together:
- **your-sofia-api** (this repo) - Payload CMS backend API
- **your-sofia-mobile** - React Native mobile app

Both repositories need to be cloned and configured for full functionality. The mobile app connects to this API for all data operations.

### 1. Fork the Repository

Click the "Fork" button on the [GitHub repository](https://github.com/sofia-municipality/your-sofia-api).

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/your-sofia-api.git
cd your-sofia-api
```

### 3. Set Up the Development Environment

#### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v10.18+) - Install with `npm install -g pnpm` or `corepack enable`
- **Docker** - [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### Installation Steps

**1. Install dependencies:**

```bash
pnpm install
```

**2. Set up environment variables:**
Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

**3. Start PostgreSQL database:**

Using Docker Compose (recommended):

```bash
docker-compose -f docker/docker-compose.local.yml up -d
```

This will start PostgreSQL with PostGIS extension on port `5432`.

**4. Run database migrations:**

```bash
pnpm payload migrate
```

**5. Start the development server:**

```bash
pnpm dev
```

The API will be available at:
- **Admin Panel**: http://localhost:3000/admin
- **API**: http://localhost:3000/api
- **GraphQL**: http://localhost:3000/api/graphql

**6. Create your first admin user:**

Visit http://localhost:3000/admin and follow the setup wizard to create your admin account.


### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Open a Pull Request

Go to the original repository and click "New Pull Request".

### 8. Ask a maintainer to review and merge

Ping one of the maintainers that your PR is ready for review.
Your PR is going to be merge with rebase or squash depending on size to preserve linear history.

> NOTE!: After the merge **don't sync** your fork with the button in Github.
Use the following to rebase your fork too:
```bash
git fetch upstream && git rebase upstream && git push --force-with-lease
```
---

## Reporting Issues

### Writing Good Issues

**Do:**

- ✅ Use descriptive titles
- ✅ Provide context and background
- ✅ Include specific details
- ✅ Attach screenshots or code snippets
- ✅ Search existing issues first

**Don't:**

- ❌ Don't use vague titles like "Not working"
- ❌ Don't submit duplicate issues
- ❌ Don't include multiple unrelated problems in one report
- ❌ Don't demand immediate fixes

---

## Submitting Changes

### Pull Request Guidelines

**Before submitting:**

- ✅ Ensure your code follows our style guidelines
- ✅ Add tests for new features
- ✅ Update documentation if needed
- ✅ Run all tests and ensure they pass
- ✅ Rebase on the latest `main` branch
- ✅ Keep pull requests focused (one feature/fix per PR)

---

## Code Review Process

### For Contributors

**After submitting a PR:**

1. Maintainers will review within a few days
2. Respond to feedback or requested changes
3. Update your PR by pushing new commits
4. Request re-review when ready
5. After your PR is merged in upstream, use `git fetch upstream && git rebase upstream && git push --force-with-lease` to maintain linear history

**Responding to feedback:**

- Be open to suggestions
- Ask questions if something is unclear
- Don't take criticism personally
- Explain your reasoning if you disagree

### For Reviewers

**What to look for:**

- Code quality and style
- Test coverage
- Documentation updates
- Performance implications
- Security considerations
- Accessibility
- Localization (both Bulgarian and English)

**Review etiquette:**

- Be respectful and constructive
- Explain *why* changes are needed
- Acknowledge good work
- Suggest improvements, don't demand them
- Approve quickly when appropriate

**Review checklist:**

- [ ] Code is clear and maintainable
- [ ] Tests cover the changes
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Follows project conventions
- [ ] Both Bulgarian and English translations present
- [ ] Works on iOS and Android (if frontend)
- [ ] No performance regressions

---

## Community

### Communication Channels

Connect with maintainers on the main Discord channel

### Recognition

We value all contributions! Contributors are:

- Listed in project documentation via AllContributors bot
- Acknowledged in release notes
- Recognized in the community

---

## License

By contributing to Your Sofia, you agree that your contributions will be licensed under the [EUPL-1.2 License](LICENSE).

---

## Thank You!

Your contributions make **Your Sofia** better for everyone. Whether you're fixing a typo or building a major feature, every contribution matters. Together we're building a more transparent, accessible, and livable city.

**Happy contributing!** 🎉

---

**Questions?** Open an issue or discussion—we're here to help!