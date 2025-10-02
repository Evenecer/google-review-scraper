const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const readline = require('readline');
puppeteer.use(StealthPlugin());
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}
(async () => {
    const mapsUrl = await askQuestion('Enter Google Maps URL: ');
    if (!mapsUrl || !(mapsUrl.includes('google.com/maps') || mapsUrl.includes('goo.gl'))) {
        console.error('Invalid Google Maps URL');
        process.exit(1);
    }
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions'
        ]
    });
    try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'font', 'media'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });
        await page.setViewport({
            width: 1280,
            height: 720
        });
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        console.log('Navigating to Google Maps...');
        await page.goto(mapsUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });
        await page.waitForSelector('[role="main"]', {
            timeout: 8000
        });
        const businessName = await page.evaluate(() => {
            const heading = document.querySelector('h1');
            return heading ? heading.textContent : 'Not found';
        });
        console.log('Business:', businessName);
        console.log('Clicking Reviews tab...');
        await page.waitForSelector('button[aria-label*="Reviews"]', {
            timeout: 8000
        });
        await page.click('button[aria-label*="Reviews"]');
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Scrolling to load reviews...');
        await page.click('.jftiEf.fontBodyMedium[data-review-id]');
        await new Promise(resolve => setTimeout(resolve, 300));
        let previousReviewCount = 0;
        let noChangeCount = 0;
        for (let attempt = 0; attempt < 250; attempt++) {
            const currentReviewCount = await page.evaluate(() => {
                return document.querySelectorAll('.jftiEf.fontBodyMedium[data-review-id]').length;
            });
            if (attempt % 10 === 0) {
                console.log(`Found ${currentReviewCount} reviews`);
            }
            await page.keyboard.press('PageDown');
            await new Promise(resolve => setTimeout(resolve, 80));
            await page.keyboard.press('PageDown');
            await new Promise(resolve => setTimeout(resolve, 80));
            await page.keyboard.press('PageDown');
            await new Promise(resolve => setTimeout(resolve, 800));
            if (currentReviewCount === previousReviewCount) {
                noChangeCount++;
                if (noChangeCount >= 15) {
                    console.log(`Finished! Total: ${currentReviewCount} reviews\n`);
                    break;
                }
            } else {
                noChangeCount = 0;
            }
            previousReviewCount = currentReviewCount;
        }
        const reviews = await page.evaluate(() => {
            const reviewElements = document.querySelectorAll('.jftiEf.fontBodyMedium[data-review-id]');
            const reviewData = [];
            reviewElements.forEach(review => {
                const nameEl = review.querySelector('.d4r55.fontTitleMedium');
                const name = nameEl ? nameEl.textContent.trim() : 'Unknown';
                const ratingEl = review.querySelector('.kvMYJc');
                const rating = ratingEl ? ratingEl.getAttribute('aria-label') : 'No rating';
                const reviewTextEl = review.querySelector('.MyEned .wiI7pd');
                const text = reviewTextEl ? reviewTextEl.textContent.trim() : 'No review text';
                const ownerResponseEl = review.querySelector('.CDe7pd .wiI7pd');
                const ownerResponse = ownerResponseEl ? ownerResponseEl.textContent.trim() : null;
                reviewData.push({
                    name,
                    rating,
                    text,
                    ownerResponse
                });
            });
            return reviewData;
        });
        reviews.forEach((review, index) => {
            console.log(`Review #${index + 1}`);
            console.log(`Name: ${review.name}`);
            console.log(`Rating: ${review.rating}`);
            console.log(`Review: ${review.text}`);
            if (review.ownerResponse) {
                console.log(`Owner Response: ${review.ownerResponse}`);
            }
            console.log('---\n');
        });
        console.log(`Total: ${reviews.length} reviews`);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
})();
