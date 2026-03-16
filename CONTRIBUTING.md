# Contributing to Adaptive Cards MCP

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/VikrantSingh01/adaptive-cards-mcp.git
cd adaptive-cards-mcp/packages/core

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
npm run lint:eslint

# Format
npm run format
```

## Architecture Overview

```
packages/core/src/
├── server.ts              # MCP server (stdio + SSE transports)
├── index.ts               # Library entry point
├── types/index.ts         # All TypeScript type definitions
├── core/                  # Validation, analysis, accessibility, host compat
│   ├── schema-validator.ts
│   ├── card-analyzer.ts
│   ├── accessibility-checker.ts
│   └── host-compatibility.ts
├── generation/            # Card assembly, LLM integration, patterns
│   ├── card-assembler.ts
│   ├── llm-client.ts
│   ├── layout-patterns.ts
│   ├── prompt-builder.ts
│   ├── data-analyzer.ts
│   └── example-selector.ts
├── tools/                 # MCP tool handlers (one file per tool)
│   ├── generate-card.ts
│   ├── validate-card.ts
│   ├── data-to-card.ts
│   ├── optimize-card.ts
│   ├── template-card.ts
│   ├── transform-card.ts
│   └── suggest-layout.ts
├── utils/                 # Cross-cutting utilities
│   ├── logger.ts
│   ├── input-guards.ts
│   ├── rate-limiter.ts
│   ├── card-store.ts
│   ├── auth.ts
│   └── telemetry.ts
└── data/                  # Static data (schema, examples, host configs)
```

## Adding a New Tool

1. Create the handler in `src/tools/your-tool.ts`
2. Add input/output types in `src/types/index.ts`
3. Register the tool definition and handler in `src/server.ts`
4. Export the handler in `src/index.ts`
5. Add tests in `tests/tools/your-tool.test.ts`
6. Update the README tool table

## Testing Guidelines

- All tool handlers must have unit tests
- Use vitest's `describe`/`it`/`expect` (globals enabled)
- Test both success and error paths
- Test edge cases: empty inputs, deeply nested cards, malformed JSON
- Integration tests go in `tests/integration/`
- **Async code**: Use `async/await` in tests. For LLM-dependent code, mock `fetch` or test the deterministic fallback path
- **Mocking**: Use `vi.spyOn()` for system calls (e.g., `process.stderr.write`). Use `vi.fn()` for custom mocks
- **Environment**: Save and restore `process.env` in `beforeEach`/`afterEach` for tests that modify env vars

## Pull Request Checklist

- [ ] All existing tests pass (`npm test`)
- [ ] New tests added for new functionality
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript compiles without errors (`npm run lint`)
- [ ] Commit messages follow conventional format (`feat:`, `fix:`, `docs:`, `chore:`)

## Code Style

- TypeScript strict mode
- 2-space indentation
- Double quotes for strings
- Trailing commas
- No unused variables (prefixed with `_` if intentionally unused)
- Prefer `const` over `let`
- No `any` except in MCP handler argument parsing

## Reporting Issues

Use [GitHub Issues](https://github.com/VikrantSingh01/adaptive-cards-mcp/issues) to report bugs or request features.
