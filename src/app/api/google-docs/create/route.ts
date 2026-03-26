import { NextRequest, NextResponse } from "next/server";
import { convertMarkdownToDocsRequests } from "@/lib/markdownToDocs";

const GOOGLE_DOCS_CREATE_URL = "https://docs.googleapis.com/v1/documents";

type CreateDocRequestBody = {
  markdown?: string;
  title?: string;
  accessToken?: string;
};

type GoogleDocCreateResponse = {
  documentId: string;
  title?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateDocRequestBody;
  const markdown = body.markdown?.trim();
  const title = body.title?.trim() || "Converted Markdown Document";
  const accessToken = body.accessToken?.trim();

  if (!markdown) {
    return NextResponse.json(
      { error: "markdown is required and cannot be empty." },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "accessToken is required." },
      { status: 400 }
    );
  }

  const conversion = await convertMarkdownToDocsRequests(markdown);

  const createResponse = await fetch(GOOGLE_DOCS_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title }),
  });

  if (!createResponse.ok) {
    const details = await createResponse.text();
    return NextResponse.json(
      { error: "Failed to create Google Doc.", details },
      { status: createResponse.status }
    );
  }

  const createdDoc = (await createResponse.json()) as GoogleDocCreateResponse;

  if (!createdDoc.documentId) {
    return NextResponse.json(
      { error: "Google Docs API did not return a documentId." },
      { status: 502 }
    );
  }

  const batchResponse = await fetch(
    `${GOOGLE_DOCS_CREATE_URL}/${createdDoc.documentId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: conversion.requests,
      }),
    }
  );

  if (!batchResponse.ok) {
    const details = await batchResponse.text();
    return NextResponse.json(
      {
        error: "Document created, but failed to apply formatted content.",
        documentId: createdDoc.documentId,
        details,
      },
      { status: batchResponse.status }
    );
  }

  return NextResponse.json({
    documentId: createdDoc.documentId,
    title: createdDoc.title ?? title,
    googleDocUrl: `https://docs.google.com/document/d/${createdDoc.documentId}/edit`,
    plainText: conversion.plainText,
  });
}
