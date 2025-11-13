# Contributing to BooksTrack Backend

Thank you for considering contributing to BooksTrack Backend! This document provides guidelines and requirements for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Testing Requirements](#testing-requirements)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

## Getting Started

1. **Fork the repository** and clone your fork locally
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your API keys
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Run tests to ensure everything works:**
   ```bash
   npm test
   ```

## Development Process

1. **Create a new branch** from `main` for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** following the code style guidelines
3. **Write tests** for your changes (see Testing Requirements below)
4. **Run tests and ensure they pass:**
   ```bash
   npm test
   npm run test:coverage
   ```
5. **Commit your changes** following the commit guidelines
6. **Push to your fork** and create a pull request

## Testing Requirements

**All new code must include tests.** This is a strict requirement for all contributions.

### Coverage Requirements

- **Minimum 75% coverage for critical paths** (validators, normalizers, auth)
- **No flaky tests allowed** - All tests must be deterministic and reliable
- **Tests must pass consistently** across multiple runs

### Test Organization

Place tests in the appropriate directory:

```
tests/
├── unit/           # Unit tests for individual functions/modules
├── integration/    # Integration tests for multiple components
├── handlers/       # Tests for request handlers
├── normalizers/    # Tests for data normalization
└── utils/          # Tests for utility functions
```

### Test Naming Conventions

Follow this pattern for test files and test cases:

**File Naming:**
- `my-module.test.js` - for unit tests
- `my-feature.integration.test.js` - for integration tests
- `my-handler.e2e.test.js` - for end-to-end tests

**Test Case Naming:**
```javascript
describe('ModuleName or FeatureName', () => {
  describe('functionName() or scenario', () => {
    it('should do something specific when condition', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle edge case correctly', () => {
      // Test implementation
    });

    it('should throw error for invalid input', () => {
      // Test implementation
    });
  });
});
```

### Writing Good Tests

**DO:**
- ✅ Write clear, descriptive test names that explain the scenario
- ✅ Follow the Arrange-Act-Assert (AAA) pattern
- ✅ Test both happy paths and error cases
- ✅ Keep tests isolated and independent
- ✅ Mock external dependencies (APIs, databases, etc.)
- ✅ Test edge cases and boundary conditions
- ✅ Use meaningful assertions with clear error messages

**DON'T:**
- ❌ Write tests that depend on external services
- ❌ Write tests that depend on execution order
- ❌ Write tests with random or time-dependent behavior
- ❌ Skip writing tests for "simple" code
- ❌ Write overly complex tests
- ❌ Test implementation details instead of behavior

### Mocking Guidelines

Use Vitest's built-in mocking capabilities:

```javascript
import { vi } from 'vitest';

// Mock a module
vi.mock('../src/services/external-apis.js', () => ({
  searchGoogleBooks: vi.fn(),
  searchOpenLibrary: vi.fn()
}));

// Mock Cloudflare Workers environment
const mockEnv = {
  BOOK_CACHE: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined)
  },
  GEMINI_API_KEY: 'test-key'
};
```

For detailed mocking patterns and examples, see [TEST_IMPLEMENTATION_GUIDE.md](TEST_IMPLEMENTATION_GUIDE.md).

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npx vitest run tests/unit/my-module.test.js
```

### Coverage Reports

After running `npm run test:coverage`, check:
- Console output for summary
- `coverage/index.html` for detailed HTML report
- `coverage/lcov.info` for CI/CD integration

## Code Style

- **Use modern JavaScript (ES6+)** features
- **Follow existing code patterns** in the repository
- **Use meaningful variable and function names**
- **Add comments for complex logic** (but prefer self-documenting code)
- **Keep functions small and focused** (single responsibility)
- **Use async/await** instead of promise chains
- **Handle errors appropriately** with proper error messages

## Pull Request Process

### Before Submitting

1. ✅ **All tests pass** (`npm test`)
2. ✅ **Coverage meets requirements** (`npm run test:coverage`)
3. ✅ **Code follows style guidelines**
4. ✅ **Commit messages follow conventions**
5. ✅ **Documentation is updated** (if applicable)

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have verified coverage meets requirements (75%+ for critical paths)

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published
```

### Review Process

1. **Automated checks** must pass (tests, linting)
2. **Code review** by maintainer(s)
3. **Address feedback** from reviewers
4. **Approval and merge** by maintainer

## Commit Guidelines

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring (no functional changes)
- `perf`: Performance improvements
- `chore`: Build process or tooling changes
- `style`: Code style changes (formatting, etc.)

### Examples

```
feat: add batch enrichment endpoint

Implements batch enrichment with WebSocket progress updates.
Includes job queuing and error handling.

Closes #123
```

```
fix: resolve cache key collision for similar titles

Updated cache key generation to include author information
to prevent collisions between books with similar titles.

Fixes #456
```

```
test: add unit tests for CSV validator

Adds comprehensive tests for CSV validation including:
- Valid CSV formats
- Missing required fields
- Invalid data types
- Edge cases and boundary conditions

Coverage: 95% for csv-validator.js
```

## Questions or Issues?

If you have questions or run into issues:

1. Check existing [Issues](https://github.com/jukasdrj/bookstrack-backend/issues)
2. Review [TEST_PLAN.md](TEST_PLAN.md) and [TEST_IMPLEMENTATION_GUIDE.md](TEST_IMPLEMENTATION_GUIDE.md)
3. Open a new issue with detailed information about your question or problem

## License

By contributing to BooksTrack Backend, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to BooksTrack Backend! 🎉
