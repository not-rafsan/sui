---
Task ID: 1
Agent: main
Task: Fix Instagram carousel posting API [-1] Fatal error on Render

Work Log:
- Read `instagram-poster.ts` and found the root cause: code was using user token from DB directly instead of page token
- The previous "fix" (try user token, exchange on specific error codes) never worked because API [-1] didn't match the error patterns checked
- Fixed Step 1 to ALWAYS fetch page access token using the user token from DB, before any uploads
- Removed the fragile `needsTokenExchange` pattern entirely
- Pushed fix to GitHub (`not-rafsan/sui` main branch)
- Ran full end-to-end carousel test locally — completed successfully with post ID on Instagram
- Confirmed post live at `https://www.instagram.com/p/DF_XMoNyMbR/`
- Tested on Render with generated 1080x1080 JPEG slides — carousel posted successfully via the deployed app
- Confirmed success response: `{"success":true,"status":"done","url":"https://www.instagram.com/p/DF_YZJy1XGB/"}`

Stage Summary:
- Root cause: User token cannot upload unpublished photos to FB Page. The exchange-to-page-token logic only triggered on "must be posted" / "API [200]" errors, but the actual error was API [-1] Fatal.
- Fix: Unconditionally fetch page access token at the start of `postCarouselToInstagram()`
- Verification: 
  1. Local direct API test: 3-slide carousel posted successfully (ID: DF_XMoNyMbR)
  2. Render app test: 3-slide carousel posted successfully via the app (ID: DF_YZJy1XGB)
- Both posts are live on @drudolearn Instagram account