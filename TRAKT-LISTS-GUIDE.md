# Using Your Trakt Lists

## Quick Setup

### 1. Find Your List Slug

Go to your Trakt list in a browser:
```
https://trakt.tv/users/YOUR-USERNAME/lists/YOUR-LIST-NAME
```

The slug is the last part of the URL (e.g., `your-list-name`)

### 2. Update quality-preferences.json

```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "username": "your-trakt-username",
      "customLists": [
        "your-trakt-username/favorites",
        "your-trakt-username/watchlist-movies"
      ]
    }
  }
}
```

### 3. Add Trakt Access Token (for private lists)

If your lists are private, you need to add `TRAKT_ACCESS_TOKEN` to GitHub Secrets.

**Get your access token:**
1. Go to https://trakt.tv/oauth/applications
2. Create a new application (if you haven't already)
3. Click on your app
4. Scroll down to "OAuth" section
5. Click "Generate Token"
6. Copy the access token
7. Add it as `TRAKT_ACCESS_TOKEN` in GitHub Secrets

## Configuration Options

### Use Your Watchlist
```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": ["watchlist"],
      "username": "your-username"
    }
  }
}
```
**Note:** Requires `TRAKT_ACCESS_TOKEN` in GitHub Secrets

### Use Custom Lists Only
```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": [],
      "customLists": [
        "your-username/my-favorites",
        "your-username/4k-collection"
      ]
    }
  }
}
```

### Mix Trending + Your Lists
```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": ["trending"],
      "maxItemsPerList": 5,
      "customLists": [
        "your-username/must-watch"
      ]
    }
  }
}
```

### Use Other People's Public Lists
```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "customLists": [
        "justin/watched-2024",
        "giladg/latest-releases"
      ]
    }
  }
}
```

## Examples

### Auto-add everything from your watchlist
```json
{
  "enabled": true,
  "qualityPreferences": {
    "minFileSizeGB": 2,
    "maxFileSizeGB": 50
  },
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": ["watchlist"],
      "username": "john"
    }
  },
  "limits": {
    "maxTorrentsPerRun": 100
  }
}
```

### Combine multiple sources
```json
{
  "contentSources": {
    "trakt": {
      "enabled": true,
      "lists": ["trending"],
      "maxItemsPerList": 5,
      "username": "john",
      "customLists": [
        "john/4k-favorites",
        "john/watchlist-priority",
        "someoneelse/best-of-2024"
      ]
    }
  }
}
```

## Troubleshooting

### "Error fetching Trakt list"
- Check the username and list slug are correct
- Make sure the list is public (or add `TRAKT_ACCESS_TOKEN` for private)
- Verify `TRAKT_CLIENT_ID` is set in GitHub Secrets

### "Trakt authentication not configured"
- You're trying to access watchlist or private lists
- Add `TRAKT_ACCESS_TOKEN` to GitHub Secrets

### List not updating
- Lists are fetched fresh each time the script runs
- If you add items to your Trakt list, they'll be picked up on the next run

## Tips

1. **Keep lists organized**: Create separate lists for different quality preferences
2. **Use public lists**: No need for access token if your lists are public
3. **Combine sources**: Mix trending + your lists for variety
4. **Test first**: Use `"dryRun": true` to see what would be added
5. **Multiple lists**: You can add as many lists as you want

## Finding the List Slug

**From browser URL:**
```
https://trakt.tv/users/john/lists/my-favorites
                              ↑           ↑
                           username   list-slug
```

**In config:**
```json
"customLists": [
  "john/my-favorites"
]
```
