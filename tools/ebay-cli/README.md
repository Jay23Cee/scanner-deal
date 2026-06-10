# eBay CLI Prototype

This folder keeps the original Python CLI as a developer-side API test tool.

It is no longer the main product. The real app lives at the repo root as the Next.js `eBay Resale Scanner`.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The CLI reads credentials from the root `.env.local`.

Use `EBAY_ENV=production` for real active listings. Set `EBAY_ENV=sandbox` only when
you intentionally want to hit eBay's sandbox OAuth and Browse hosts.

## Commands

```powershell
python -m src.main search "iphone 15 pro max"
python -m src.main orders
```
