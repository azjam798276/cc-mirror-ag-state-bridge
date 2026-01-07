---
id: "example-pm-001"
role: "product-manager"
story: "session_discovery"
---

# Problem
The user wants to find Antigravity sessions on their local machine. We need to handle multiple possible locations and provide a consistent way to identify them.

# Solution

## 1. Multi-Path Strategy
We will search in the following order:
- User-specified directory via `AG_SESSION_DIR`
- Default Antigravity session store in the home directory
- OS-specific application support directories (macOS, Linux, Windows)

## 2. Mandatory Metadata
Every discovered session must include:
- `sessionId`: Unique identifier
- `filePath`: Full path for parsing
- `timestamp`: Last modified time for sorting
- `status`: Baseline status (e.g., 'discovered')

## 3. Graceful Fallbacks
If no sessions are found in any path, return an empty set. Log a clear notice to the user if a provided custom directory is inaccessible.

# Reasoning
This solution aligns with the product goal of seamless continuation by prioritizing user intent (custom dir) while ensuring robust discovery across all supported platforms. It minimizes friction by automating the search process.
