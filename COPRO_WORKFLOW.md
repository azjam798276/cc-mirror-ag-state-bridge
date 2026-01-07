# COPRO Optimization Workflow

End-to-end workflow for optimizing all skill adapters in cc-mirror-ag-state-bridge.

---

## Prerequisites

```bash
# Ensure you're in the project root
cd /home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge

# Verify gemini-cli works
gemini --version  # Should return 0.22.5+

# Verify Python environment
../.venv/bin/python --version  # Should return Python 3.10+

# Verify test infrastructure
npm test  # Should run, some failures expected
```

---

## Phase 1: Initial COPRO Optimization (All Roles)

Run COPRO optimization for each role. Target: 5 rollouts, 3 depth iterations.

### 1.1 Backend Engineer (Already Done ✅)
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill backend-engineer \
  --trainset "stories/state-bridge/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x" \
  --verbose
```

### 1.2 Frontend Engineer
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill frontend-engineer \
  --trainset "stories/cli/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x, commander, chalk" \
  --verbose
```

### 1.3 Security Engineer
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill security-engineer \
  --trainset "stories/oauth/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x, keytar, crypto" \
  --verbose
```

### 1.4 QA Engineer
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill qa-engineer \
  --trainset "stories/state-bridge/*.md" "stories/oauth/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x, Jest" \
  --verbose
```

### 1.5 DevOps Engineer
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill devops-engineer \
  --trainset "stories/cli/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, GitHub Actions, npm" \
  --verbose
```

### 1.6 Product Manager
```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill product-manager \
  --trainset "stories/state-bridge/*.md" "stories/cli/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x" \
  --verbose
```

---

## Phase 2: Collect Scores

After Phase 1, record scores for each role:

| Role | Score (%) | Needs Few-Shot? |
|------|-----------|-----------------|
| backend-engineer | TBD | TBD |
| frontend-engineer | TBD | TBD |
| security-engineer | TBD | TBD |
| qa-engineer | TBD | TBD |
| devops-engineer | TBD | TBD |
| product-manager | TBD | TBD |

**Threshold:** < 75% requires few-shot examples

---

## Phase 3: Few-Shot Bootstrap (For Roles < 75%)

### 3.1 Create Golden Examples

For each role scoring < 75%, create golden examples in:
```
golden-examples/{role}/
├── example-001.md
├── example-002.md
└── example-003.md
```

Example format:
```markdown
---
id: "example-001"
role: "backend-engineer"
story: "session_discovery"
---

# Problem
{Copy story context here}

# Solution
{Provide ideal implementation code}

# Reasoning
{Explain why this solution is correct}
```

### 3.2 Run Bootstrap Optimization

```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill {ROLE_NAME} \
  --trainset "stories/{category}/*.md" \
  --gemini-binary gemini \
  --max-rollouts 5 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x" \
  --examples-dir "golden-examples/{ROLE_NAME}" \
  --bootstrap \
  --verbose
```

---

## Phase 4: Retrospective Optimization (For Roles Still < 75%)

### 4.1 Analyze Failure Logs

```bash
# View recent optimization logs
ls -la .dspy_cache/trace_logs/

# Inspect failure patterns
cat .dspy_cache/trace_logs/rollout_*.json | jq '.feedback'
```

### 4.2 Semantic Matching Optimization

If bootstrap didn't help, try semantic matching:

```bash
GEMINI_MODEL=gemini-2.5-flash ../.venv/bin/python ../optimizer/optimize.py \
  --skill {ROLE_NAME} \
  --trainset "stories/{category}/*.md" \
  --gemini-binary gemini \
  --max-rollouts 10 \
  --repo-root . \
  --tech-stack "Node.js 18+, TypeScript 5.x" \
  --examples-dir "golden-examples/{ROLE_NAME}" \
  --semantic \
  --top-k 5 \
  --verbose
```

### 4.3 Manual SKILL.md Refinement

If scores remain < 75%:

1. Review failure feedback in trace logs
2. Identify common error patterns
3. Add explicit constraints to `skills/{role}/SKILL.md`:
   - Add "NEVER do X" rules
   - Add "ALWAYS verify Y before Z" patterns
   - Add specific edge case handling

4. Re-run optimization with updated SKILL.md

---

## Phase 5: Validation

### 5.1 Run All Tests
```bash
npm test
```

### 5.2 Final Score Summary

Update the score table with final results:

| Role | Initial | After Bootstrap | After Retro | Final |
|------|---------|-----------------|-------------|-------|
| backend-engineer | TBD | TBD | TBD | TBD |
| frontend-engineer | TBD | TBD | TBD | TBD |
| security-engineer | TBD | TBD | TBD | TBD |
| qa-engineer | TBD | TBD | TBD | TBD |
| devops-engineer | TBD | TBD | TBD | TBD |
| product-manager | TBD | TBD | TBD | TBD |

### 5.3 Commit Results

```bash
git add skills/*/adapter.md skills/*/diffs/
git commit -m "chore: COPRO optimization for all roles"
```

---

## Quick Reference

### Environment Variables
- `GEMINI_MODEL`: Model to use (default: auto-selected by CLI)
- `AG_SESSION_DIR`: Override Antigravity session search path

### Key Directories
- `skills/`: Role definitions and optimized adapters
- `stories/`: Training stories by category
- `golden-examples/`: Few-shot examples for bootstrap
- `.dspy_cache/`: Optimization cache and trace logs

### Success Criteria
- All roles ≥ 75% score
- No regression in previously passing tests
- adapter.md files are coherent and actionable
