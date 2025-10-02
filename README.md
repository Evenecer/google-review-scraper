# Google Maps Review Scraper

A fast, headless web scraper that extracts all reviews from Google Maps business listings using Puppeteer with stealth mode.

## Features

- **Complete Review Collection** - Automatically scrolls and loads all reviews, not just the first page
- **Stealth Mode** - Uses puppeteer-extra-plugin-stealth to avoid bot detection
- **Detailed Data Extraction** - Captures reviewer names, star ratings, review text, and owner responses
- **Performance Optimized** - Blocks images, fonts, and media for faster execution (~40% speed improvement)
- **Headless Operation** - Runs in background without opening browser windows
- **Easy to Use** - Interactive prompt for entering any Google Maps URL
- **Handles Edge Cases** - Properly distinguishes between reviews with no text and owner responses

## Installation

```bash
npm install
```

## Usage

Run the scraper:

```bash
npm start

or

run "run.bat" on windows.

or

node index.js
```

When prompted, paste the full Google Maps URL of any business:

```
Enter Google Maps URL: https://maps.app.goo.gl/RvL7iSNSsNaVBRru8
```

(Obtained by going to google maps > Share > Link to Share)
![alt text](https://i.imgur.com/QJ0tUkL.gif "Logo Title Text 1")

The scraper will:
1. Navigate to the business page
2. Click the Reviews tab
3. Automatically scroll to load all reviews
4. Extract and display all review data
5. Exit when complete

## Output Format

```
Review #1
Name: John Doe
Rating: 5 stars
Review: Great service! Highly recommend...
Owner Response: Thank you for your feedback!
---

Total: 338 reviews
```

## Configuration

### Running Headless vs Visible Browser

Change `headless: true` to `headless: false` in the code to watch the browser in action:

```javascript
const browser = await puppeteer.launch({
  headless: false, // Shows browser window
  // ...
});
```

### Adjusting Scroll Settings

Modify the scroll parameters for different performance characteristics:

```javascript
for (let attempt = 0; attempt < 250; attempt++) { // Max scroll attempts
  // ...
  if (noChangeCount >= 15) { // Stop after 15 failed attempts
```

## Scheduling with Cron

To run automatically every 24 hours:

**Linux/Mac:**
```bash
crontab -e
```

Add this line (runs daily at 9 AM):
```
0 9 * * * cd /path/to/scraper && node index.js >> reviews.log 2>&1
```

**Windows Task Scheduler:**

Create `run.bat`:
```batch
@echo off
cd C:\path\to\scraper
node index.js >> reviews.log 2>&1
```

Then schedule it in Task Scheduler.

## Technical Details

- **Puppeteer 24.15.1** - Latest Chrome automation library
- **Stealth Plugin** - Evades bot detection systems
- **Resource Blocking** - Improves speed by blocking images/fonts/media
- **Smart Scrolling** - Uses PageDown keyboard events to trigger lazy loading
- **Review Detection** - Monitors DOM for new review elements appearing

## Requirements

- Node.js 14 or higher
- https://nodejs.org/en/download
- ~200MB disk space for Chromium

## Limitations

- Only works with public Google Maps reviews
- Google may rate-limit requests if used too frequently
- Some businesses with 1000+ reviews may take several minutes
- Requires stable internet connection

## Legal Notice

This tool is for personal use and educational purposes. Always respect Google's Terms of Service and robots.txt. Use responsibly and consider rate limiting your requests.

## License

ISC

## Contributing

Pull requests welcome. For major changes, please open an issue first.
