import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
const $form = document.querySelector("#form");
$form && saveform("#form");

$form.addEventListener("submit", (e) => {
  e.preventDefault();
  const messages = JSON.parse(document.querySelector("#json").value);
  const threads = threadMessages(messages);
  document.querySelector("#threadContainer").innerHTML = renderThreads(threads);
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
      // Format the date and time
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
                <span class="message-text ms-2">${thread.text}</span>
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
                  <span class="message-text ms-2">${reply.text}</span>
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
