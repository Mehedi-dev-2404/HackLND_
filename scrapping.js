import { chromium } from 'playwright';

// 🚀 Member 4: Run this on Member 2's Node.js backend
async function scrapeMoodleAssignments(username, password) {
  console.log('Starting Moodle Scraper...');
  
  // 1. Launch a real browser in the background
  // Set headless: false if you want to watch it work while debugging!
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 2. Navigate to your university's Moodle login
    await page.goto('https://moodle.youruniversity.edu/login/index.php');

    // 3. Fill in credentials (inspect the page to find the exact #id of the inputs)
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#loginbtn');

    // 4. Wait for the dashboard to load (crucial step!)
    await page.waitForURL('**/my/');
    console.log('Logged in successfully!');

    // 5. Navigate to the "Upcoming Events" or "Timeline" section
    // (You might need to click a specific tab or go to a specific URL)
    
    // 6. Extract the data using page.$$eval
    // This runs document.querySelectorAll inside the browser and maps the results
    const assignments = await page.$$eval('.event-list-item', (nodes) => {
      return nodes.map(node => {
        const title = node.querySelector('.event-name')?.innerText || 'Unknown';
        const dueDate = node.querySelector('.date')?.innerText || '';
        const course = node.querySelector('.course-name')?.innerText || '';
        const link = node.querySelector('a')?.href || '';
        
        return { title, dueDate, course, link };
      });
    });

    console.log(`Found ${assignments.length} assignments.`);
    return assignments;

  } catch (error) {
    console.error('Scraping failed:', error);
    // 🚨 10-Minute Rule: If this fails due to 2FA, fallback to mock data!
    return null;
  } finally {
    await browser.close();
  }
}

// Example usage:
// scrapeMoodleAssignments('student123', 'supersecret').then(console.log);
