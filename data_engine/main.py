from playwright.sync_api import sync_playwright

def dump_html_payload():
    with sync_playwright() as p:
        print("🚀 Launching headless browser...")
        browser = p.chromium.launch(headless=True)
        
        try:
            context = browser.new_context(storage_state="uw_auth_state.json")
        except Exception:
            print("❌ Could not load uw_auth_state.json.")
            return

        page = context.new_page()
        print("🕵️ Infiltrating UW Time Schedule...")
        
        page.goto("https://www.washington.edu/students/timeschd/WIN2026/cse.html", wait_until="commit")
        page.wait_for_load_state("networkidle")
        
        if "idp.u.washington.edu" in page.url:
            print("\n❌ BREACH FAILED: Bounced back to login.")
            browser.close()
            return
            
        print("✅ WE ARE IN. Bypassed the firewall.")
        print("💾 Dumping raw HTML to local file...")
        
        # Save the entire page's HTML to a file so we can inspect it
        raw_html = page.content()
        with open("uw_raw_dump.html", "w", encoding="utf-8") as f:
            f.write(raw_html)
            
        print("🎉 SUCCESS! Open 'uw_raw_dump.html' in VS Code.")
            
        browser.close()

if __name__ == "__main__":
    dump_html_payload()