#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRE_PLAIN_TEXT_REGEX = /\[(\d{1,2}:\d{2}\s?[ap]m),\s?(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.+?):\s*$/;
const PRE_PLAIN_TEXT_ATTR_REGEX = /data-pre-plain-text=("|')([\s\S]*?)\1/g;
const PHONE_SCAN_REGEX = /\+\d[\d\s-]{3,}\d/g;

function decodeHtmlEntities(value) {
  if (!value) return value;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(x?[0-9a-fA-F]+);/g, (_, code) => {
      const isHex = /^x/i.test(code);
      const num = Number.parseInt(isHex ? code.slice(1) : code, isHex ? 16 : 10);
      if (!Number.isFinite(num)) return _;
      return String.fromCodePoint(num);
    });
}

function isPhoneLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return false;
  if (/[a-z]/i.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6;
}

function extractDateAndPhone(prePlainText) {
  if (!prePlainText) return null;
  const match = prePlainText.match(PRE_PLAIN_TEXT_REGEX);
  if (!match) return null;
  return match[5].trim();
}

export function extractWhatsAppPhoneNumbers(input) {
  const html =
    typeof input === "string"
      ? input
      : typeof input?.documentElement?.outerHTML === "string"
        ? input.documentElement.outerHTML
        : "";
  const numbers = [];
  const seen = new Set();

  const add = (value) => {
    if (!value) return;
    const normalized = value.trim();
    if (!isPhoneLike(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    numbers.push(normalized);
  };

  let attrMatch;
  while ((attrMatch = PRE_PLAIN_TEXT_ATTR_REGEX.exec(html))) {
    const decoded = decodeHtmlEntities(attrMatch[2]);
    const phone = extractDateAndPhone(decoded);
    if (phone) add(phone);
  }

  let scanMatch;
  while ((scanMatch = PHONE_SCAN_REGEX.exec(html))) {
    add(scanMatch[0]);
  }

  return numbers;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node whatsappscraper-cli.js <file.html>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  const html = await fs.readFile(absolutePath, "utf8");
  const numbers = extractWhatsAppPhoneNumbers(html);
  console.log(JSON.stringify(numbers, null, 2));
}

const cliPath = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] || "") === path.resolve(cliPath)) {
  main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}
