# GitHub Actions Code Review Automation

**Source:** https://www.propelcode.ai/blog/continuous-integration-code-quality-gates-setup-guide
**Relevance:** Engineering Director - Code Review Automation

## Code Snippet
```typescript
// scripts/automated-review.ts
import * as github from '@actions/github';
import * as core from '@actions/core';

interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: "error" | "warning" | "info";
}

interface ReviewResult {
  approved: boolean;
  comments: ReviewComment[];
  summary: string;
}

class AutomatedCodeReviewer {
  private octokit: ReturnType<typeof github.getOctokit>;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<ReviewResult> {
    console.log(`[Director] Reviewing PR #${pullNumber}`);

    const comments: ReviewComment[] = [];

    // Get PR files
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber
    });

    // Review each file
    for (const file of files) {
      const fileComments = await this.reviewFile(file);
      comments.push(...fileComments);
    }

    // Check overall quality
    const summary = this.generateSummary(files, comments);
    const approved = comments.filter(c => c.severity === "error").length === 0;

    // Post review
    await this.postReview(owner, repo, pullNumber, {
      approved,
      comments,
      summary
    });

    return { approved, comments, summary };
  }

  private async reviewFile(file: any): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];
    const patch = file.patch || "";
    const lines = patch.split('\n');

    // Check file size
    if (file.changes > 500) {
      comments.push({
        path: file.filename,
        line: 1,
        body: "⚠️ File has >500 changes. Consider splitting into smaller PRs for easier review.",
        severity: "warning"
      });
    }

    // Check for TODOs
    lines.forEach((line, idx) => {
      if (line.includes('TODO') || line.includes('FIXME')) {
        comments.push({
          path: file.filename,
          line: idx + 1,
          body: "❗ TODO/FIXME found. Consider addressing before merge or creating a tracking issue.",
          severity: "info"
        });
      }

      // Check for console.log
      if (line.includes('console.log') && !file.filename.includes('.test.')) {
        comments.push({
          path: file.filename,
          line: idx + 1,
          body: "🚫 `console.log` should be removed or replaced with proper logging.",
          severity: "error"
        });
      }

      // Check for any/unknown types
      if (line.match(/:\s*any\b/) || line.match(/as\s+any\b/)) {
        comments.push({
          path: file.filename,
          line: idx + 1,
          body: "⚠️ Avoid using `any` type. Use specific types or `unknown` with type guards.",
          severity: "warning"
        });
      }
    });

    return comments;
  }

  private generateSummary(files: any[], comments: ReviewComment[]): string {
    const errors = comments.filter(c => c.severity === "error").length;
    const warnings = comments.filter(c => c.severity === "warning").length;

    let summary = `## Automated Code Review Summary\n\n`;
    summary += `**Files Changed:** ${files.length}\n`;
    summary += `**Total Changes:** ${files.reduce((sum, f) => sum + f.changes, 0)} lines\n\n`;

    if (errors === 0 && warnings === 0) {
      summary += `✅ No issues detected. Code looks good!\n`;
    } else {
      summary += `**Issues Found:**\n`;
      if (errors > 0) summary += `- 🚫 ${errors} error(s) (must fix)\n`;
      if (warnings > 0) summary += `- ⚠️ ${warnings} warning(s) (should fix)\n`;
      summary += `\n`;
    }

    summary += `\n---\n`;
    summary += `*This review was performed automatically by Engineering Director Bot*\n`;

    return summary;
  }

  private async postReview(
    owner: string,
    repo: string,
    pullNumber: number,
    result: ReviewResult
  ): Promise<void> {
    await this.octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      event: result.approved ? 'APPROVE' : 'REQUEST_CHANGES',
      body: result.summary,
      comments: result.comments.map(c => ({
        path: c.path,
        line: c.line,
        body: c.body
      }))
    });

    console.log(`[Director] Review posted: ${result.approved ? 'APPROVED' : 'CHANGES_REQUESTED'}`);
  }
}

// GitHub Actions workflow integration
async function main() {
  const token = core.getInput('github-token');
  const context = github.context;

  if (!context.payload.pull_request) {
    core.setFailed('This action only works on pull requests');
    return;
  }

  const reviewer = new AutomatedCodeReviewer(token);

  const result = await reviewer.reviewPullRequest(
    context.repo.owner,
    context.repo.repo,
    context.payload.pull_request.number
  );

  if (!result.approved) {
    core.setFailed(`Code review failed with ${result.comments.filter(c => c.severity === 'error').length} error(s)`);
  }
}

if (require.main === module) {
  main().catch(error => core.setFailed(error.message));
}
```

## Why This Works
- Integrates directly with GitHub PR workflow
- Severity levels (error, warning, info) guide prioritization
- Line-specific comments provide precise feedback
- Automated checks catch common issues before human review
- Summary provides at-a-glance status
