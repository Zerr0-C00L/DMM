# Torrentio Quality Filter Reference

## Understanding the Torrentio Filter Format

Your quality preference setting uses Torrentio's quality filter API. The format is:

```
sort=<sortBy>%7Cqualityfilter=<filter1>,<filter2>,...
```

- `%7C` is the URL-encoded pipe character `|`
- Filters are comma-separated
- The script automatically URL-encodes this for you

## Configuration in quality-preferences.json

```json
{
  "qualityPreferences": {
    "torrentioSortBy": "qualitysize",
    "torrentioQualityFilter": "brremux,hdrall,dolbyvision"
  }
}
```

## Available Sort Options

Set `torrentioSortBy` to one of:

- **`qualitysize`** - Sort by quality first, then size (RECOMMENDED)
- **`quality`** - Sort by quality only
- **`size`** - Sort by file size (largest first)
- **`seeders`** - Sort by number of seeders

## Available Quality Filters

Set `torrentioQualityFilter` to comma-separated values from this list:

### Premium Quality (INCLUDE these for high quality)
- **`brremux`** - Blu-ray Remux (untouched Blu-ray rips, highest quality)
- **`hdrall`** - All HDR content (HDR10, HDR10+, Dolby Vision)
- **`dolbyvision`** - Dolby Vision only
- **`dolbyvisionwithhdr`** - Dolby Vision with HDR10 fallback
- **`hdr10plus`** - HDR10+ content

### Resolution Filters
- **`4k`** - 4K/2160p content
- **`1080p`** - 1080p Full HD
- **`720p`** - 720p HD
- **`480p`** - 480p SD

### Quality to EXCLUDE (Low Quality)
- **`other`** - Other/unknown quality
- **`scr`** - Screener copies
- **`cam`** - Camera recordings
- **`unknown`** - Unknown quality
- **`threed`** - 3D content (if you don't want it)

## Example Configurations

### 1. Your Current Setup (Premium HDR/Remux Only)
```json
"torrentioQualityFilter": "brremux,hdrall,dolbyvision"
```
Result: Only gets Blu-ray Remux, HDR, and Dolby Vision content

### 2. Exclude Only Bad Quality (Default - Most Permissive)
```json
"torrentioQualityFilter": "other,scr,cam,unknown"
```
Result: Excludes cam/screener copies but allows everything else

### 3. 4K HDR Only
```json
"torrentioQualityFilter": "4k,hdrall"
```
Result: Only 4K content with any HDR format

### 4. Dolby Vision Premium Only
```json
"torrentioQualityFilter": "dolbyvision,dolbyvisionwithhdr"
```
Result: Only Dolby Vision content (most premium)

### 5. High Quality 1080p/4K (No Remux - Smaller Files)
```json
"torrentioQualityFilter": "4k,1080p,hdrall"
```
Result: 4K or 1080p with HDR, but not necessarily remux (allows encodes)

### 6. Standard Quality (Balanced)
```json
"torrentioQualityFilter": "1080p,720p"
```
Result: Only 1080p or 720p content

## How Filtering Works

1. **Torrentio filters at source** - The quality filter is sent to Torrentio, so you only get results matching your filter
2. **Additional local filtering** - After Torrentio results, your other `qualityPreferences` settings further filter results:
   - `minResolution`, `maxFileSizeGB`, `minFileSizeGB`
   - `preferredKeywords`, `excludeKeywords`
   - `requireHDR`, `requireRemux`

## Important Notes

### Combining Filters = OR Logic
When you specify multiple filters like `"brremux,hdrall,dolbyvision"`, Torrentio returns torrents that match **ANY** of these (OR logic):
- Torrents marked as Blu-ray Remux, **OR**
- Torrents with HDR, **OR**
- Torrents with Dolby Vision

### Exclude Filters
To **exclude** certain quality types, you specify them in the filter. For example:
- `"other,scr,cam,unknown"` means: exclude other/scr/cam/unknown quality

### Recommended Approach

**For maximum quality (your use case):**
```json
{
  "torrentioSortBy": "qualitysize",
  "torrentioQualityFilter": "brremux,hdrall,dolbyvision,dolbyvisionwithhdr",
  "minFileSizeGB": 20,
  "requireHDR": false
}
```

**For balanced quality/size:**
```json
{
  "torrentioSortBy": "qualitysize",
  "torrentioQualityFilter": "4k,1080p,hdrall",
  "minFileSizeGB": 5,
  "maxFileSizeGB": 50
}
```

**For testing (allows everything except bad quality):**
```json
{
  "torrentioSortBy": "size",
  "torrentioQualityFilter": "other,scr,cam,unknown",
  "minFileSizeGB": 1
}
```

## Debugging

To see what URL is being used, check the GitHub Actions logs. You'll see lines like:
```
Searching torrents for: Movie Title (2024)
```

The script builds a URL like:
```
https://torrentio.strem.fun/sort=qualitysize%7Cqualityfilter=brremux,hdrall,dolbyvision/stream/movie/tt1234567.json
```

## More Information

Torrentio API documentation: https://torrentio.strem.fun/configure
