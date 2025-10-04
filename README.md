# Google Review Scraper

Fast, clean, and actually enjoyable to use. Built with Puppeteer to scrape Google Maps reviews without the usual headaches.

## Why Use This?

- **Fast** - Request interception blocks unnecessary resources (images, fonts, media) for 3-5x speed improvement
- **Harder to detect** - Stealth plugin makes it nearly impossible for Google to flag as a bot
- **No infrastructure** - Everything saves locally as JSON/CSV. No external services required.
- **Beautiful CLI** - Interactive menus, live progress tracking, colored output. Not just logs.
- **Smart** - Detects target review count from the page and stops automatically when done

## Features

### 🎨 Beautiful Interactive CLI
- Guided setup wizard with dropdown menus
- Live progress tracking with smart target detection ("187/189 reviews loaded")
- Color-coded output and emoji indicators
- Interactive config editor - no manual YAML editing needed

### 📁 Smart Organization
- Each run creates a timestamped folder (`data/2025-10-03_14-30/`)
- Isolated runs make it easy to compare scraping sessions
- Automatic metadata tracking (URL, timestamp, review count)

### ⚡ Performance Optimized
- Puppeteer with stealth mode for undetectable scraping
- Request interception blocks images/media/fonts for faster scraping
- Smart scrolling with automatic completion detection
- Detects target review count from page and stops automatically

### 📊 Data Options
- JSON output (default) - structured, easy to parse
- CSV export option - for Excel/spreadsheets
- Download review images and profile pictures
- Sort by newest, highest, lowest, or relevance

### 🔧 Flexible Configuration
- YAML config file with sensible defaults
- CLI options override config for one-off runs
- Interactive config editor built into the menu
- Headless or visible browser mode

## Installation

```bash
Run the run.bat
```
or
```bash
npm install
```

That's it. No external dependencies or services required.

## Quick Start

### Interactive Mode (Recommended)

```bash
Run the run.bat
```
or
```
node scraper.js
```

You'll get a menu:
```
╔═══════════════════════════════════════════╗
║   Google Review Scraper            ║
╚═══════════════════════════════════════════╝

? How would you like to configure the scraper?
  ❯ ⚡ Use default settings (just enter URL)
    ⚙️  Manual configuration (interactive wizard)
    📝 Edit config.yaml settings
```

- **Use default settings**: Just enter a URL, uses config.yaml for everything else
- **Manual configuration**: Interactive wizard asks for URL, sort order, download images, headless mode
- **Edit config.yaml**: Interactive editor to modify config file, then optionally run scraper

When prompted, paste the full Google Maps URL of any business:
```bash
Enter Google Maps URL: https://maps.app.goo.gl/RvL7iSNSsNaVBRru8
```

(Obtained by going to google maps > Share > Link to Share)

![alt text](https://i.imgur.com/QJ0tUkL.gif "")
![alt text](https://i.imgur.com/66Rkn3O.gif "")


### One-Line Mode

```bash
node scraper.js --url "https://maps.app.goo.gl/yourlink" --sort newest --csv --images
```

## CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--url` | Google Maps URL | `--url "https://maps.app.goo.gl/..."` |
| `--sort` or `-s` | Sort order | `--sort newest` (newest, highest, lowest, relevance) |
| `--headless` | Run in background | `--headless` (default: true) |
| `--csv` | Export to CSV too | `--csv` |
| `--images` or `-i` | Download images | `--images` |
| `--maxScrolls` or `-m` | Max scroll attempts | `--maxScrolls 300` |
| `--wizard` or `-w` | Run interactive wizard | `--wizard` |
| `--config` or `-c` | Config file path | `--config ./my-config.yaml` |

## Configuration

The config file lives at `config.yaml`. Edit it manually or use the interactive editor:

```bash
node scraper.js
# Choose "📝 Edit config.yaml settings"
```

### Example Config

```yaml
# Scraping Settings
sortBy: "relevance"        # Options: newest, highest, lowest, relevance
maxScrolls: 250            # Safety limit for scrolling
scrollDelay: 800           # Milliseconds between scrolls (config only, no CLI flag)

# Output Options
exportCSV: false           # Also export to CSV (use --csv to enable via CLI)
downloadImages: false      # Download review images (use --images to enable via CLI)
imageConcurrency: 5        # Parallel image downloads

# Browser Settings
headless: true             # Run in background (use --headless=false to see browser)
```

## Output Structure

Every run creates its own folder:

```
data/
└── 2025-10-03_14-30/
    ├── reviews.json       # All reviews (structured)
    ├── reviews.csv        # CSV version (if --csv enabled)
    ├── metadata.json      # Run info (URL, timestamp, count)
    └── images/            # Downloaded images (if enabled)
        ├── profiles/
        └── reviews/
```

### Review Data Format

```json
{
  "reviewId": "ChZDSUhNMG9nS0VJQ0FnSUR...",
  "name": "John Smith",
  "rating": 5,
  "text": "Great service! Highly recommend...",
  "date": "2 weeks ago",
  "likes": 12,
  "images": [
    "https://lh5.googleusercontent.com/..."
  ],
  "profilePicture": "https://lh3.googleusercontent.com/...",
  "profileUrl": "https://www.google.com/maps/contrib/...",
  "ownerResponse": "Thanks for your review!",
  "scrapedAt": "2025-10-04T10:30:00.000Z"
}
```

## How It Works

1. **Launch** - Starts Chromium with stealth plugins to avoid detection
2. **Navigate** - Loads the Google Maps URL
3. **Click Reviews Tab** - Opens the reviews section
4. **Sort** - Applies sorting if you specified an option (newest, highest, lowest)
5. **Detect Target** - Reads the review count from page (e.g., "189 reviews")
6. **Scroll** - Triple PageDown keypresses to trigger lazy loading
7. **Extract** - Parses all review data in a single pass (no stale element errors)
8. **Download Images** - Downloads review and profile images if enabled
9. **Save** - Writes JSON, CSV (optional), and metadata to timestamped folder

**Smart stopping:** Monitors loaded reviews and stops when either:
- Target count is reached (e.g., loaded 189/189 reviews)
- No new reviews appear after 15 consecutive scroll attempts

## Technical Details

### Why Puppeteer?
- **Fast** - Chrome DevTools Protocol is native and efficient
- **Lightweight** - No separate driver process, everything runs in Node.js
- **Modern** - Built for headless automation from the ground up
- **Stealthy** - Harder to detect with stealth plugins

### Request Interception
Blocks these resource types during scraping for faster performance:
- Images
- Fonts
- Media files

This reduces bandwidth and speeds up scrolling by 3-5x. Review images are extracted from the page HTML, not downloaded during browsing.

### Smart Scrolling
- Uses keyboard PageDown events (more realistic than `scrollTo`)
- Monitors DOM for new review elements
- Stops after 15 failed attempts or when target count is reached
- Configurable delays to avoid rate limiting

## Use Cases

**Great for:**
- Collecting reviews for sentiment analysis
- Monitoring business reputation over time
- Building datasets for research
- Competitor analysis
- One-off data exports

**Not great for:**
- Real-time monitoring (Google will rate limit you)
- Scraping thousands of businesses daily (use the official API)
- Incremental updates (every run is isolated)

## Limits and Gotchas

- **Rate limiting** - Google will slow you down if you scrape too aggressively. Add delays.
- **Large businesses** - Places with 1000+ reviews take several minutes. Be patient.
- **Network issues** - Timeouts happen. The scraper will log them but keep going.
- **Selector changes** - Google updates their HTML occasionally. Open an issue if extraction breaks.

## Requirements

- Node.js 18+ ([download](https://nodejs.org))
- ~200MB disk space for Chromium
- Stable internet connection

## Troubleshooting

### "Error: Failed to launch browser"
- Make sure you have Node 18+
- Try `npm install puppeteer-extra --force`

### "No reviews found"
- Check if the URL is correct (should include `/maps/place/`)
- Some businesses hide reviews - nothing we can do about that
- Try running with `--headless=false` to see what's happening

### "Timeout waiting for selector"
- Google's HTML might have changed. Open an issue with the URL
- Or your internet connection dropped mid-scrape

### Images not downloading
- Make sure `downloadImages: true` in config
- Check you have disk space
- Some images might be behind CDN restrictions

## Legal Stuff

This is for personal use and research. Respect Google's Terms of Service and don't abuse their systems. Add delays between requests, don't scrape thousands of pages per day, and be a good internet citizen.

If you're doing commercial scraping, consider using Google's official Places API instead.

## License

MIT - do whatever you want with it.
