// npm run test:edge
//
// Resend can't be called from a test, so fetch is replaced by a small fake
// of the four endpoints the helper uses. Each test uses its own API key,
// because the segment id is cached per key.
import { addToNewsletterSegment, fillNewsletterSegment, newsletterSegmentId } from "./resend-segment.ts";

// A pinned segment would short-circuit the lookup these tests are about.
Deno.env.delete("NEWSLETTER_SEGMENT_ID");

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

type Route = (req: { method: string; url: URL }) => Response | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Runs `fn` with fetch answered by `route`; returns the requests made. */
async function withFetch(route: Route, fn: () => Promise<void>): Promise<string[]> {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    return Promise.resolve(route({ method, url }) ?? json({ message: "not found" }, 404));
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
  return calls;
}

const silently = async (fn: () => Promise<void>) => {
  const [error, warn] = [console.error, console.warn];
  console.error = console.warn = () => {};
  try { await fn(); } finally { [console.error, console.warn] = [error, warn]; }
};

Deno.test("the only segment is the newsletter's", async () => {
  await withFetch(({ url }) => url.pathname === "/segments" ? json({ data: [{ id: "s1", name: "General" }] }) : undefined, async () => {
    assertEquals(await newsletterSegmentId("key-only"), "s1");
  });
});

Deno.test("among several, the one named for the newsletter; none named is an error", async () => {
  const segments = [{ id: "a", name: "Registered users" }, { id: "b", name: "The RoStory newsletter" }];
  await withFetch(({ url }) => url.pathname === "/segments" ? json({ data: segments }) : undefined, async () => {
    assertEquals(await newsletterSegmentId("key-named"), "b");
  });
  await silently(() => withFetch(({ url }) => url.pathname === "/segments" ? json({ data: [segments[0], { id: "c", name: "Other" }] }) : undefined, async () => {
    assertEquals(await newsletterSegmentId("key-ambiguous"), null);
  }).then(() => {}));
});

Deno.test("the segment is looked up once per key", async () => {
  const calls = await withFetch(({ url }) => url.pathname === "/segments" ? json({ data: [{ id: "s9" }] }) : undefined, async () => {
    await newsletterSegmentId("key-once");
    await newsletterSegmentId("key-once");
  });
  assertEquals(calls, ["GET /segments"]);
});

Deno.test("adding: done, already there, or refused", async () => {
  await withFetch(({ method }) => method === "POST" ? json({ id: "seg" }) : undefined, async () => {
    assertEquals(await addToNewsletterSegment("k", "a@x.ro", "seg"), true);
  });
  // A refusal for a contact that is in fact a member counts as done.
  await withFetch(({ method, url }) =>
    method === "POST" ? json({ message: "Contact already in segment" }, 422)
      : url.pathname === "/contacts/a%40x.ro/segments" || url.pathname === "/contacts/a@x.ro/segments" ? json({ data: [{ id: "other" }, { id: "seg" }] })
      : undefined, async () => {
    assertEquals(await addToNewsletterSegment("k", "a@x.ro", "seg"), true);
  });
  await silently(() => withFetch(({ method }) => method === "POST" ? json({ message: "nope" }, 404) : undefined, async () => {
    assertEquals(await addToNewsletterSegment("k", "ghost@x.ro", "seg"), false);
  }).then(() => {}));
});

Deno.test("filling: reads every page, adds only who is missing, counts who can't be added", async () => {
  const pages: Record<string, unknown> = {
    "": { data: [{ id: "c1", email: "Ioana@Example.com" }], has_more: true },
    c1: { data: [{ id: "c2", email: "ana@example.ro" }], has_more: false },
  };
  let calls: string[] = [];
  await silently(async () => {
    calls = await withFetch(({ method, url }) => {
      if (method === "GET" && url.pathname === "/contacts") {
        assertEquals(url.searchParams.get("segment_id"), "seg");
        return json(pages[url.searchParams.get("after") ?? ""]);
      }
      if (method === "POST" && url.pathname.includes("mihai")) return json({ id: "seg" });
      return undefined; // ghost@: no such contact; its membership check fails too
    }, async () => {
      const result = await fillNewsletterSegment("k", "seg", ["ioana@example.com", " ANA@example.ro", "mihai@example.ro", "ghost@example.ro"]);
      assertEquals(result, { added: 1, missing: 1 });
    });
  });
  // Two pages of the segment, then one add each for the two missing.
  assertEquals(calls.filter((c) => c.startsWith("POST")).length, 2);
  assertEquals(calls.filter((c) => c.startsWith("GET /contacts?")).length, 2);
});

Deno.test("filling: a segment that can't be read is not guessed at", async () => {
  await silently(() => withFetch(() => json({ message: "down" }, 500), async () => {
    assertEquals(await fillNewsletterSegment("k", "seg", ["a@x.ro"]), null);
  }).then(() => {}));
});
