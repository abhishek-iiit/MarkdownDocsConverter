"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import Script from "next/script";
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
  const [plainText, setPlainText] = useState("");
  const [requestsCount, setRequestsCount] = useState<number>(0);
  const [docUrl, setDocUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);

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

      setPlainText(result.plainText);
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

      setPlainText(result.plainText ?? "");
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Markdown to Google Docs Converter
        </h1>
        <p className="text-sm text-slate-600">
          Paste Markdown or upload an <code>.md</code> file, preview plain text
          output, and create a formatted Google Doc.
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Google Doc title
          </label>
          <input
            id="title"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fileUpload" className="text-sm font-medium">
            Upload Markdown file
          </label>
          <input
            id="fileUpload"
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={onFileUpload}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label htmlFor="markdown" className="text-sm font-medium">
            Markdown input
          </label>
          <textarea
            id="markdown"
            className="min-h-72 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void convertOnly();
            }}
            disabled={isConverting || isCreatingDoc || !markdown.trim()}
          >
            {isConverting ? "Converting..." : "Convert to Text + Requests"}
          </button>

          <button
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void createGoogleDoc();
            }}
            disabled={isConverting || isCreatingDoc || !markdown.trim()}
          >
            {isCreatingDoc ? "Creating Google Doc..." : "Create Google Doc"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Conversion Result</h2>
          <p className="mb-2 text-sm text-slate-600">
            Generated Google Docs requests:{" "}
            <span className="font-semibold">{requestsCount}</span>
          </p>
          <textarea
            readOnly
            className="min-h-72 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            value={plainText}
            placeholder="Plain text output will appear here..."
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Status</h2>
          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {docUrl ? (
            <p className="mt-3 text-sm">
              Open document:{" "}
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline"
              >
                {docUrl}
              </a>
            </p>
          ) : null}

          {!googleClientId ? (
            <p className="mt-4 text-sm text-amber-700">
              Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google
              Docs export.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
