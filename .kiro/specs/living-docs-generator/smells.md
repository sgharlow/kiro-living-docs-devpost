# SMELLS.md - Early Warning Signs

## Smell 1: Mock Documentation Generation
**Warning**: Creating fake/sample documentation instead of parsing real code
**Action**: STOP - Ensure all documentation comes from actual code analysis
**Example**: Hardcoded function lists instead of AST parsing

## Smell 2: Update Time Creeping Up
**Warning**: Documentation updates taking >10 seconds (target: <5s)
**Action**: STOP - Profile and optimize before adding more features
**Example**: Full project re-analysis on every file change

## Smell 3: The "Just One More Language" Pattern
**Warning**: Adding language support without completing current ones
**Action**: STOP - Finish TypeScript/JavaScript fully before expanding
**Example**: Starting Python parser while TS parser still has gaps

## Smell 4: No Real Integration Testing
**Warning**: Components work in isolation but not together
**Action**: STOP - Test full MCP server → Kiro → Web UI flow
**Example**: File watcher works, analyzer works, but updates don't reach UI

## Smell 5: Memory Usage Growing Unchecked
**Warning**: Memory usage >200MB or growing continuously
**Action**: STOP - Implement caching limits and garbage collection
**Example**: Keeping all analysis results in memory indefinitely

## Smell 6: Complex Configuration Required
**Warning**: Users need extensive setup to get basic functionality
**Action**: STOP - Simplify to zero-config for common cases
**Example**: Requiring manual file type mapping instead of auto-detection

## Smell 7: Web UI Becoming a Separate Project
**Warning**: Frontend complexity overwhelming the core documentation logic
**Action**: STOP - Keep UI simple, focus on content quality
**Example**: Building complex React components instead of simple HTML

## Smell 8: Git Analysis Blocking Core Features
**Warning**: Spending too much time on git history instead of current code
**Action**: STOP - Git analysis is enhancement, not core requirement
**Example**: Complex commit message parsing while basic function docs missing

## Smell 9: Perfect Parser Syndrome
**Warning**: Trying to handle every edge case in language parsing
**Action**: STOP - Handle 80% of common cases, graceful degradation for rest
**Example**: Spending hours on obscure TypeScript syntax instead of basic classes

## Smell 10: Demo Drift
**Warning**: Building features that won't be visible in demo
**Action**: STOP - Focus on features that showcase the core value proposition
**Example**: Advanced search features before basic documentation generation works

## Emergency Stop Triggers

### Immediate Stop Required
- Documentation generation taking >30 seconds
- Memory usage >500MB
- More than 10 critical TODOs
- No working end-to-end flow after 4 hours of work
- Unable to demo core functionality

### Review and Reassess Required
- DRS score hasn't improved in 2 hours
- Working on 4th different component without completing any
- Adding dependencies not in original design
- Test coverage dropping below 50%
- Kiro integration points not working

## Recovery Actions

### When Smell Detected
1. **Document the smell** in TODOS.md with specific examples
2. **Stop current work** and assess scope creep
3. **Return to TASKS.md** and verify current task alignment
4. **Run reality check** - does current work contribute to next milestone?
5. **Simplify approach** - what's the minimal implementation that works?

### Pattern Recognition
- **Scope Creep**: Adding features not in REQUIREMENTS.md
- **Perfectionism**: Polishing one component while others are broken
- **Integration Avoidance**: Building components in isolation
- **Performance Ignorance**: Not measuring actual performance metrics
- **Demo Disconnect**: Building features that won't be shown