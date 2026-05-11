import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import {
  createInviteScraperState,
  invitationMonthFromAge,
  linkedinInvites,
  mergeInvites,
  scrapeInvites,
} from "./linkedinscraper.js";

describe("linkedinscraper invite scraper", () => {
  let window;
  let document;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    window = new Window({ url: "https://www.linkedin.com/mynetwork/invitation-manager/received/" });
    document = window.document;
    window.scrollTo = vi.fn();
    window.scrollBy = vi.fn();
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderInvites(html) {
    document.body.innerHTML = html;
    return linkedinInvites(document);
  }

  it("extracts descriptions, common organizations, ages, and verified badges", () => {
    const invites = renderInvites(`
      <div role="listitem" componentkey="urn:li:invitation:1">
        <a href="/in/alex-example/"><strong>Alex Example <svg aria-label="Verified" role="img"></svg></strong></a>
        <p>Alex Example follows you and is inviting you to connect</p>
        <p>Institute Alpha | University Beta | ARN-123</p>
        <div><svg id="company-accent-4"></svg><p>Institute Alpha</p></div>
        <p>Yesterday</p>
        <button aria-label="Ignore an invitation to connect from Alex Example">Ignore</button>
        <button aria-label="Accept Alex Example’s invitation">Accept</button>
      </div>
    `);

    expect(invites).toEqual([
      {
        name: "Alex Example",
        description: "Institute Alpha | University Beta | ARN-123",
        profileUrl: "https://www.linkedin.com/in/alex-example/",
        followsYou: true,
        invitationMonth: "2026-05",
        connectionsCount: 0,
        commonOrgs: ["Institute Alpha"],
        badges: ["verified"],
      },
    ]);
  });

  it("parses mutual connection names and total counts", () => {
    const invites = renderInvites(`
      <div role="listitem" componentkey="urn:li:invitation:2">
        <a href="/in/bee-example/"><strong>Bee Example</strong></a>
        <p>Bee Example follows you and is inviting you to connect</p>
        <p>AI Product Manager</p>
        <p>Casey Ray and 8 other mutual connections</p>
        <p>1 week ago</p>
        <button aria-label="Accept Bee Example’s invitation">Accept</button>
      </div>
      <div role="listitem" componentkey="urn:li:invitation:3">
        <a href="/in/cam-example/"><strong>Cam Example</strong></a>
        <p>Cam Example is inviting you to connect</p>
        <p>Researcher</p>
        <p>Drew Stone is a mutual connection</p>
        <p>3 months ago</p>
        <button aria-label="Accept Cam Example’s invitation">Accept</button>
      </div>
      <div role="listitem" componentkey="urn:li:invitation:4">
        <a href="/in/dee-example/"><strong>Dee Example</strong></a>
        <p>Dee Example is inviting you to connect</p>
        <p>Engineer</p>
        <p>1 mutual connection</p>
        <p>Today</p>
        <button aria-label="Accept Dee Example’s invitation">Accept</button>
      </div>
    `);

    expect(invites[0]).toMatchObject({
      connections: ["Casey Ray"],
      connectionsCount: 9,
      invitationMonth: "2026-05",
    });
    expect(invites[1]).toMatchObject({
      connections: ["Drew Stone"],
      connectionsCount: 1,
      invitationMonth: "2026-02",
    });
    expect(invites[2]).toMatchObject({
      connectionsCount: 1,
      invitationMonth: "2026-05",
    });
    expect(invites[2]).not.toHaveProperty("connections");
  });

  it("extracts premium/open-to-work badges and full messages after actions", () => {
    const invites = renderInvites(`
      <div role="listitem" componentkey="urn:li:invitation:5">
        <svg aria-label="Priya Sample open to work, profile picture"></svg>
        <a href="/in/priya-sample/"><strong>Priya Sample <span aria-label="Premium"></span></strong></a>
        <p>Priya Sample follows you and is inviting you to connect</p>
        <p>Sales at ExampleCo</p>
        <p>ExampleCo</p>
        <p>2 weeks ago</p>
        <button>Ignore</button>
        <button>Accept</button>
        <p>Hi Anand, I recently joined ExampleCo. Happy to connect.</p>
        <button>… show more</button>
        <button>Reply to Priya</button>
        <button aria-label="Show more actions"></button>
      </div>
    `);

    expect(invites[0]).toMatchObject({
      name: "Priya Sample",
      commonOrgs: ["ExampleCo"],
      badges: ["openToWork", "premium"],
      invitationMonth: "2026-04",
      message: "Hi Anand, I recently joined ExampleCo. Happy to connect.",
    });
  });

  it("converts relative invitation ages to best-guess months", () => {
    const now = new Date("2026-05-11T12:00:00Z");

    expect(invitationMonthFromAge("12 hours ago", now)).toBe("2026-05");
    expect(invitationMonthFromAge("Yesterday", now)).toBe("2026-05");
    expect(invitationMonthFromAge("2 weeks ago", now)).toBe("2026-04");
    expect(invitationMonthFromAge("3 months ago", now)).toBe("2026-02");
    expect(invitationMonthFromAge("1 year ago", now)).toBe("2025-05");
  });

  it("merges invite updates while preserving first-seen order", () => {
    const state = createInviteScraperState();
    mergeInvites(
      [
        { name: "First Person", profileUrl: "https://www.linkedin.com/in/first/", invitationMonth: "2026-05" },
        { name: "Second Person", profileUrl: "https://www.linkedin.com/in/second/", message: "Short" },
      ],
      state,
    );
    mergeInvites(
      [
        {
          name: "Second Person",
          profileUrl: "https://www.linkedin.com/in/second/",
          message: "A longer message that loaded after expansion",
          badges: ["verified"],
        },
      ],
      state,
    );

    expect(Object.values(state.invitesByKey)).toEqual([
      {
        name: "First Person",
        profileUrl: "https://www.linkedin.com/in/first/",
        invitationMonth: "2026-05",
        _order: 0,
      },
      {
        name: "Second Person",
        profileUrl: "https://www.linkedin.com/in/second/",
        message: "A longer message that loaded after expansion",
        badges: ["verified"],
        _order: 1,
      },
    ]);
  });

  it("auto-scrolls, updates the copy button, and copies ordered JSON", async () => {
    document.body.innerHTML = `
      <main>
        <div role="listitem" componentkey="urn:li:invitation:6">
          <a href="/in/rio-sample/"><strong>Rio Sample</strong></a>
          <p>Rio Sample follows you and is inviting you to connect</p>
          <p>Designer</p>
          <p>12 hours ago</p>
          <button aria-label="Accept Rio Sample’s invitation">Accept</button>
        </div>
      </main>
    `;
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const state = createInviteScraperState();
    scrapeInvites({ document, navigator: { clipboard }, state });

    expect(document.getElementById("linkedinscraper-invites-copy-btn").textContent).toBe("Copy 1 invites");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);

    vi.advanceTimersByTime(1000);
    expect(window.scrollBy).toHaveBeenCalled();

    document.getElementById("linkedinscraper-invites-copy-btn").click();
    await Promise.resolve();
    expect(clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(
        [
          {
            name: "Rio Sample",
            description: "Designer",
            profileUrl: "https://www.linkedin.com/in/rio-sample/",
            followsYou: true,
            invitationMonth: "2026-05",
            connectionsCount: 0,
          },
        ],
        null,
        2,
      ),
    );
  });
});
