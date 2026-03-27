"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import Script from "next/script";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GoogleTokenClient, GoogleTokenResponse } from "@/types/google";

type ConvertResponse = {
  plainText: string;
  requests: unknown[];
  error?: string;
};

type CreateDocResponse = {
  documentId?: string;
  title?: string;
  googleDocUrl?: string;
  plainText?: string;
  error?: string;
  details?: string;
};

const SAMPLE_MARKDOWN = `# Product Requirements

This is **bold**, *italic*, and \`inline code\`.

## Features

- Upload markdown file
- Paste markdown text
- Create Google Docs output

### Reference

Visit [Google Docs](https://docs.google.com).
`;

export default function Home() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [title, setTitle] = useState("Converted Markdown Document");
  const [requestsCount, setRequestsCount] = useState<number>(0);
  const [docUrl, setDocUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const googleClientId = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    []
  );

  const onFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const fileText = await file.text();
    setMarkdown(fileText);
    setStatus(`Loaded file: ${file.name}`);
    setError("");
  };

  const convertOnly = async () => {
    try {
      setIsConverting(true);
      setError("");
      setStatus("Converting markdown...");
      setDocUrl("");

      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });

      const result = (await response.json()) as ConvertResponse;

      if (!response.ok || result.error) {
        setError(result.error ?? "Conversion failed.");
        setStatus("");
        return;
      }

      setRequestsCount(result.requests.length);
      setStatus("Converted successfully.");
    } catch (caughtError: unknown) {
      setStatus("");
      setError(
        caughtError instanceof Error ? caughtError.message : "Conversion failed."
      );
    } finally {
      setIsConverting(false);
    }
  };

  const requestGoogleAccessToken = () =>
    new Promise<string>((resolve, reject) => {
      if (!googleClientId) {
        reject(
          new Error(
            "NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing. Add it in your environment configuration."
          )
        );
        return;
      }

      if (!window.google?.accounts?.oauth2) {
        reject(
          new Error(
            "Google Identity Services script is not loaded. Reload page and try again."
          )
        );
        return;
      }

      const callback = (tokenResponse: GoogleTokenResponse) => {
        if (tokenResponse.error || !tokenResponse.access_token) {
          reject(
            new Error(
              tokenResponse.error_description ||
                tokenResponse.error ||
                "Failed to acquire Google access token."
            )
          );
          return;
        }
        resolve(tokenResponse.access_token);
      };

      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope:
          "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file",
        callback,
      });

      tokenClientRef.current.requestAccessToken({ prompt: "consent" });
    });

  const createGoogleDoc = async () => {
    try {
      setIsCreatingDoc(true);
      setError("");
      setStatus("Requesting Google access token...");
      setDocUrl("");

      const accessToken = await requestGoogleAccessToken();

      setStatus("Creating formatted Google Doc...");
      const response = await fetch("/api/google-docs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          title,
          accessToken,
        }),
      });

      const result = (await response.json()) as CreateDocResponse;
      if (!response.ok || result.error) {
        setError(
          [result.error, result.details].filter(Boolean).join(" ") ||
            "Google Docs creation failed."
        );
        setStatus("");
        return;
      }

      setDocUrl(result.googleDocUrl ?? "");
      setStatus("Google Doc created successfully.");
    } catch (caughtError: unknown) {
      setStatus("");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Google Docs creation failed."
      );
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const copyPreview = async () => {
    try {
      setIsCopying(true);
      setError("");
      setStatus("Copying preview...");
      const html = previewRef.current?.innerHTML ?? "";

      if (
        html &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard &&
        "write" in navigator.clipboard
      ) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(markdown);
      }

      setStatus("Preview copied to clipboard.");
    } catch (caughtError: unknown) {
      setStatus("");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to copy preview."
      );
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 px-4 py-8 text-slate-100 md:px-8 md:py-10">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl">
                Markdown to Google Docs Converter
              </h1>
              <p className="text-sm text-slate-200/90 md:text-base">
                Write markdown, preview it live, copy rich formatting, and push to
                Google Docs in one flow.
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/50 bg-cyan-400/20 px-4 py-1 text-xs font-semibold tracking-wide text-cyan-100">
              Live Preview
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-semibold text-slate-100">
              Google Doc title
            </label>
            <input
              id="title"
              className="w-full rounded-xl border border-white/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="fileUpload"
              className="text-sm font-semibold text-slate-100"
            >
              Upload Markdown file
            </label>
            <input
              id="fileUpload"
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="block w-full rounded-xl border border-white/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-fuchsia-400"
              onChange={onFileUpload}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
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

          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:from-indigo-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void convertOnly();
              }}
              disabled={isConverting || isCreatingDoc || !markdown.trim()}
            >
              {isConverting ? "Converting..." : "Convert to Requests"}
            </button>

            <button
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:scale-[1.02] hover:from-cyan-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void createGoogleDoc();
              }}
              disabled={isConverting || isCreatingDoc || !markdown.trim()}
            >
              {isCreatingDoc ? "Creating Google Doc..." : "Create Google Doc"}
            </button>

            <button
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:from-fuchsia-400 hover:to-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void copyPreview();
              }}
              disabled={isConverting || isCreatingDoc || isCopying || !markdown.trim()}
            >
              {isCopying ? "Copying..." : "Copy Preview"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="mb-2 text-lg font-bold text-cyan-200">Markdown Preview</h2>
            <p className="mb-3 text-sm text-slate-200">
              Generated Google Docs requests:{" "}
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-semibold text-cyan-100">
                {requestsCount}
              </span>
            </p>
            <div
              ref={previewRef}
              className="min-h-80 w-full overflow-auto rounded-xl border border-white/25 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 [&_a]:text-cyan-300 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-fuchsia-400/70 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-700 [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-2 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-slate-800 [&_pre]:p-2"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="mb-3 text-lg font-bold text-fuchsia-200">Status</h2>
            {status ? (
              <p className="rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
                {status}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                {error}
              </p>
            ) : null}
            {docUrl ? (
              <p className="mt-3 rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100">
                Open document:{" "}
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cyan-200 underline hover:text-cyan-100"
                >
                  {docUrl}
                </a>
              </p>
            ) : null}

            {!googleClientId ? (
              <p className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
                Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google
                Docs export.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
