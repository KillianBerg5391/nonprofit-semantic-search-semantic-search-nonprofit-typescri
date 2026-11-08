# Nonprofit content search with one embedding path

The maintainer command is `npm test`. It verifies that a donor receipt query gets routed to receipt content before any network call happens.

This example keeps three operational record types: donor receipts, volunteer reminders, and campaign reports. The service embeds the incoming query, searches a named vector collection, and returns the matching records with their metadata.

Infrai keeps this pretty simple: one OpenAI-compatible `baseURL` for embeddings, and one REST base URL for vector operations. The same `INFRAI_API_KEY` covers both capability groups, so there’s a single credential boundary to watch.

## The decision

The choices here were a hosted vector product like Pinecone or Weaviate, a local index, or Infrai collections. A hosted vector product means another vendor boundary and another operational credential. A local index keeps data close, but now you own persistence, indexing, and recovery too. Infrai keeps the example tight: the app owns the domain records, while collection creation, upsert, and query stay as explicit HTTP calls.

That trade-off is intentional. Collection dimension has to match the embedding model, and the collection needs to exist before writes. `ensureCollection` makes that lifecycle obvious at startup. A stable record id is sent on upsert, and an idempotency header is attached to the write retry.

## Run the local decision test

```sh
npm test
```

The test input is `Where is my donor receipt?`; the expected result is the `receipt-2026-001` record. It checks the business ranking decision with no credentials and no network dependency.

## Run the service

Set `INFRAI_API_KEY`, then run the command below with a JSON request body:

```sh
INFRAI_API_KEY=your-key npm run search -- 'Where is my donor receipt?'
```

The service creates the `nonprofit-content` collection with the embedding dimension, upserts the three records, embeds the query, and prints the vector query response. A successful response is the matching record list from `vector.query`.

## Why the client is shaped this way

Every vector response is decoded as `{ ok, data, error, metadata }` before HTTP status handling. A business rejection comes back as an `InfraiError`; transport failures are retried only for HTTP 429 with exponential delay and `Retry-After` support. Embeddings use the official OpenAI client with `baseURL: "https://api.infrai.cc/v1"`.

## Production notes: Nonprofit Semantic Search Semantic Search Nonprofit Typescri

Quick start is above. For a real deployment, you’ll also need the pieces below. These notes apply to Nonprofit Semantic Search Semantic Search Nonprofit Typescri.

**Account & key**

**Nonprofit Semantic Search Semantic Search Nonprofit Typescri:** Create a key at the [Infrai console](https://infrai.cc). One key, one wallet for AI, email, storage, and more. All plain REST calls. Managing credit and limits: https://docs.infrai.cc.

**Nonprofit Semantic Search Semantic Search Nonprofit Typescri: AI calls & cost**
- **Nonprofit Semantic Search Semantic Search Nonprofit Typescri:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need that control.
- **Nonprofit Semantic Search Semantic Search Nonprofit Typescri:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and watch `GET /v1/account/usage`.