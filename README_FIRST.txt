SEFS Operations Dashboard v8 - Quote Builder Visibility Fix

This version forces the Quote Builder to be visible in two places:
1. A left-side button labeled "QUOTE BUILDER"
2. A big "Build a Quote" card on the Dashboard page

Setup:
1. Upload this whole ZIP to Netlify.
2. Open the site.
3. Click "QUOTE BUILDER" on the left or "Open Quote Builder" on the Dashboard.

If the embedded frame gives trouble, click "Open Full Page" inside the Quote Builder tab.

Labor settings update:
Run supabase_setup.sql again in Supabase to add editable system labor fields:
- default crew size
- default labor days
- labor notes
