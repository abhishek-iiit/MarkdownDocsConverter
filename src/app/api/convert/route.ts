import { NextRequest, NextResponse } from "next/server";
import { convertMarkdownToDocsRequests } from "@/lib/markdownToDocs";

type ConvertRequestBody = {
  markdown?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConvertRequestBody;
  const markdown = body.markdown?.trim();

  if (!markdown) {
    return NextResponse.json(
      { error: "markdown is required and cannot be empty." },
      { status: 400 }
    );
  }

  const conversion = await convertMarkdownToDocsRequests(markdown);

  return NextResponse.json({
    plainText: conversion.plainText,
    requests: conversion.requests,
  });
}
