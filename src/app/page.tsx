"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SAMPLE_MARKDOWN = `# Product Requirements

This is **bold**, *italic*, and \`inline code\`.

## Features

- Paste markdown text
- See rendered markdown output

### Reference

Visit [Markdown Guide](https://www.markdownguide.org).
`;

export default function Home() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 px-4 py-8 text-slate-100 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl">
                Markdown Input / Output
              </h1>
              <p className="text-sm text-slate-200/90 md:text-base">
                Write markdown on the left and see the rendered markdown output on
                the right.
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/50 bg-cyan-400/20 px-4 py-1 text-xs font-semibold tracking-wide text-cyan-100">
              Live Preview
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          <div className="space-y-2">
            <label htmlFor="markdown" className="text-sm font-semibold text-slate-100">
              Markdown input
            </label>
            <textarea
              id="markdown"
              className="min-h-80 w-full rounded-xl border border-white/30 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
            />
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="mb-2 text-lg font-bold text-cyan-200">Markdown Output</h2>
            <div
              className="min-h-80 w-full overflow-auto rounded-xl border border-white/25 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 [&_a]:text-cyan-300 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-fuchsia-400/70 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-700 [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-2 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-slate-800 [&_pre]:p-2"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
