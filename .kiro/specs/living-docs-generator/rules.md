# RULES.md

## Meta Rule
**These rules override all other considerations and must be followed for every interaction.**

## Core Development Rules

### RULE 1: Reality Over Appearance
- **NEVER** use mock data without documenting it in TODOS.md
- **NEVER** claim functionality works without testing it end-to-end
- **NEVER** mark a task complete if it uses placeholder implementations
- **ALWAYS** verify that features work with real data before proceeding

### RULE 2: Architecture Adherence
- **NEVER** change the architecture defined in DESIGN.md without explicit approval
- **NEVER** add new technologies not listed in the tech stack
- **NEVER** create new API endpoints not specified in DESIGN.md
- **ALWAYS** follow the established patterns for similar features

### RULE 3: Scope Discipline
- **NEVER** add features not specified in REQUIREMENTS.md
- **NEVER** expand scope "while we're at it" 
- **NEVER** implement "nice to have" features before core requirements
- **ALWAYS** refer back to requirements before starting new work

### RULE 4: Honest Progress Tracking
- **ALWAYS** test functionality before marking tasks complete
- **ALWAYS** update TASKS.md with accurate status
- **ALWAYS** add shortcuts to TODOS.md immediately when created
- **NEVER** report progress based on code written - only on functionality working

### RULE 5: Test-Driven Validation
- **ALWAYS** write at least one test for new functionality
- **ALWAYS** run tests before committing code
- **NEVER** disable failing tests to make the suite pass
- **ALWAYS** test the integration points, not just units

## Development Workflow Rules

### RULE 6: Commit Discipline
```bash
# After completing each task:
1. Run tests: npm test
2. Check for mocks: grep -r "mock" --exclude-dir=node_modules .
3. Update TASKS.md
4. Update TODOS.md if any shortcuts taken
5. Commit with clear message: "TASK-XXX: [Description]"
6. Push to repository
```

### RULE 7: Tracer Bullet Development
For each new feature:
1. Create minimal end-to-end flow first
2. Verify it works with real data
3. Then enhance with additional functionality
4. Never build all components before testing integration

### RULE 8: Error Handling First
- **ALWAYS** implement error cases before success cases
- **ALWAYS** test with invalid input before valid input
- **NEVER** assume happy path only
- **ALWAYS** provide meaningful error messages

## Verification Rules

### RULE 9: Definition of "Working"
A feature is only "working" when:
- [ ] It processes real data (not mocks)
- [ ] It handles errors gracefully
- [ ] It integrates with other components
- [ ] It has at least one passing test
- [ ] It meets all acceptance criteria from REQUIREMENTS.md

### RULE 10: Progress Verification
Before reporting progress:
1. Actually run the application
2. Test the specific functionality
3. Verify data persistence (if applicable)
4. Check integration points
5. Review against requirements

## Communication Rules

### RULE 11: Uncertainty Protocol
When uncertain:
- **ASK** for clarification rather than assume
- **DOCUMENT** assumptions if proceeding anyway
- **FLAG** risks and concerns immediately
- **SUGGEST** alternatives when blocked

### RULE 12: Problem Escalation
When encountering issues:
1. Document the specific problem
2. Explain what was attempted
3. Identify what's blocking progress
4. Propose potential solutions
5. Ask for guidance if needed

## Code Quality Rules

### RULE 13: No Shortcuts in Core Path
- **NEVER** use shortcuts in critical user paths
- **NEVER** use console.log as permanent logging
- **NEVER** hardcode values that should be configurable
- **ALWAYS** handle async operations properly

### RULE 14: Documentation Sync
- **ALWAYS** update documentation when changing code
- **ALWAYS** keep API documentation current
- **ALWAYS** update README for setup changes
- **NEVER** let documentation drift from reality

## Deployment Rules

### RULE 15: Pre-Deployment Verification
Before ANY deployment:
- [ ] All TODOS.md critical items resolved
- [ ] All tests passing
- [ ] No console.log statements in production code
- [ ] Environment variables properly configured
- [ ] Deployment documented in DEPLOY.md

## AI-Specific Rules

### RULE 16: Context Awareness
At the start of each session:
1. Read OVERVIEW.md
2. Check TODOS.md for pending items
3. Review current TASKS.md status
4. Verify no RULES have been violated

### RULE 17: Assumption Documentation
When making assumptions:
```markdown
## ASSUMPTION: [Title]
**Made in**: [File/Function]
**Assumption**: [What is being assumed]
**Risk**: [What could go wrong]
**Validation Needed**: [How to verify]
```

### RULE 18: Mock Data Protocol
If mock data is absolutely necessary:
1. Add TODO entry IMMEDIATELY
2. Mark with clear comment: `// MOCK: TODO-XXX`
3. Set timeline for replacement
4. Never use in production paths

### RULE 19: Session Handoff Protocol
When ending a session, ALWAYS provide:
1. Last working commit hash
2. Specific file:line of current work
3. Next concrete step (not abstract)
4. Any unresolved assumptions
5. Current CONVERGENCE.md score

When starting a session, ALWAYS:
1. Run the application first
2. Test the last claimed feature
3. Verify the handoff claims
4. Check for uncommitted changes

## Enforcement

### Violations
If a rule is violated:
1. Stop current work
2. Document the violation
3. Fix the violation before proceeding
4. Update processes to prevent recurrence

### Exceptions
Exceptions to rules require:
- Explicit justification
- Documentation in relevant files
- Time-bound resolution plan
- Approval from project lead

## Rule Priority
When rules conflict:
1. Safety and Security
2. Data Integrity  
3. User Experience
4. Code Quality
5. Development Speed

## Continuous Improvement
- Review rules weekly
- Update based on lessons learned
- Remove rules that no longer apply
- Add rules for new problem patterns

## Checklist for Every Task
Before starting:
- [ ] Read relevant requirements
- [ ] Check design constraints
- [ ] Review existing patterns

During development:
- [ ] Follow tracer bullet approach
- [ ] Test continuously
- [ ] Document shortcuts

Before completing:
- [ ] End-to-end testing done
- [ ] No mock data (or documented)
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Integration verified

## AI Anti-Patterns (DO NOT DO THESE)

### ANTI-PATTERN 1: The Mock Cascade
**What AI Does**: Creates mock for Service A, which needs mock for Service B, which needs mock for Service C...
**Why It's Bad**: Creates interconnected fake system that looks like progress
**Instead**: Build ONE real integration at a time

### ANTI-PATTERN 2: The Refactor Rabbit Hole  
**What AI Does**: "While implementing X, I noticed Y could be better, so I refactored Z..."
**Why It's Bad**: Breaks working code, introduces bugs, delays deployment
**Instead**: Document improvement in TODOS.md, stay focused on current task

### ANTI-PATTERN 3: The Feature Creep
**What AI Does**: "I also added user preferences, dark mode, and animations"
**Why It's Bad**: Exponentially increases complexity and bug surface
**Instead**: ONLY implement what's in REQUIREMENTS.md

## Living Documentation Generator Specific Rules

### RULE 20: Real Code Analysis Only
- **NEVER** use hardcoded function lists or sample documentation
- **NEVER** return mock AST results instead of parsing actual files
- **ALWAYS** test with real TypeScript/JavaScript/Python files
- **ALWAYS** verify documentation reflects actual code structure

### RULE 21: Performance is a Feature
- **NEVER** implement features that break the <5 second update requirement
- **ALWAYS** measure actual update times from file save to UI refresh
- **NEVER** load entire projects into memory at once
- **ALWAYS** implement incremental updates, not full regeneration

### RULE 22: MCP Integration Reality
- **NEVER** stub MCP protocol handlers - they must actually work with Kiro
- **NEVER** fake tool responses - implement real functionality
- **ALWAYS** test MCP server integration within actual Kiro environment
- **ALWAYS** handle MCP protocol errors gracefully

### RULE 23: Zero-Config Principle
- **NEVER** require users to configure file types or project structure manually
- **NEVER** fail if configuration files are missing
- **ALWAYS** provide intelligent defaults that work for 80% of projects
- **ALWAYS** auto-detect project type, language, and structure

### RULE 24: Demo-Driven Development
- **NEVER** build features that won't be visible in the demo
- **ALWAYS** prioritize features that showcase the core value proposition
- **NEVER** spend time on edge cases before core functionality works
- **ALWAYS** ensure each completed task contributes to a demoable workflow
