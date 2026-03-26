# Markdown to Google Docs Converter

A production-ready Next.js app that converts Markdown input (paste or file upload) into:

- formatted Google Docs output, and
- plain text output preview.

It is built to deploy on **Vercel** with no paid infrastructure.

## What formatting is preserved

The converter maps Markdown structure to Google Docs requests, including:

- Headings (`#` to `######`)
- Paragraphs
- Bold / italic
- Inline code
- Links
- Ordered and unordered lists (including nested depth via indentation)
- Blockquotes
- Code blocks
- Horizontal rules
- GFM tables (rendered with alignment-aware monospace layout to preserve visual parity)
- Images (`http/https` URLs inserted as inline images, relative/local paths preserved as fallback markdown text)
- Footnotes (references in content + generated Footnotes section with resolved definitions)

## Tech stack

- Next.js (App Router, TypeScript)
- `remark` + `remark-parse` + `remark-gfm`
- Google Docs REST API (`documents.create` + `documents.batchUpdate`)
- Google Identity Services (OAuth token in browser)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env.local
```

3. Set your Google OAuth client ID:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

4. Run development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Google Cloud setup

1. Create a Google Cloud project.
2. Enable **Google Docs API** and **Google Drive API**.
3. Configure OAuth consent screen (external/internal as needed).
4. Create OAuth client credentials of type **Web application**.
5. Add authorized JavaScript origins:
   - `http://localhost:3000`
   - your Vercel domain(s), e.g. `https://your-app.vercel.app`
6. Put the client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Required scope requested by app:

- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/drive.file`

## API endpoints

- `POST /api/convert`
  - Input: `{ markdown: string }`
  - Output: `{ plainText, requests }`

- `POST /api/google-docs/create`
  - Input: `{ markdown: string, title?: string, accessToken: string }`
  - Output: `{ documentId, title, googleDocUrl, plainText }`

## Deploy on Vercel (free)

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add environment variable:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
4. Deploy.
5. In Google Cloud OAuth settings, add your Vercel domain in authorized origins.

## Notes

- Access tokens are obtained in browser and sent only for live API calls.
- No token persistence is implemented.
- If you need exact enterprise-level layout parity (tables/images/footnotes), extend the converter in `src/lib/markdownToDocs.ts`.
