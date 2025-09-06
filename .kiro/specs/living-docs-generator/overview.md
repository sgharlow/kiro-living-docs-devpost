# OVERVIEW.md

## Project Context
The Living Documentation Generator is an intelligent MCP server for Kiro that automatically generates, maintains, and updates project documentation in real-time. This project solves the universal developer problem of outdated documentation by treating documentation as a living artifact that evolves with code, rather than a static snapshot. The system focuses on zero-configuration deployment, beautiful presentation, and deep Kiro integration to showcase advanced IDE capabilities.

## Architecture Philosophy
- **Real-time First**: Documentation updates within 5 seconds of code changes, not batch processes
- **Zero Configuration**: Works out-of-the-box with intelligent project detection and sensible defaults
- **Multi-language Support**: Unified documentation across JavaScript/TypeScript, Python, and Go codebases
- **Kiro Integration**: Leverages steering files, hooks, and contextual awareness for seamless workflow integration
- **Performance Focused**: Sub-5-second updates, <100MB memory usage, handles 1000+ file projects efficiently
- **Beautiful by Default**: Modern, responsive web UI with search, navigation, and interactive examples

## Documentation Structure

This project uses a structured documentation approach to guide development and prevent common AI-assisted development pitfalls:

### Core Documentation Files

| File | Purpose | Update Frequency | AI Usage |
|------|---------|-----------------|----------|
| **OVERVIEW.md** | Project context and documentation map | As needed | Read first for context |
| **DESIGN.md** | System architecture and technical specifications | When architecture changes | Reference for all technical decisions |
| **REQUIREMENTS.md** | Business requirements and user stories | When scope changes | Validate all features against this |
| **TASKS.md** | Implementation roadmap and progress tracking | Daily during development | Check before starting any work |
| **TODOS.md** | Temporary shortcuts and technical debt | After each shortcut taken | Must clear before deployment |
| **DEPLOY.md** | Deployment procedures and configurations | When deployment changes | Follow exactly for deployments |
| **RULES.md** | Development constraints and AI guidelines | Rarely | Must follow for every task |
| **CONVERGENCE.md** | Deployment readiness tracking | Every 2 hours during dev | Measures real progress toward deployment |
| **SMELLS.md** | Early warning signs of problems | Reference only | Check when something feels wrong |

### Documentation Hierarchy
```
RULES.md (Highest Priority - Overrides everything)
    ↓
REQUIREMENTS.md (Defines what to build)
    ↓
DESIGN.md (Defines how to build it)
    ↓
TASKS.md (Defines build sequence)
    ↓
CONVERGENCE.md (Tracks deployment readiness)
    ↓
TODOS.md (Tracks temporary compromises)
    ↓
SMELLS.md (Identifies problems early)
    ↓
DEPLOY.md (Defines release process)
```

### How These Files Work Together

#### 1. **RULES.md** - The Constitution
- Overrides all other documentation and AI suggestions
- Enforces discipline around mocks, testing, and scope
- Creates specific protocols for common problems
- Links to TODOS.md for debt tracking (Rule 1, 4, 18)
- References REQUIREMENTS.md for scope control (Rule 3)
- Points to DESIGN.md for architecture governance (Rule 2)
- Includes Anti-Patterns section to prevent common AI mistakes
- Defines Session Handoff Protocol for continuity

#### 2. **REQUIREMENTS.md** - The Contract
- Defines what success looks like
- Used by RULES.md to prevent scope creep
- Referenced by TASKS.md to map work to business value
- Validated against by DESIGN.md to ensure feasibility
- Acceptance criteria used to verify task completion
- Feeds into CONVERGENCE.md scoring

#### 3. **DESIGN.md** - The Blueprint
- Constrains technical decisions
- Referenced by RULES.md to prevent architecture drift
- Guides TASKS.md implementation approach
- Defines integration points that TODOS.md tracks
- Informs DEPLOY.md infrastructure needs
- Contains Integration Test Matrix for tracking real connections

#### 4. **TASKS.md** - The Roadmap
- Breaks down REQUIREMENTS.md into implementable chunks
- Must respect DESIGN.md architecture
- Creates TODOS.md entries when shortcuts taken
- Updates trigger RULES.md verification protocols
- Completed tasks must pass REQUIREMENTS.md criteria
- Includes Reality Check questions for each task
- Directly impacts CONVERGENCE.md score

#### 5. **CONVERGENCE.md** - The Progress Tracker (NEW)
- Provides objective Deployment Readiness Score (DRS)
- Breaks progress into measurable milestones
- Forces focus on deployable increments
- Updated every 2 hours during active development
- Prevents false sense of progress
- Clear metrics for "done"

#### 6. **TODOS.md** - The Debt Ledger
- Created by TASKS.md during implementation
- Enforced by RULES.md (must document all shortcuts)
- Blocks DEPLOY.md (critical items must be resolved)
- Reveals gaps between REQUIREMENTS.md and reality
- Shows where DESIGN.md ideals were compromised
- Directly impacts CONVERGENCE.md score

#### 7. **SMELLS.md** - The Early Warning System (NEW)
- Identifies patterns that indicate problems
- Referenced when development feels "off"
- Triggers mandatory stops and reviews
- Prevents small issues from becoming large ones
- Companion to RULES.md for problem prevention

#### 8. **DEPLOY.md** - The Release Gate
- Blocked by critical items in TODOS.md
- Requires minimum CONVERGENCE.md score
- Implements architecture from DESIGN.md
- Deploys features from REQUIREMENTS.md
- Follows procedures enforced by RULES.md
- Validates completed items from TASKS.md

## Quick Start for AI Assistants

1. **First Time**: Read all documentation files in hierarchy order
2. **Each Session**: 
   - Review RULES.md first (non-negotiable)
   - Check CONVERGENCE.md score and trend
   - Check TODOS.md for critical items
   - Review TASKS.md for next priority
   - Reference REQUIREMENTS.md for scope
   - Consult DESIGN.md for how-to
   - Watch for patterns in SMELLS.md
3. **Each Task**: 
   - Answer Reality Check questions in TASKS.md
   - Verify alignment with REQUIREMENTS.md
   - Follow patterns in DESIGN.md
   - Update TASKS.md progress
   - Add shortcuts to TODOS.md
   - Follow RULES.md absolutely
   - Check if any SMELLS.md patterns emerging
4. **Every 2 Hours**:
   - Update CONVERGENCE.md score
   - Run Checkpoint Protocol from RULES.md
   - Execute automated verification scripts
5. **Each Commit**: 
   - Run validation checks from RULES.md
   - Update relevant documentation
   - Ensure no undocumented mocks
   - Verify CONVERGENCE.md score improved

## Project Status Dashboard

**Current Phase**: Pre-Implementation (Setup)
**Completion**: 0% - Documentation framework established
**Deployment Readiness Score**: 0/100

### Health Indicators
| Metric | Status | Target |
|--------|--------|--------|
| Tasks Complete | 0/20 | 100% |
| Critical TODOs | 0 | 0 |
| Test Coverage | 0% | 80% |
| Documented Mocks | 0 | 0 |
| Architecture Violations | 0 | 0 |
| DRS Score | 0 | 85+ |
| Active Smells | 0 | 0 |

### Current Blockers
None - Ready to begin implementation

### Next Milestone
Walking Skeleton (DRS: 25+) - Single end-to-end flow with real data

## Key Constraints
- Budget: Development time only (no external services)
- Timeline: Demo-ready implementation
- Team Size: 1 developer + AI assistant
- Technical: Must work as MCP server, TypeScript/Node.js based, zero external dependencies for core functionality

## Success Criteria
<!-- How we know when the project is truly complete -->
- [ ] All REQUIREMENTS.md acceptance criteria pass
- [ ] Zero critical items in TODOS.md
- [ ] TASKS.md shows 100% completion
- [ ] CONVERGENCE.md DRS score ≥ 85
- [ ] DEPLOY.md procedures executed successfully
- [ ] No violations of RULES.md
- [ ] No active patterns from SMELLS.md

## Common Pitfalls and How Documentation Prevents Them

| Pitfall | Prevention Mechanism |
|---------|---------------------|
| Mock data hidden in code | RULES.md Rule 1 + TODOS.md tracking + Automated scripts |
| Scope creep | RULES.md Rule 3 + Anti-Patterns + REQUIREMENTS.md boundaries |
| Architecture drift | RULES.md Rule 2 + DESIGN.md constraints + Integration Matrix |
| False progress | CONVERGENCE.md scoring + Reality Checks + SMELLS.md patterns |
| Deployment surprises | TODOS.md critical items + DEPLOY.md checklist + DRS score |

## Automated Verification Scripts

### Mock Detection
```bash
#!/bin/bash
# mock-check.sh
echo "Checking for undocumented mocks..."
MOCK_COUNT=$(grep -r "mock\|stub\|fake\|TODO\|FIXME" . \
  --exclude-dir=node_modules \
  --exclude="*.md" | wc -l)
TODO_COUNT=$(grep -c "TODO-" TODOS.md)
if [ $MOCK_COUNT -gt $TODO_COUNT ]; then
  echo "ERROR: Found $MOCK_COUNT mocks but only $TODO_COUNT documented"
  exit 1
fi
```

### Architecture Compliance
```bash
#!/bin/bash
# arch-check.sh
echo "Checking architecture compliance..."
# Check for unauthorized dependencies (customize for your package manager)
npm ls --depth=0 | grep -v -f allowed-deps.txt > unauthorized.txt
if [ -s unauthorized.txt ]; then
  echo "ERROR: Unauthorized dependencies found"
  cat unauthorized.txt
  exit 1
fi
```

### Integration Reality Check
```bash
#!/bin/bash
# integration-check.sh
echo "Checking integration points..."
# Count working integrations from DESIGN.md matrix
WORKING=$(grep -c "✅ Working" DESIGN.md)
TOTAL=$(grep -c "| .* | .* | .* | .* |" DESIGN.md)
echo "Integration Status: $WORKING/$TOTAL working"
if [ $WORKING -lt $((TOTAL/2)) ]; then
  echo "WARNING: Less than 50% of integrations working"
  exit 1
fi
```

### Convergence Trend
```bash
#!/bin/bash
# convergence-trend.sh
# Track if we're actually converging on deployment
CURRENT_SCORE=$(grep "Current Score:" CONVERGENCE.md | grep -o "[0-9]*")
YESTERDAY_SCORE=$(git show HEAD~5:CONVERGENCE.md 2>/dev/null | grep "Current Score:" | grep -o "[0-9]*" || echo 0)
if [ $CURRENT_SCORE -le $YESTERDAY_SCORE ]; then
  echo "WARNING: No progress in deployment readiness"
  echo "Yesterday: $YESTERDAY_SCORE, Today: $CURRENT_SCORE"
  exit 1
fi
```

## Documentation Maintenance Schedule

- **Every 2 Hours (During Dev)**: Update CONVERGENCE.md score
- **Daily**: Update TASKS.md and TODOS.md
- **Weekly**: Review RULES.md violations, update OVERVIEW.md status, check SMELLS.md patterns
- **Per Sprint**: Update REQUIREMENTS.md if scope changes
- **Per Release**: Update DEPLOY.md with lessons learned
- **As Needed**: Update DESIGN.md for architecture changes

## For Human Developers

When working with AI assistants:
1. Start each session by having AI read this OVERVIEW.md
2. Use RULES.md as your enforcement mechanism
3. Monitor CONVERGENCE.md score - it should always be increasing
4. Check TODOS.md to ensure AI isn't hiding problems
5. Verify TASKS.md claims against actual functionality
6. Watch for SMELLS.md patterns emerging
7. Never let AI modify REQUIREMENTS.md without approval
8. Run verification scripts frequently

## For AI Assistants

Your prime directives:
1. RULES.md is absolute and cannot be overridden
2. Every mock/shortcut goes in TODOS.md immediately
3. Tasks are only complete when they actually work
4. Architecture in DESIGN.md is fixed unless explicitly told otherwise
5. Scope in REQUIREMENTS.md is fixed unless explicitly told otherwise
6. CONVERGENCE.md score must increase or explain why not
7. Stop immediately if any SMELLS.md pattern detected

## Validation Commands

```bash
# Quick health check
./scripts/mock-check.sh
./scripts/arch-check.sh
./scripts/integration-check.sh
./scripts/convergence-trend.sh

# Manual checks
grep -c "TODO" TODOS.md  # Should trend toward 0
grep -c "[x]" TASKS.md   # Should trend toward total tasks
grep "Current Score" CONVERGENCE.md  # Should trend toward 100

# Full validation
./scripts/validate-all.sh  # Runs all checks
```

## Emergency Recovery

If the project gets off track:
1. Stop all work
2. Check CONVERGENCE.md score - has it been declining?
3. Review SMELLS.md - which patterns are present?
4. Run full validation suite
5. Review this OVERVIEW.md
6. Check each file against reality
7. Update documentation to match actual state
8. Resume work from clean baseline

## Demo Materials and Presentation

### Demo Project Structure
The project includes a comprehensive demo showcasing all features:

- **Multi-language Demo Project** (`demo/`): Complete application with TypeScript, Python, and Go components
- **Demo Script** (`demo/DEMO_SCRIPT.md`): 15-20 minute presentation flow with key talking points
- **Installation Guide** (`demo/INSTALLATION.md`): Comprehensive setup instructions for all environments
- **Demo Guide** (`demo/DEMO_GUIDE.md`): Interactive walkthrough of all features and scenarios

### Demo Components
- **Frontend**: React TypeScript application (`demo/frontend/`)
- **Backend**: Node.js Express API server (`demo/backend/`)
- **Python Service**: Flask microservice with analytics (`demo/python-service/`)
- **Go Service**: HTTP service with gRPC endpoints (`demo/go-service/`)

### Test Suites for Demo Validation
- **Unit Tests** (`demo/tests/unit/`): Core functionality validation
- **Integration Tests** (`demo/tests/integration/`): End-to-end workflow testing
- **Performance Tests** (`demo/tests/performance/`): Scalability benchmarking
- **Acceptance Tests** (`demo/tests/acceptance/`): User workflow validation

### Demo Scenarios
1. **Zero-Configuration Setup**: Automatic project detection and documentation generation
2. **Real-Time Updates**: Live documentation changes as code is modified
3. **Multi-Language Analysis**: Comprehensive support across TypeScript, Python, and Go
4. **Beautiful Web Interface**: Modern, responsive documentation with search and navigation
5. **Performance at Scale**: Handling large projects with sub-5-second updates
6. **Advanced Features**: API documentation, architecture diagrams, analytics insights

## Notes
<!-- Any additional context about how documentation works for this specific project -->