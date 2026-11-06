ATP POS — FINAL UI/UX REFRACTOR BATCH

Destination:
C:\Users\b-son\Web Projects\ATP POS

1. Extract this ZIP into the project root.
2. Choose “Replace files in destination”.
3. Restart backend and frontend.

Backend:
cd "C:\Users\b-son\Web Projects\ATP POS\backend"
pnpm dev

Frontend:
cd "C:\Users\b-son\Web Projects\ATP POS\frontend"
pnpm exec tsc --noEmit
pnpm dev

What changes:
- Compact top navigation replaces left sidebar.
- Orange / dark website-inspired brand theme.
- New compact dashboard with 7-day sales chart, Cash/Card visual and stock health.
- POS checkout redesigned for faster scanning.
- Products catalogue changed to a dense professional table.
- Stock/inventory keeps barcode-first registration + full catalogue fields.
- History, Repairs and Backup visually unified with the new theme.
- Product catalogue fields/migrations preserved: type, brand, model, reference, compatibility.

No sales/repairs/stock data is deleted.
