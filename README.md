# ⬡ God Analyzer UI

P2P crypto trading accountability dashboard for Venezuelan Binance USDT/VES operations.

## Features

- **Dashboard** — Charts: profit per cycle, price evolution, volume by day, coverage %
- **Órdenes** — Full CRUD table: create, edit, delete, duplicate, filter, sort orders
- **Ciclos** — Temporal window cycle view with drill-down into buy orders per cycle
- **Calculadora** — Rate/profit calculator (inspired by Excel), commission calculator, P2P profile calculator
- **Import/Export** — Load and save the exact same `expediente` JSON format used by the bot

## Quick Start

```bash
chmod +x setup.sh
./setup.sh          # installs deps + starts dev server at localhost:3000
```

## Deploy to GitHub Pages

```bash
# 1. Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/god-analyzer-ui.git

# 2. Deploy
./setup.sh deploy
```

## Expediente JSON Format

The app reads/writes the same JSON structure as `data/expedientes/`:

```json
{
  "chat_id": "T_",
  "date": "2026-04-19",
  "orders": [
    {
      "order_number": "22874584938146082816",
      "order_type": "buy",
      "usdt_amount": 23.16,
      "fiat_amount": 14304.46,
      "unit_price": 616.136,
      "commission_usdt": 0.05,
      "is_pago_movil": true,
      "is_expense": false,
      "payment_method": "Pago Movil",
      "counterparty": "忍耐力",
      "created_at": "2026-04-13T10:16:41",
      "source": "ocr"
    }
  ],
  "cycles": [],
  "stats": {},
  "bank_receipts": []
}
```

Cycles and stats are **recomputed on load** from orders — same temporal window model as the bot.

## Commission Model

- Buy: 0.25% base + 0.30% if `is_pago_movil`
- Sell: 0.25% base
- Expense: any order with `is_expense: true` is excluded from cycle calculations

## Setup Commands

| Command | Action |
|---------|--------|
| `./setup.sh` | Install + dev server |
| `./setup.sh install` | npm install only |
| `./setup.sh build` | Production build |
| `./setup.sh deploy` | Build + GitHub Pages |
| `./setup.sh clean` | Remove node_modules + build |
| `./setup.sh git-init` | Init git repo |
