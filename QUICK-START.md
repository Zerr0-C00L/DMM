# Auto-Add Quality Content - Quick Start

## What was created

1. **GitHub Actions Workflow** (`.github/workflows/daily-auto-add.yml`)
   - Runs daily at 2 AM UTC
   - Can be manually triggered from GitHub UI
   - Uses GitHub Secrets for API keys

2. **Quality Preferences Config** (`quality-preferences.json`)
   - Customize your quality requirements
   - Set file size limits, resolution, keywords, codecs
   - Configure content sources and limits

3. **Auto-Add Script** (`scripts/auto-add-quality.js`)
   - Standalone Node.js script
   - Fetches trending content from Trakt
   - Filters by quality and adds to Real-Debrid

4. **Documentation** (`AUTO-ADD-SETUP.md`)
   - Complete setup instructions
   - Configuration examples
   - Troubleshooting guide

## Quick Setup (5 minutes)

### Step 1: Set GitHub Secrets
Go to: `GitHub Repo → Settings → Secrets → Actions`

Add:
- `REAL_DEBRID_API_KEY` - Get from https://real-debrid.com/apitoken
- `TRAKT_CLIENT_ID` (optional) - Get from https://trakt.tv/oauth/applications

### Step 2: Configure Preferences
Edit `quality-preferences.json`:

```json
{
  "enabled": true,
  "qualityPreferences": {
    "minResolution": "1080p",
    "minFileSizeGB": 5,
    "maxFileSizeGB": 100,
    "preferredResolutions": ["2160p", "1080p"]
  },
  "limits": {
    "maxTorrentsPerRun": 50
  },
  "dryRun": false
}
```

### Step 3: Test It
1. Push your changes to GitHub
2. Go to `Actions` tab
3. Select "Daily Auto-Add Quality Content"
4. Click "Run workflow"
5. Check logs to see what was added

### Step 4: Enable Dry Run for Testing
Before running for real, set `"dryRun": true` in `quality-preferences.json` to see what would be added without actually adding anything.

## Default Settings

- **Schedule**: Daily at 2 AM UTC
- **Max torrents per run**: 50
- **Quality**: 1080p+ with 5-100GB file size
- **Sources**: Trending & popular from Trakt
- **Priority**: Cached torrents, HDR/Remux preferred

## What Happens Each Run

1. Fetches 10 trending + 10 popular movies
2. Fetches 10 trending + 10 popular TV shows
3. Searches Torrentio for available torrents
4. Checks Real-Debrid instant availability
5. Filters by your quality preferences
6. Scores and selects best torrent per title
7. Adds to your Real-Debrid account
8. Logs results to GitHub Actions artifacts

## Customization Examples

### Ultra Quality Only (4K HDR Remux)
```json
{
  "qualityPreferences": {
    "minResolution": "2160p",
    "minFileSizeGB": 40,
    "requireHDR": true,
    "requireRemux": true
  }
}
```

### Movies Only
```json
{
  "contentSources": {
    "trakt": {
      "mediaTypes": ["movie"]
    }
  }
}
```

### Run Twice Daily
Edit `.github/workflows/daily-auto-add.yml`:
```yaml
schedule:
  - cron: '0 2,14 * * *'  # 2 AM and 2 PM UTC
```

## Need Help?

See full documentation: [AUTO-ADD-SETUP.md](AUTO-ADD-SETUP.md)

## Security

✅ API keys stored in GitHub Secrets (encrypted)
✅ Never exposed in logs or code
✅ Only accessible during workflow execution
