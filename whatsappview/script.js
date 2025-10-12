import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";

const $form = document.querySelector("#form");
const $json = document.querySelector("#json");
const $threads = document.querySelector("#threadContainer");
const copyBtn = document.querySelector("#copyMarkdown");
const defaultCopyLabel = copyBtn?.innerHTML ?? "";
let currentThreads = [];

if ($form) saveform("#form");

$form?.addEventListener("submit", (e) => {
  e.preventDefault();
  copyBtn.disabled = true;
  copyBtn.innerHTML = defaultCopyLabel;

  let messages = JSON.parse($json.value || "[]");
  const threads = threadMessages(messages);
  currentThreads = threads;
  $threads.innerHTML = renderThreads(threads);
  copyBtn.disabled = !threads.length;
});

copyBtn?.addEventListener("click", async () => {
  if (!currentThreads.length) return;
  const ok = await copyText(messagesToMarkdown(currentThreads));
  copyBtn.innerHTML = ok
    ? '<i class="bi bi-clipboard-check"></i> Copied!'
    : '<i class="bi bi-clipboard-x"></i> Copy failed';
  setTimeout(() => (copyBtn.innerHTML = defaultCopyLabel), 2000);
});

function threadMessages(messages) {
  const lookup = new Map(messages.map((m) => [m.messageId, m]));
  const threads = [];
  for (const message of messages) {
    if (message.quoteMessageId) {
      const quote = lookup.get(message.quoteMessageId);
      if (!quote.replies) quote.replies = [];
      quote.replies.push(message);
    } else {
      threads.push(message);
    }
  }
  return threads;
}

function renderThreads(threads) {
  let lastDate = null;

  return threads
    .filter((d) => d.text && d.time)
    .map((thread) => {
      const dateTime = new Date(thread.time);
      const date = dateTime.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });
      const time = dateTime
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();

      // Check if we should show the date (only if different from previous message)
      const showDate = date !== lastDate;
      lastDate = date;

      // Generate thread HTML with replies
      let threadHtml = `
          <div class="thread mb-3">
            <div class="d-flex justify-content-between align-items-start">
                <div class="message-content d-flex">
                  <strong class="author">${thread.author}</strong>
                  <span class="message-text ms-2">${thread.text}${thread.reactions ? ` [${thread.reactions}]` : ""}</span>
                </div>
                <div class="message-meta text-end text-muted small text-nowrap">
                  ${showDate ? `${date}` : ""} ${time}
                </div>
              </div>
        `;

      // Add replies if they exist
      if (thread.replies && thread.replies.length > 0) {
        let replyLastDate = date;

        threadHtml += '<div class="replies ms-4 mt-2 border-start border-dark ps-3">';
        threadHtml += thread.replies
          .map((reply) => {
            const replyDateTime = new Date(reply.time);
            const replyDate = replyDateTime.toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
            });
            const replyTime = replyDateTime
              .toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
              .toLowerCase();

            // Check if we should show the date for this reply
            const showReplyDate = replyDate !== replyLastDate;
            replyLastDate = replyDate;

            return `
              <div class="reply d-flex justify-content-between align-items-start mb-2">
                <div class="message-content">
                  <strong class="author">${reply.author}</strong>
                  <span class="message-text ms-2">${reply.text}${reply.reactions ? ` [${reply.reactions}]` : ""}</span>
                </div>
                <div class="message-meta text-end text-muted small text-nowrap">
                  ${showReplyDate ? `${replyDate}` : ""} ${replyTime}
                </div>
              </div>
            `;
          })
          .join("");
        threadHtml += "</div>";
      }

      threadHtml += "</div>";
      return threadHtml;
    })
    .join("");
}

function messagesToMarkdown(threads) {
  const formatDateParts = (value) => {
    const dateTime = value ? new Date(value) : null;
    if (!dateTime || Number.isNaN(dateTime.getTime())) return { date: "", time: "" };
    return {
      date: dateTime.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      time: dateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase(),
    };
  };

  const lines = [];
  const walk = (message, depth) => {
    if (!message.text || !message.time) return;
    const { date, time } = formatDateParts(message.time);
    const when = [date, time].filter(Boolean).join(" ").trim() || "unknown time";
    const author = escapeMarkdown(message.author || "Unknown");
    const text = escapeMarkdown(message.text).replace(/\s+/g, " ").trim();
    let line = `${"  ".repeat(depth)}- **${author}**: ${text} (${when})`;
    if (message.reactions) line += ` [${escapeMarkdown(message.reactions)}]`;
    lines.push(line);
    if (message.replies) for (const reply of message.replies) walk(reply, depth + 1);
  };
  for (const thread of threads) walk(thread, 0);
  return lines.join("\n");
}

function escapeMarkdown(text) {
  return String(text).replace(/([\\`*_{}[\]()#+\-!.>])/g, "\\$1");
}
