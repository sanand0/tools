import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

function createPeerStub(dataChannel, remoteStream) {
  const peer = {
    addEventListener: vi.fn(),
    addTrack: vi.fn(),
    close: vi.fn(),
    createDataChannel: vi.fn(() => dataChannel),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" })),
    setLocalDescription: vi.fn(async () => undefined),
    setRemoteDescription: vi.fn(async () => undefined),
  };
  let ontrack;
  Object.defineProperty(peer, "ontrack", {
    get() {
      return ontrack;
    },
    set(handler) {
      ontrack = handler;
    },
  });
  peer.fireRemoteTrack = () => ontrack?.({ streams: [remoteStream] });
  return peer;
}

async function flushTasks(window) {
  await window.Promise.resolve();
  await window.Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("Voicebot", () => {
  let window;
  let document;
  let fetchMock;
  let dataChannel;
  let dataChannelHandlers;
  let peer;
  let pcFactory;
  let getUserMedia;
  let remoteStream;
  let localStream;
  let startButton;
  let messageForm;
  let userInput;
  let transcript;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));

    remoteStream = new window.MediaStream();
    const localTrack = { stop: vi.fn() };
    localStream = { getTracks: () => [localTrack] };

    dataChannelHandlers = {};
    dataChannel = {
      readyState: "connecting",
      send: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        dataChannelHandlers[event] = handler;
        if (event === "open") handler();
      }),
    };

    peer = createPeerStub(dataChannel, remoteStream);
    pcFactory = vi.fn(() => peer);
    getUserMedia = vi.fn(async () => localStream);

    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_secret: { value: "temp-secret" },
          id: "sess_123",
          model: "gpt-realtime",
        }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "answer-sdp" });

    window.voicebotTestOverrides = {
      openaiConfig: vi.fn(async () => ({ apiKey: "sk-test", baseUrl: "https://api.example.com/v1" })),
      createPeerConnection: pcFactory,
      getUserMedia,
      fetch: fetchMock,
    };

    window.fetch = fetchMock;

    startButton = document.getElementById("start-call");
    messageForm = document.getElementById("message-form");
    userInput = document.getElementById("user-message");
    transcript = document.getElementById("transcript-log");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connects to the realtime session using user credentials", async () => {
    document.getElementById("voice-name").value = "verse";
    document.getElementById("system-instructions").value = "Be a concise assistant.";

    startButton.click();
    await flushTasks(window);

    expect(window.voicebotTestOverrides.openaiConfig).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(pcFactory).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/v1/realtime/sessions");
    const sessionRequest = fetchMock.mock.calls[0][1];
    expect(sessionRequest?.method).toBe("POST");
    expect(sessionRequest?.headers?.Authorization).toBe("Bearer sk-test");
    expect(sessionRequest?.headers?.["OpenAI-Beta"]).toBe("realtime=v1");
    const requestBody = JSON.parse(sessionRequest.body);
    expect(requestBody.model).toBe("gpt-realtime");
    expect(requestBody.voice).toBe("verse");
    expect(requestBody.instructions).toContain("Be a concise assistant.");

    const sdpRequest = fetchMock.mock.calls[1][1];
    expect(sdpRequest?.headers?.Authorization).toBe("Bearer temp-secret");
    expect(sdpRequest?.headers?.["OpenAI-Beta"]).toBe("realtime=v1");
    expect(sdpRequest?.headers?.["Content-Type"]).toBe("application/sdp");

    peer.fireRemoteTrack();
    await flushTasks(window);

    expect(document.getElementById("remote-audio").srcObject).toBe(remoteStream);
    expect(document.getElementById("call-status").textContent).toMatch(/Connected/i);
  });

  it("sends messages and renders transcript updates", async () => {
    startButton.click();
    await flushTasks(window);

    dataChannel.readyState = "open";

    userInput.value = "Hello there";
    messageForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flushTasks(window);

    expect(dataChannel.send).toHaveBeenCalledTimes(2);
    const [firstPayload, secondPayload] = dataChannel.send.mock.calls.map(([payload]) => JSON.parse(payload));
    expect(firstPayload.type).toBe("conversation.item.create");
    expect(secondPayload.type).toBe("response.create");
    expect(secondPayload.response.modalities).toContain("audio");
    expect(userInput.value).toBe("");

    const messageHandler = dataChannelHandlers.message;
    expect(typeof messageHandler).toBe("function");

    messageHandler({
      data: JSON.stringify({
        type: "response.text.delta",
        response_id: "resp_1",
        output_index: 0,
        content_index: 0,
        delta: "Hi!",
      }),
    });
    await flushTasks(window);

    expect(transcript.textContent).toContain("Hi!");
  });
});
