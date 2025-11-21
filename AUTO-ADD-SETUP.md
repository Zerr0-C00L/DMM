# Auto-Add Quality Content Setup

This feature automatically adds high-quality torrents to your Real-Debrid account daily using GitHub Actions.

## Features

- 🎬 Fetches trending/popular movies and TV shows from Trakt
- 🎯 Filters torrents by your quality preferences (resolution, file size, keywords)
- ⚡ Only adds instantly cached torrents from Real-Debrid
- 🔄 Runs daily via GitHub Actions (or manually on-demand)
- 🔐 Securely stores your API keys in GitHub Secrets

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

- **`REAL_DEBRID_API_KEY`** (Required)
  - Get from: https://real-debrid.com/apitoken
  - Your Real-Debrid API token

- **`TRAKT_CLIENT_ID`** (Optional, for Trakt integration)
  - Get from: https://trakt.tv/oauth/applications
  - Create a new application to get Client ID

- **`TRAKT_ACCESS_TOKEN`** (Optional, for private lists and watchlist)
  - Get from: https://trakt.tv/oauth/applications (create app, then get OAuth token)
  - Only needed if you want to access your private lists or watchlist

### 2. Configure Quality Preferences

Edit `quality-preferences.json` in the root directory:

```json
{
  "enabled": true,
  "qualityPreferences": {
    "minResolution": "1080p",
    "maxFileSizeGB": 100,
    "minFileSizeGB": 5,
    "preferredKeywords": [
      "remux",
      "bluray",
      "hdr",
      "dv",
      "dolby vision",
      "hdr10plus"
    ],
    "excludeKeywords": [
      "cam",
      "ts",
      "hdts",
      "hdcam",
      "screener",
      "scr"
    ],
    "preferredResolutions": [
      "2160p",
      "1080p"
    ],
    "preferredCodecs": [
      "x265",
      "hevc",
      "av1"
    ],
    "requireHDR": false,
    "requireRemux": false
  },
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": ["trending", "popular"],
      "maxItemsPerList": 10,
      "mediaTypes": ["movie", "show"]
    }
  },
  "limits": {
    "maxTorrentsPerRun": 50,
    "maxTorrentsPerTitle": 1
  },
  "dryRun": false,
  "logLevel": "info"
}
```

### 3. Customize Your Preferences

#### Quality Settings

- **`torrentioQualityFilter`**: Torrentio quality filter (comma-separated, e.g., "brremux,hdrall,dolbyvision")
  - Available filters: `brremux`, `hdrall`, `dolbyvision`, `dolbyvisionwithhdr`, `hdr10plus`, `4k`, `1080p`, `720p`, `480p`, `other`, `scr`, `cam`, `unknown`, `threed`
  - Leave empty or use "other,scr,cam,unknown" to exclude only bad quality
- **`torrentioSortBy`**: How Torrentio sorts results ("qualitysize", "size", "quality", "seeders")
- **`minResolution`**: Minimum resolution (e.g., "1080p", "2160p")
- **`maxFileSizeGB`**: Maximum file size in GB
- **`minFileSizeGB`**: Minimum file size in GB (helps filter out low-quality encodes)
- **`preferredKeywords`**: Keywords that boost a torrent's score (remux, HDR, etc.)
- **`excludeKeywords`**: Keywords that exclude a torrent (cam, screener, etc.)
- **`preferredResolutions`**: Preferred resolutions (prioritized in scoring)
- **`preferredCodecs`**: Preferred video codecs (x265, av1, etc.)
- **`requireHDR`**: Only add HDR/Dolby Vision content (strict filter)
- **`requireRemux`**: Only add REMUX releases (strict filter)

#### Content Sources

- **`trakt.enabled`**: Enable Trakt as a content source
- **`trakt.lists`**: Which lists to fetch ("trending", "popular", "watchlist")
- **`trakt.maxItemsPerList`**: How many items to fetch per list
- **`trakt.mediaTypes`**: Types of media ("movie", "show")
- **`trakt.username`**: Your Trakt username (required for watchlist and custom lists)
- **`trakt.customLists`**: Array of custom lists in format `["username/list-slug"]`
  - Example: `["john/favorites", "john/to-watch"]`
  - Get list slug from the URL: `https://trakt.tv/users/john/lists/to-watch` → slug is `to-watch`

#### Limits

- **`maxTorrentsPerRun`**: Maximum total torrents to add per run
- **`maxTorrentsPerTitle`**: Maximum torrents to add per movie/show (usually 1)

#### Testing

- **`dryRun`**: Set to `true` to test without actually adding torrents (logs what would be added)

### 4. Schedule Configuration

The workflow runs daily at 2 AM UTC by default. To change the schedule, edit `.github/workflows/daily-auto-add.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Change this cron expression
```

Common schedules:
- `'0 2 * * *'` - Daily at 2 AM UTC
- `'0 */6 * * *'` - Every 6 hours
- `'0 8,20 * * *'` - Twice daily at 8 AM and 8 PM UTC

### 5. Manual Trigger

You can manually trigger the workflow:

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select "Daily Auto-Add Quality Content"
4. Click "Run workflow"

### 6. View Logs

After each run, check the logs:

1. Go to Actions tab in your GitHub repository
2. Click on the latest workflow run
3. Expand "Run auto-add script" step to see what was added
4. Download artifacts to see detailed logs (kept for 30 days)

## How It Works

1. **Fetch Content**: Gets trending/popular content from Trakt
2. **Search Torrents**: Searches Torrentio for available torrents
3. **Check Availability**: Verifies which torrents are instantly cached in Real-Debrid
4. **Filter Quality**: Applies your quality preferences
5. **Score & Select**: Scores torrents and selects the best match(es)
6. **Add to RD**: Adds selected torrents to your Real-Debrid account

## Scoring System

Torrents are scored based on:
- File size (larger = better quality)
- Preferred keywords (+50 points each)
- Preferred codecs (+30 points)
- Cached in Real-Debrid (+1000 points - prioritizes instant availability)

The highest-scored torrent(s) are added to your account.

## Troubleshooting

### No torrents being added

1. Check if `enabled: true` in `quality-preferences.json`
2. Set `dryRun: true` to see what would be added
3. Check GitHub Actions logs for errors
4. Verify your REAL_DEBRID_API_KEY is correct
5. Try relaxing your quality filters (lower minFileSizeGB, remove requireHDR, etc.)

### Rate limiting errors

- The script includes delays between requests
- If you see 429 errors, reduce `maxTorrentsPerRun`

### Want more content

- Increase `maxItemsPerList` (default: 10)
- Add more lists to `trakt.lists`
- Increase `maxTorrentsPerRun` limit

## Example Configurations

### Ultra Quality 4K HDR Remux Only
```json
{
  "qualityPreferences": {
    "torrentioQualityFilter": "brremux,hdrall,dolbyvision",
    "torrentioSortBy": "qualitysize",
    "minResolution": "2160p",
    "minFileSizeGB": 40,
    "preferredResolutions": ["2160p"],
    "requireHDR": true,
    "requireRemux": true
  }
}
```

### Dolby Vision Only (Most Premium Quality)
```json
{
  "qualityPreferences": {
    "torrentioQualityFilter": "dolbyvision,dolbyvisionwithhdr",
    "torrentioSortBy": "qualitysize",
    "minFileSizeGB": 30
  }
}
```

### Balanced 1080p/4K
```json
{
  "qualityPreferences": {
    "minResolution": "1080p",
    "minFileSizeGB": 5,
    "maxFileSizeGB": 80,
    "preferredResolutions": ["2160p", "1080p"]
  }
}
```

### Storage-Conscious
```json
{
  "qualityPreferences": {
    "minResolution": "1080p",
    "minFileSizeGB": 2,
    "maxFileSizeGB": 20,
    "preferredCodecs": ["x265", "hevc", "av1"]
  }
}
```

## Security Note

Your Real-Debrid API key is stored securely in GitHub Secrets and is never exposed in logs or code. It's only available to the GitHub Actions runner during execution.
