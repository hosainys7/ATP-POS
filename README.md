# Atelier Trottinette Pro - POS & Stock Management

Custom local-first point-of-sale and workshop management system built for a scooter shop.

The application centralizes everyday counter operations: barcode sales, stock tracking, mixed product/service carts, repair follow-up, receipt printing, sales history and local backups.

## Main features

- Barcode-based product lookup and checkout
- Mixed cart: spare parts, scooters, accessories and repairs
- Cash / card payment recording
- Automatic stock deduction after completed sales
- Product catalogue with barcode, reference, brand, category, prices and stock thresholds
- Low-stock and out-of-stock visibility
- Sales history, receipt reprint, cancellations and product returns
- Simple repair workflow: reception -> in progress -> ready -> checkout -> returned
- Repair amount added directly to the main POS cart
- Dashboard for sales, transactions, payments, stock and active repairs
- Printable receipts
- Automatic and manual SQLite backups
- Local Windows launcher for daily shop use

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** SQLite
- **Runtime:** Local Windows PC + browser

## Architecture

```text
Barcode scanner / browser
          |
          v
     React frontend
          |
          v
   Express REST API
          |
          v
    SQLite database
```

The system is designed to run locally on the shop computer. The browser is the interface, while business data is stored in SQLite rather than browser localStorage.

## Core workflow

```text
Scan / select product
        -> cart
        -> cash or card
        -> validate sale
        -> stock updated
        -> transaction saved
        -> receipt printed
```

Repairs can be prepared separately and, once ready, added to the same checkout cart as physical products.

## Development

### Backend

```bash
cd backend
pnpm install
pnpm dev
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend development URL: `http://localhost:5173`

Backend API: `http://localhost:3001`

## Windows local use

The project includes Windows helper scripts for local deployment and operation:

- `BUILD_WINDOWS.bat`
- `START_WINDOWS.bat`
- `STOP_WINDOWS.bat`
- `RESTORE_BACKUP.bat`

After a production build, the application can be opened locally without VS Code.

## Repository privacy and data

Real shop databases, sales history, backups and client information are intentionally excluded from this repository.

Do **not** commit:

- `data/*.db`
- `backups/`
- `.env` files
- customer or sales exports

Use test/demo data for screenshots and development.

## Project context

Developed as a custom business system for **Atelier Trottinette Pro**, alongside its commercial website and product catalogue.

Portfolio: https://huss-tech.fr

---

> This repository documents the software project and its engineering workflow. Any fiscal/cash-register compliance required for production use should be validated separately for the applicable legal context.
