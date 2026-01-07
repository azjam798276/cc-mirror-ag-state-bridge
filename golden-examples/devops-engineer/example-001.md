---
id: "example-devops-001"
role: "devops-engineer"
story: "list_ag_sessions_command"
---

# Problem
The user wants to list all Antigravity sessions using the CLI. The command should be fast, color-coded, and handle environment variable overrides for the session directory.

# Solution

## 1. Environment Variable Prioritization
```typescript
function getSessionDirs(): string[] {
  const customDir = process.env.AG_SESSION_DIR;
  if (customDir) return [customDir];
  
  // Platform specific defaults
  return [
    path.join(os.homedir(), '.antigravity', 'sessions'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'sessions')
  ];
}
```

## 2. Fast Metadata Listing
```typescript
async function listSessions() {
  const dirs = getSessionDirs();
  const sessions: AGSession[] = [];
  
  for (const dir of dirs) {
    if (!await fs.pathExists(dir)) continue;
    const files = await fs.readdir(dir);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const stats = await fs.stat(path.join(dir, file));
      sessions.push({ 
        id: path.basename(file, '.json'),
        mtime: stats.mtime 
      });
    }
  }
  return sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}
```

## 3. Formatted CLI Output
```typescript
import chalk from 'chalk';

function printSessions(sessions: AGSession[]) {
  if (sessions.length === 0) {
    console.log(chalk.yellow('⚠️ No Antigravity sessions found.'));
    return;
  }
  
  console.log(chalk.bold('\nRecent Antigravity Sessions:\n'));
  sessions.forEach(s => {
    console.log(`  ${chalk.green('ID:')} ${s.id.padEnd(12)} ${chalk.dim(s.mtime.toLocaleString())}`);
  });
}
```

# Reasoning
This solution follows the thin CLI mandate by only parsing and formatting. It uses `fs-extra` and `path.join` as required by the role's tech stack and implements the lazy metadata strategy to keep discovery fast.
