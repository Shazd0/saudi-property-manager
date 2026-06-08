<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1asmAuonz12bASYGAKT4dSXcp7Ui4sfQl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Amlak Easy Google Sheets

Create a yearly rent and expenses workbook with one tab per month:

```bash
python tools/create_amlak_year_sheet.py --year 2026 --book-id default --local-xlsx amlak-2026.xlsx
```

To create a Google Sheet directly, install the optional Python packages and provide credentials:

```bash
pip install openpyxl firebase-admin google-api-python-client google-auth
python tools/create_amlak_year_sheet.py \
  --year 2026 \
  --book-id default \
  --firebase-credentials firebase-service-account.json \
  --google-credentials google-service-account.json \
  --share-with admin@example.com
```

The generated workbook is an `Amlak Easy Sheet`. Paste its Google Sheets URL into the Amlak Sheets Import screen, or upload the `.xlsx` file directly. Amlak will detect the new format automatically and still use the existing preview, matching, duplicate checks, and import approval flow.
