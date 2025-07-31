import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.0.5/+esm";
export const mdToHtml = (md) => DOMPurify.sanitize(marked.parse(md, { gfm: true }));
