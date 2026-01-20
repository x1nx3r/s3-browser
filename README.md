# KMP Backup Browser

S3 browser for KMP database backups with preview and diff.

## Setup

```bash
cp .env.example .env
# Add SPACES_KEY and SPACES_SECRET
bun install
bun run dev
```

## Features

- Browse S3/Spaces bucket with folder navigation
- Preview SQL dumps with syntax highlighting
- Compare two backups with diff view
- Download files as `.sql`

## Environment

```
SPACES_KEY=your_key
SPACES_SECRET=your_secret
```
