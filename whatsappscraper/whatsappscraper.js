export function whatsappMessages() {
  const messages = [];
  let lastAuthor;
  let lastTime;
  for (const el of document.querySelectorAll('#main [role="row"]')) {
    let [isSystemMessage, userId, _userDomain, messageId, authorPhone, _authorDomain] = el
      .querySelector("[data-id]")
      .dataset.id.split(/[_@]/);
    isSystemMessage = isSystemMessage === "true";
    let isRecalled = !!el.querySelector('[data-icon="recalled"]');
    const message = { messageId, authorPhone, isSystemMessage, isRecalled, userId };
    if (isSystemMessage && !isRecalled) message.text = el.outerText;
    if (!isSystemMessage && !isRecalled) {
      // TODO: Image links
      // TODO: Forwarded flag
      message.text = el.querySelector(".selectable-text")?.outerText;
      message.author = el.querySelector('[role=""] [dir]')?.textContent;

      // If it's a system message, e.g. adding/deleting a user, deleting a message, etc. use raw text
      if (!message.text) message.text = el.textContent;
      // If it's not a system message and the author is missing, it must be the last author
      else if (!message.author) message.author = lastAuthor;

      // Time is often available in data-pre-plain-text="[10:33 am, 8/5/2025] +91 99999 99999: "
      message.time = extractDate(el.querySelector("[data-pre-plain-text]")?.dataset.prePlainText);
      // If not, the hh:mm am/pm is available in the last dir="auto"
      if (!message.time) {
        const auto = [...el.querySelectorAll('[dir="auto"]')].at(-1);
        if (auto) message.time = updateTime(lastTime, auto.textContent);
        // This can happen for pinned messages
        else console.log("MISSING TIME", el, message);
      }
    }
    lastTime = message.time;
    lastAuthor = message.author;

    // Get quote information if it exists
    const quote = el.querySelector('[aria-label="Quoted message" i]');
    if (quote) {
      const quoteAuthorNoLabel = quote.querySelector('[role=""] :not([aria-label])')?.textContent;
      const quoteAuthorLabel = quote.querySelector('[role=""] [aria-label]')?.textContent;
      if (quoteAuthorLabel) {
        // Ensure quoteAuthorPhone matches authorPhone format
        message.quoteAuthorPhone = quoteAuthorNoLabel.replace(/[^0-9]+/g, "");
        message.quoteAuthor = quoteAuthorLabel;
      } else message.quoteAuthor = quoteAuthorNoLabel;
      message.quoteText = quote.querySelector(".quoted-mention")?.outerText;
      // Find previous message
      if (message.quoteText)
        for (let j = messages.length - 1; j >= 0; j--) {
          const quoteText = message.quoteText.replace(/\s+/gs, " ");
          if (message.quoteAuthor == messages[j].author && messages[j].text)
            if (messages[j].text.replace(/\s+/gs, " ").startsWith(quoteText)) {
              // NOTE: If the previous message was edited, we won't find it.
              message.quoteMessageId = messages[j].messageId;
              break;
            }
        }
    }
    const reactions = el.querySelector('[aria-label^="Reactions "],[aria-label^="reaction "]');
    if (reactions)
      message.reactions = reactions
        .getAttribute("aria-label")
        .replace(/^reactions? */i, "")
        .replace(/ *in total$/i, "");
    messages.push(message);
  }
  return messages;
}

function extractDate(dateString) {
  const match = dateString?.match?.(/\[(\d{1,2}:\d{2}\s?[ap]m),\s?(\d{1,2})\/(\d{1,2})\/(\d{4})\]/);
  return match ? new Date(`${match[4]}-${match[3]}-${match[2]} ${match[1]}`) : null;
}

// If lastTime an ISO string and time is like "10:18 pm", return lastTime updated with time as ISO
function updateTime(lastTime, time) {
  const match = time.match(/(\d+):(\d+)\s+(am|pm)/i);
  if (!match) return null;
  const [h, m] = match.slice(1, 3).map(Number);
  const isPM = /pm/i.test(time);
  const date = lastTime ? new Date(lastTime) : new Date();
  date.setHours((h % 12) + (isPM ? 12 : 0), m, 0, 0);
  return date.toISOString();
}

export async function scrape() {
  const messages = whatsappMessages();
  const text = JSON.stringify(messages, null, 2);
  await navigator.clipboard.writeText(text);
}
