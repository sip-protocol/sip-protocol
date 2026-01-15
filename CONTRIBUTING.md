# Contributing to SIP Protocol

Thank you for your interest in contributing to SIP Protocol! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Issues

Before creating an issue, please:
1. Search existing issues to avoid duplicates
2. Use the issue templates provided
3. Include relevant details (OS, Node version, reproduction steps)

### Submitting Changes

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes** with clear, descriptive commits
4. **Test your changes**: `pnpm test`
5. **Lint your code**: `pnpm lint`
6. **Submit a pull request** with a clear description

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation as needed
- Add tests for new functionality
- Follow existing code style
- Write meaningful commit messages

### Adding a Changeset

For any changes that affect the public API or fix bugs, add a changeset:

```bash
# Create a changeset for your PR
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected (`@sip-protocol/sdk`, `@sip-protocol/types`)
2. Choose the bump type (patch/minor/major)
3. Write a summary of the change

**When to add a changeset:**
- Bug fixes → `patch`
- New features (backward compatible) → `minor`
- Breaking changes → `major`

**When NOT to add a changeset:**
- Documentation-only changes
- Internal refactoring with no API changes
- CI/tooling updates

The changeset will be committed with your PR and automatically included in the next release.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/sip-protocol.git
cd sip-protocol

# Install dependencies
pnpm install

# Create a branch for your changes
git checkout -b feature/your-feature-name

# Start development
pnpm dev
```

## Project Structure

```
sip-protocol/
├── examples/           # Integration examples
├── packages/
│   ├── sdk/            # Core SDK
│   └── types/          # TypeScript types
├── docs/               # Documentation
└── .github/            # GitHub templates & workflows
```

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit types over inference for public APIs
- Document public functions with JSDoc comments

### Formatting

- 2-space indentation
- Single quotes for strings
- No semicolons (Prettier default)
- Max line length: 100 characters

### Branch Naming

Use the `{type}/issue-{N}-{slug}` format:

```
feat/issue-490-privacy-advisor
fix/issue-123-validation-bug
docs/issue-456-update-guides
chore/issue-789-cleanup
```

- `{type}`: feat, fix, docs, chore, refactor, test, perf
- `{N}`: GitHub issue number
- `{slug}`: Short descriptive slug (kebab-case)

**For agent-generated branches**, follow the same convention:
```bash
# Good
feat/issue-490-add-privacy-advisor-agent
fix/issue-123-fix-commitment-validation

# Avoid
claude/some-random-task-id
agent/task-12345
```

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add stealth address generation
fix: resolve commitment verification bug
docs: update integration guide
chore: update dependencies
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Documentation

- Update docs for any public API changes
- Use clear, concise language
- Include code examples where helpful

## Release Process

SIP Protocol uses [Changesets](https://github.com/changesets/changesets) for automated releases.

### How it works

1. **Contributors add changesets** with their PRs (`pnpm changeset`)
2. **On merge to main**, a "Release" PR is automatically created/updated
3. **The Release PR** accumulates all changesets and shows a changelog preview
4. **When merged**, packages are automatically published to npm

### For Maintainers

```bash
# View pending changesets
pnpm changeset status

# Manually version packages (rarely needed)
pnpm version

# Manually release (rarely needed)
pnpm release
```

The automated workflow handles:
- Version bumping based on changesets
- CHANGELOG.md generation
- npm publishing
- GitHub release creation
- Syncing changelog to docs site

## Getting Help

- Open a [GitHub Discussion](https://github.com/sip-protocol/sip-protocol/discussions) for questions
- Join our community channels (links in README)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
