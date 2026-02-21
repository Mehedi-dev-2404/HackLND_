import asyncio
import pandas
import json
from datetime import datetime
import time
import os
from playwright.async_api import async_playwright

# 🚀 Member 4: Run this as a standalone Python script or FastAPI microservice
async def scrape_soton_moodle(email, password):
    

    print('Starting Southampton Moodle Scraper...')
    
    async with async_playwright() as p:
        # 1. Launch browser (Set headless=False to watch the login happen!)
        browser = await p.chromium.launch(headless=False) 
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # 2. Navigate to your university's Moodle login
            await page.goto('https://moodle.ecs.soton.ac.uk/login/index.php')

            # 3. Fill in credentials (inspect the page to find the exact #id of the inputs)
            #await page.fill('#username', username)
            #await page.fill('#password', password)
            await page.get_by_role("link", name="University of Southampton").click()
            print('finished')

            print("Handling Microsoft Login...")

            await page.get_by_placeholder("username@soton.ac.uk").fill(email)
            await page.get_by_role("button", name="Next").click()

            # Wait for password input and fill it
            await page.get_by_placeholder("Password").fill(password)
            await page.get_by_role("button", name="Sign in").click()

            # Handle the "Stay signed in?" prompt (click Yes or No)
            # await page.get_by_role("button", name="Yes").click()

            # 5. Wait to arrive back at Moodle
            print("Waiting for Moodle dashboard...")
            await page.wait_for_url('**/my/')
            print('Logged in successfully!')

            # 6. Extract your data here...
            # (You will need to inspect the actual Moodle dashboard to get the right selectors)

        except Exception as e:
            print(f'Scraping failed: {e}')
            print('🚨 10-MINUTE RULE: If Microsoft 2FA blocks this, switch to Mock Data!')
            return None
        finally:
            # Leave browser open for a few seconds to see what happened if it fails
            await asyncio.sleep(5) 
            await browser.close()

# Example usage:
asyncio.run(scrape_soton_moodle('nnn1c23@soton.ac.uk', 'Tom17112005'))


def fetch_by_categories():
    pass