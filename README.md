# KMP Backup Browser

A web app for browsing database backups that exist somewhere in the cloud because apparently we don't trust local storage anymore. It connects to DigitalOcean Spaces (which is just S3 wearing a different hat) and lets you browse, preview, and diff SQL dumps. Built with Next.js because apparently React alone wasn't enough abstraction.

## What This Thing Actually Does

It's a file browser for database backups. You navigate folders, click on a `.dmp` file, and it streams the entire thing into a Monaco Editor so you can stare at SQL like you're in The Matrix. The actually useful part is the diff view — select two backups and see exactly what changed between Tuesday's data and Wednesday's disaster.

### Folder Navigation (The File Manager You Didn't Ask For)
- Browse S3 buckets with a folder tree that flattens deeply nested paths into something readable
- Friendly names for folders because `mysql-database-uc4w4000k4sgo40k0s4ccws4` is not a name, it's a hex curse
- Breadcrumb navigation for going back because the browser's back button would break everything
- Counts folders and files at the bottom so you know exactly how much backup data is haunting you

### SQL Preview (Staring at Data Like It Owes You Money)
- Monaco Editor with a custom "terminal-blue" theme because looking at SQL should feel cinematic
- Streams file content chunk by chunk with a live byte counter so you feel productive waiting
- Syntax highlighting for SQL because reading raw dumps without colors is a form of self-harm
- Minimap enabled because scrolling through 200MB of `INSERT INTO` statements needs GPS

### Diff Comparison (Find The Bug Someone Else Introduced)
- Select any two backup files with checkboxes like it's a grocery list
- Side-by-side Monaco DiffEditor showing additions in green and deletions in red
- Useful for figuring out which table lost 10,000 rows between yesterday and today
- Limited to 2 files because three-way diffs are for people who enjoy suffering

### File Download (The Escape Hatch)
- Downloads `.dmp` files renamed to `.sql` because your database tool doesn't know what `.dmp` is
- Streams directly from S3 to your browser so the server doesn't have to hold the whole thing in memory
- Content-Disposition headers that actually work most of the time

## Architecture (The Scenic Route From Browser to Bucket)

```
Your Browser → Next.js API Routes → DigitalOcean Spaces (S3)
     |                |
     |                ├── /api/bucket         (list objects)
     |                ├── /api/bucket/preview  (stream file content)
     |                └── /api/bucket/download (stream as attachment)
     |
     └── Monaco Editor (making SQL look fancy since 2016)
```

Four moving parts to browse files. This is progress.

## Tech Stack (Buzzword Buffet)

- **Framework**: Next.js 16 because 15 is yesterday's news and 17 doesn't exist yet
- **Frontend**: React 19 with hooks everywhere because class components are for historians
- **Editor**: Monaco Editor (the VS Code engine) because `<textarea>` wasn't dramatic enough
- **Styling**: Tailwind CSS v4 because writing actual CSS requires emotional capacity
- **Storage**: AWS SDK v3 talking to DigitalOcean Spaces pretending to be Amazon S3
- **Runtime**: Bun because npm is too mainstream and yarn hurt us too many times
- **Language**: TypeScript because JavaScript without types is just organized chaos

## Prerequisites (Things You Need Before Disappointment)

- Node.js 18+ or Bun (the project has both `package-lock.json` and `bun.lock` because commitment is hard)
- A DigitalOcean Spaces bucket with backups you actually want to look at
- API credentials with enough permissions to read objects but hopefully not delete them
- The emotional readiness to look at raw SQL dumps

## Installation (The Easy Part, Theoretically)

### Step 1: Clone It
```bash
git clone https://github.com/yourusername/s3-browser.git
cd s3-browser
bun install
# or npm install if you're traditional
```

### Step 2: Environment Variables (The Secret Sauce)
Create `.env` and fill in credentials you'll immediately forget where you got from:
```env
# DigitalOcean Spaces credentials (find these in the Spaces dashboard somewhere)
SPACES_KEY=your_access_key_that_you_generated_once_and_never_saved
SPACES_SECRET=your_secret_key_that_is_hopefully_not_committed_to_git
```

That's it. Two variables. We keep things simple around here.

### Step 3: Run It
```bash
bun run dev
# or npm run dev if bun isn't your thing
# navigate to localhost:3000
# click on folders like it's 1999
```

## Configuration (Things You Might Want to Change)

### S3 Endpoint
The app is hardcoded to `sgp1.digitaloceanspaces.com` because that's where our stuff lives. If your bucket is elsewhere, you'll need to change it in approximately three different files because DRY is aspirational:

```
app/api/bucket/route.ts
app/api/bucket/preview/route.ts
app/api/bucket/download/route.ts
```

### Bucket Name
Currently hardcoded to `kmp-katana-backup` in the same three files. Yes, it should be an environment variable. No, it isn't. Feel free to fix that and feel superior.

### Folder Display Names
The app maps cryptic folder names to human-readable ones because nobody wants to click on a UUID:

```ts
const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    "katana-db-v0sooc0kk00084w8wkkoo0sc": "Backup Katana",
    "mysql-database-uc4w4000k4sgo40k0s4ccws4": "Backup KMP",
};
```

Add your own mappings or live with the chaos.

## Usage (What You're Here For)

### Development
```bash
bun run dev
# open localhost:3000
# browse your backups
# preview SQL dumps
# compare two files and wonder who dropped that table
```

### Production
```bash
bun run build
bun run start
# or deploy to Vercel and let them figure it out
```

## The UI (Terminal Vibes)

The whole thing looks like a terminal from a cyberpunk movie — black background, blue text, monospace font. There's a custom Monaco theme called `terminal-blue` that makes SQL look like you're hacking into something important when really you're just reading `CREATE TABLE` statements.

The layout splits into panels:
- **Left panel**: File browser that shrinks to 1/3 width when you open something
- **Right panel**: Either preview or diff view, taking up the remaining space
- **Status bar**: Shows folder/file counts because information wants to be ~~free~~ visible

## Troubleshooting (When Reality Disagrees)

**Nothing loads:**
- Check your `SPACES_KEY` and `SPACES_SECRET` are actually set
- Verify the bucket name exists and you didn't typo it
- Make sure your credentials haven't expired

**Preview takes forever:**
- That's not a bug, your backup is just enormous
- The byte counter at the top tells you progress
- Consider whether you really need to preview a 500MB dump

**Diff view is blank:**
- Both files need to finish loading before the diff renders
- If both say "Failed to load," your credentials are probably wrong
- Try smaller files first to rule out timeout issues

**Everything is blue:**
- That's intentional. It's a design choice. Stop asking.

## Security (Seriously, Read This Part)

Let's be real about what's happening here: this app has **zero authentication**. No login page, no API keys, no "are you sure you're allowed to be here?" prompts. It's a wide-open door to your database backups. Every `INSERT INTO` statement, every user table, every password hash you thought was safe — all one URL away from being someone's bedtime reading.

Here's the full list of things that should keep you up at night:

- **No auth whatsoever** — anyone with the URL gets full read access to your backup bucket
- **No rate limiting** — someone could scrape every backup you've ever made and you wouldn't know until the bandwidth bill arrives
- **No audit logging** — if someone previews your production database dump, there's no record of it happening
- **No input sanitization on S3 keys** — probably fine, but "probably fine" is how breaches start
- **No HTTPS enforcement** — the app doesn't care if you're running it over plain HTTP like it's 2005
- **Credentials live in `.env`** which is `.gitignore`'d (check anyway, please, for the love of your customer data)
- **The S3 client credentials are server-side only** — they never reach the browser, which is the one thing we got right
- **The download endpoint will serve any key in the bucket** — if your bucket has non-backup files in it, this app will happily serve those too

### How I Sleep at Night

I personally run this behind a **Cloudflare Access tunnel**, which means the app never touches the public internet. Cloudflare handles authentication, device posture checks, and all that zero-trust buzzword stuff before anyone even sees the blue terminal UI. If you're deploying this, you should do the same — or at the very least put it behind a VPN, basic auth, or literally anything that asks "who are you?" before showing database dumps.

If you expose this raw to the internet, you deserve whatever happens next. And your users definitely don't.

## Contributing (Sure, Why Not)

1. Fork it
2. Make it better
3. Open a PR
4. Wait patiently

## License

MIT. Use it, break it, make it browse your own backups. Don't blame me if you accidentally diff two 1GB dumps and your browser catches fire.

## Final Notes

This exists because I got tired of my team pinging me every other day asking me to go into Coolify and download the latest database backup for them. And no, I'm not giving them Coolify access — I definitely don't trust them enough to navigate that jungle without accidentally nuking a production container. So instead of playing backup delivery boy for the rest of my career, I built this. Now they can browse, preview, and download backups themselves without going anywhere near the infrastructure that keeps the lights on.

It streams files so it won't eat your RAM, it diffs them so you don't have to eyeball-compare SQL, and it renames `.dmp` to `.sql` because file extensions are just suggestions anyway.

The dark terminal theme isn't configurable because I picked those blue shades at 2 AM and I'm not going back. The folder name mappings are hardcoded because premature abstraction is the root of all evil, or something like that.

If you're in a similar situation — the sole person trusted with server access and tired of being a human file transfer protocol — feel free to steal this. Your sanity is worth more than the afternoon it takes to set up.
