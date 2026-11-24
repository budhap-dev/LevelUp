---
id: messaging-event-streaming
title: "Messaging & Event Streaming"
group: backend-apis
tags: [kafka, service-bus, events, async]
level: Architect
estimatedMinutes: 90
related: [architecture-patterns, system-design, domain-driven-design, observability-sre]
lastReviewed: 2026-11-24
status: complete
---

## TL;DR

- **Queues** distribute work (each message is processed by one consumer, then gone); **logs/streams** distribute facts (messages are retained and replayable, and many consumer groups read independently).
- "Exactly-once" is end-to-end only when consumers are **idempotent**. Brokers offer at-least-once delivery plus de-duplication aids, never magic.
- **Ordering is per partition/session key**, never global at scale. Choose the key to match the entity whose order matters.
- The **dual-write problem** (update DB *and* publish) is solved with the **transactional outbox** (or CDC), not with "publish after commit and hope".
- Retries, dead-letter queues, schema evolution and consumer lag monitoring are the real design work. The happy path is easy.

## Core Concepts

### Queue vs pub/sub vs log

| Model | Example | Delivery | Retention | Typical use |
|---|---|---|---|---|
| Point-to-point queue | Azure Service Bus queue, SQS, RabbitMQ queue | One consumer per message (competing consumers) | Until acknowledged | Commands, background jobs |
| Pub/sub topic | Service Bus topics + subscriptions, SNS, Event Grid | Copy per subscription | Until each subscription acknowledges | Fan-out notifications |
| Partitioned log | Kafka, Azure Event Hubs, Kinesis | Each consumer group tracks its own offset | Time/size based, replayable | Event streaming, analytics, event sourcing feeds |

A log does not delete on read. Consumers move an **offset**, so a new service can replay history and a bug can be fixed by rewinding.

### Delivery semantics

- **At-most-once:** acknowledge before processing; a crash loses the message.
- **At-least-once:** acknowledge after processing; a crash causes redelivery, so **duplicates are normal**.
- **Exactly-once:** Kafka offers exactly-once *within Kafka* (idempotent producers + transactions across read-process-write to Kafka topics). Once you touch an external DB or API, you are back to at-least-once and need idempotency.

```ts
// Idempotent consumer: record the message id in the same transaction as the side effect.
export async function handlePaymentCaptured(msg: { id: string; orderId: string; amount: number }) {
  await db.transaction(async (tx) => {
    const inserted = await tx.query(
      'INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING 1',
      [msg.id],
    );
    if (inserted.rowCount === 0) return; // duplicate delivery: already applied

    await tx.query('UPDATE orders SET status = $1, paid_amount = $2 WHERE id = $3', ['PAID', msg.amount, msg.orderId]);
  });
}
```

### Ordering and partitioning

Kafka guarantees order **within a partition**. Messages with the same key go to the same partition, so key by the entity whose ordering matters (`orderId`, `accountId`). Consequences:

- Parallelism is capped by partition count per consumer group.
- A hot key creates a hot partition.
- Changing the partition count changes key→partition mapping for new messages (ordering across the change is not guaranteed).

Service Bus offers ordering through **sessions** (`SessionId`); one receiver holds a session lock at a time.

### Transactional outbox

```ts
// Inside the same DB transaction as the business change:
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO orders (id, status) VALUES ($1, $2)', [order.id, 'PLACED']);
  await tx.query(
    'INSERT INTO outbox (id, topic, key, payload) VALUES ($1, $2, $3, $4)',
    [crypto.randomUUID(), 'orders.v1', order.id, JSON.stringify({ type: 'OrderPlaced', orderId: order.id })],
  );
});
// A relay (poller or CDC such as Debezium) publishes outbox rows and marks them sent.
// It may publish twice after a crash — consumers must be idempotent.
```

### Retries, poison messages and DLQs

- **Transient errors** (timeouts, 503s): retry with exponential backoff and jitter.
- **Permanent errors** (validation failure, unknown entity): do not retry. Dead-letter immediately with the reason.
- Kafka has no built-in DLQ. Implement retry topics (`orders.retry.1m`, `orders.retry.10m`) and a DLQ topic, or use a framework that does.
- Service Bus dead-letters automatically after `MaxDeliveryCount`, and supports scheduled messages for delayed retry.

### Schema evolution

Producers and consumers deploy independently, so schemas must evolve compatibly. Use a schema registry with Avro, Protobuf or JSON Schema and enforce a compatibility mode (backward, forward or full). Rules of thumb: add optional fields, never reuse or repurpose fields, version the topic for breaking changes (`orders.v2`).

### Platform notes

- Kafka 4.0 removed ZooKeeper; clusters run in **KRaft** mode.
- Kafka "share groups" (KIP-932, queue-like consumption with per-record acknowledgement) were early access in 4.0, a preview in 4.1 and production-ready from 4.2 (2026). They give up per-partition ordering.
- Azure Event Hubs exposes a Kafka-compatible endpoint; Service Bus is the choice for enterprise messaging features (sessions, transactions, scheduled delivery, duplicate detection).

## How It Works

```mermaid
sequenceDiagram
  participant API as Order API
  participant DB as Orders DB
  participant Relay as Outbox relay / CDC
  participant Broker as Kafka topic (orders.v1)
  participant Billing as Billing consumer
  participant Done as processed_messages

  API->>DB: BEGIN, insert order + outbox row, COMMIT
  Relay->>DB: poll unsent outbox rows
  Relay->>Broker: publish (key = orderId)
  Relay->>DB: mark row sent
  Broker-->>Billing: deliver (at-least-once)
  Billing->>Done: insert message_id (ON CONFLICT DO NOTHING)
  alt first delivery
    Billing->>Billing: apply side effect in same transaction
  else duplicate
    Billing->>Billing: skip
  end
  Billing->>Broker: commit offset
```

## When to Use / Trade-offs

| Choice | Use when | Avoid when | Cost |
|---|---|---|---|
| Synchronous REST/gRPC | Caller needs the answer now; simple request/response | Long-running work, fan-out to many services | Temporal coupling, cascading failures |
| Queue (Service Bus, SQS) | Distributing commands/jobs, need per-message ack, DLQ, scheduling | Many independent readers, replay needed | Messages gone after ack |
| Log (Kafka, Event Hubs) | High throughput, many consumers, replay, stream processing | Small volumes with complex routing; per-message delay/priority | Operational complexity, partition design |
| Event notification (thin events) | Consumers fetch details they need | Consumers can't call back (offline, rate limits) | Extra calls, read-your-writes issues |
| Event-carried state transfer (fat events) | Consumers need autonomy and local copies | Payloads hold sensitive data many shouldn't see | Larger messages, schema coupling |

## Common Pitfalls & Anti-patterns

- **Dual writes** — committing to the DB then publishing (or the reverse) loses or invents events on crashes.
- **Assuming no duplicates** — every at-least-once system delivers duplicates eventually; non-idempotent consumers double-charge.
- **Retrying poison messages forever** — blocks a partition (Kafka) or burns compute; classify errors and dead-letter.
- **Global ordering assumptions** — designing as if all events arrive in order across keys.
- **Events as remote procedure calls** — `SendEmailToUserCommand` broadcast on a topic: this is a queue job, not an event.
- **No lag monitoring** — consumer lag is the most important health signal for streaming systems.
- **Breaking schema changes without versioning** — renaming a field takes down every consumer you didn't know about.

## Real-world Scenario

**Context:** A retailer's checkout published `OrderPlaced` to Kafka after committing the order. During a broker failover, ~0.3% of orders were never published, so the warehouse never shipped them.

**Decision:** Introduced a transactional outbox with Debezium CDC, idempotent consumers keyed on event id, and a retry/DLQ topic chain with alerting on DLQ depth. Topics were keyed by `orderId` so per-order lifecycle events stayed ordered.

**Outcome:** Zero lost orders over the next two peak seasons. Duplicate deliveries (~0.01%) were absorbed harmlessly. The DLQ surfaced a malformed-address bug within an hour instead of weeks.

**What I'd do differently:** Put a schema registry in from day one. Two later incidents were consumers breaking on an "additive" change that wasn't.

## Interview Questions

### What is the difference between a message queue and an event log like Kafka? {#queue-vs-log}

**Level:** Foundation

**Model answer:**
A queue delivers each message to one of a set of competing consumers and deletes it once acknowledged. It is ideal for distributing work. A log appends messages to partitions and retains them for a configured time. Each consumer group tracks its own offset, so many independent consumers read the same data and can replay it. Queues offer richer per-message features (DLQ, scheduling, priorities, sessions); logs offer throughput, replay and stream processing.

**What the interviewer is looking for:**
Retention vs consumption semantics, competing consumers vs consumer groups, and matching the tool to the use case.

**Follow-ups:**
- How does a Kafka consumer group scale, and what limits it?
- When would you use Azure Service Bus over Event Hubs?

**Red flags:**
- "Kafka is just a faster queue."
- Not knowing that log messages persist after consumption.

### Does exactly-once delivery exist? How do you get exactly-once *processing*? {#exactly-once}

**Level:** Senior

**Model answer:**
Over an unreliable network, delivery is at-most-once or at-least-once. Kafka's exactly-once semantics (idempotent producer + transactions) give exactly-once *within Kafka* for read-process-write pipelines. As soon as a side effect leaves Kafka (DB write, email, payment API), you need idempotency: a unique message id stored transactionally with the side effect, natural idempotency (`SET status = PAID`), or idempotency keys on downstream APIs.

**What the interviewer is looking for:**
Precision about where the guarantee holds and a concrete idempotency mechanism.

**Follow-ups:**
- How long do you keep processed message ids, and how do you clean them up?
- How do you make an email send idempotent?

**Red flags:**
- "Enable exactly-once in Kafka and you're done."
- Relying on de-duplication windows alone for financial operations.

### How do you guarantee ordering of events for a single order while still scaling consumers? {#ordering-guarantees}

**Level:** Senior

**Model answer:**
Use the order id as the partition key (Kafka) or session id (Service Bus). All events for one order land on one partition or session and are processed in sequence, while different orders spread across partitions for parallelism. Within a consumer, process a partition's messages sequentially (or parallelise per key). Watch for hot keys, and remember retries must not reorder: a failing message either blocks its key or goes to a retry path that is also keyed, with consumers tolerating out-of-order arrival using version numbers.

**What the interviewer is looking for:**
Per-key ordering, the parallelism trade-off, and awareness that retries and partition changes break naive ordering.

**Follow-ups:**
- What happens to ordering when you increase partitions?
- How would you handle one customer generating 40% of traffic?

**Red flags:**
- Claiming Kafka guarantees global ordering.
- A single partition "to be safe" for a high-volume topic.

### Explain the dual-write problem and how the transactional outbox solves it. {#outbox-pattern}

**Level:** Senior

**Model answer:**
Writing to the database and publishing to a broker are two separate systems with no shared transaction. A crash between them either loses the event (DB committed, publish failed) or emits a phantom event (published, DB rolled back). The outbox writes the event to an `outbox` table in the *same* DB transaction as the state change. A relay (poller or CDC from the transaction log) then publishes rows to the broker. The relay can publish duplicates after crashes, so consumers must be idempotent. CDC avoids polling load and preserves commit order.

**What the interviewer is looking for:**
Clear articulation of the failure modes, the pattern, and its at-least-once consequence.

**Follow-ups:**
- Polling relay vs CDC: what are the trade-offs?
- How do you keep the outbox table from growing forever?

**Red flags:**
- Suggesting distributed transactions (2PC) across DB and broker as the default.
- "Publish inside the DB transaction before commit."

### Design the retry and failure handling for an order-fulfilment consumer that calls a flaky warehouse API. {#retry-dlq-design}

**Level:** Architect

**Model answer:**
1. **Classify errors.** Transient (timeouts, 429, 5xx) vs permanent (400 validation, unknown SKU).
2. **Bounded in-process retries** with exponential backoff and jitter for brief blips, using an idempotency key on the warehouse call.
3. **Delayed retry tiers.** For Kafka, retry topics (1m, 10m, 1h) consumed by the same handler after the delay, so the main partition is not blocked. For Service Bus, scheduled re-delivery or abandon with `MaxDeliveryCount`.
4. **DLQ** for permanent failures and exhausted retries, storing the error, attempt count and original metadata.
5. **Circuit breaker** around the warehouse API. When open, pause consumption (Kafka `pause()`) rather than burning through retries.
6. **Ordering decision.** If per-order order matters, park subsequent messages for that order while one is retrying, or design the handler to tolerate reordering using versions.
7. **Operations.** Alert on DLQ depth and age, add a redrive tool with audit, add dashboards for lag and retry rates, and write a runbook.

**What the interviewer is looking for:**
Error classification, not blocking healthy traffic, idempotency, backpressure, and operability (redrive, alerts). Architect answers discuss the ordering vs availability trade-off explicitly.

**Follow-ups:**
- How do you redrive DLQ messages safely after a fix?
- What metrics would page someone at 3 a.m. and which wouldn't?
- How would the design change if the warehouse API had a strict rate limit?

**Red flags:**
- Infinite immediate retries.
- No distinction between transient and permanent failures.
- DLQ with no alerting or ownership.

### Forty teams publish and consume events on a shared platform. How do you manage schema evolution without breaking consumers? {#schema-evolution}

**Level:** Architect

**Model answer:**
- **Schema registry** (Confluent, Apicurio, Azure Schema Registry) with Avro or Protobuf; CI checks compatibility on every producer change.
- **Compatibility policy.** Backward compatibility as the default (new schema reads old data), full for critical shared topics.
- **Evolution rules.** Add optional fields with defaults, never remove required fields or change types, never reuse field numbers or names.
- **Breaking changes** go to a new versioned topic (`orders.v2`) with dual publishing during a migration window and a deprecation date.
- **Ownership and discovery.** Every topic has an owning team, an AsyncAPI document and a catalogue entry listing known consumers.
- **Contract tests.** Consumer-driven contracts for critical flows.

**What the interviewer is looking for:**
Governance that scales socially as well as technically: automation over review boards, clear ownership, and a migration path for breaking changes.

**Follow-ups:**
- JSON Schema vs Avro vs Protobuf: which would you pick and why?
- How do you find out who consumes a topic before changing it?

**Red flags:**
- "We'll just coordinate releases."
- A central architecture team manually approving every schema change.

### What are at-most-once, at-least-once and exactly-once delivery, and which should you design for? {#delivery-semantics}

**Level:** Foundation

**Model answer:**
The difference is *when the consumer acknowledges* relative to doing the work.

- **At-most-once:** acknowledge (or commit the offset) first, then process. A crash mid-processing loses the message. Acceptable only for data where loss is cheap, such as metrics samples or presence pings.
- **At-least-once:** process first, then acknowledge. A crash after the side effect but before the ack causes redelivery, so the same message is processed twice.
- **Exactly-once:** the effect of each message is applied once. Brokers can only provide this inside their own boundary (Kafka transactions for read-process-write between Kafka topics). Anywhere else it is built from at-least-once delivery plus idempotent processing.

Design for **at-least-once with idempotent consumers**. It is the default in Service Bus (peek-lock), SQS and Kafka with manual offset commits, and it fails safe: duplicates are detectable, lost messages are not.

**What the interviewer is looking for:**
The candidate ties each semantic to ack timing, picks at-least-once as the default and immediately mentions idempotency.

**Follow-ups:**
- Where does Kafka's `enable.auto.commit=true` put you on this spectrum?
- Name three ways to make a consumer idempotent.

**Red flags:**
- Believing a broker setting alone gives exactly-once side effects in a database or third-party API.
- Choosing at-most-once for business events "for performance".

### What is consumer lag, and how do you monitor and act on it? {#consumer-lag}

**Level:** Foundation

**Model answer:**
Consumer lag is how far a consumer group is behind the head of the stream. Per partition, it is the latest offset minus the group's committed offset. Summed across partitions it says how much work is queued. Lag converted to **time** ("the oldest unprocessed message is 4 minutes old") is what matters to users, because 100k messages may be 2 seconds or 2 hours of work depending on throughput.

Monitor:
- Lag in messages *and* estimated seconds, per partition, so one stuck partition isn't hidden by healthy ones.
- The trend. Steadily growing lag means consumption is slower than production, and scaling or optimisation is needed.
- The equivalent for queues: active message count and the age of the oldest message.

Act on it by scaling consumers (up to the partition count), fixing slow handlers (batching, removing per-message remote calls), finding hot partitions, or applying backpressure upstream.

**What the interviewer is looking for:**
Lag as offset difference, the time view, per-partition granularity and the partition-count ceiling on scaling.

**Follow-ups:**
- Lag is growing on one partition only. What do you suspect?
- How would you autoscale consumers on lag (for example KEDA)?

**Red flags:**
- Only monitoring broker CPU and memory.
- Thinking adding consumers beyond the partition count increases throughput.

### What is the difference between an event, a command and a query in a message-driven system? {#event-vs-command}

**Level:** Foundation

**Model answer:**
- A **command** asks one specific receiver to do something: `ReserveStock`, `SendInvoice`. It is named in the imperative, has exactly one handler, can be rejected and usually travels on a **queue**. The sender depends on the receiver's capability.
- An **event** states that something has already happened: `OrderPlaced`, `PaymentCaptured`. It is named in the past tense, can have zero or many subscribers and cannot be rejected, because it's a fact. It usually travels on a **topic or log**. The publisher does not know who listens.
- A **query** asks for data and expects a response. It is usually synchronous (HTTP or gRPC). Request-reply over messaging is possible but rarely worth it.

The distinction drives coupling. Events invert the dependency: the producer doesn't change when a new consumer appears. Disguising commands as events (`SendWelcomeEmailEvent`) hides a dependency that is really there.

**What the interviewer is looking for:**
Naming conventions, cardinality of handlers, the transport that fits each, and the coupling argument.

**Follow-ups:**
- Can one business action produce both a command and an event?
- Who owns the schema of a command versus an event?

**Red flags:**
- Using the words interchangeably.
- Broadcasting commands on a pub/sub topic so "whoever needs to" handles them.

### How do Kafka consumer group rebalances work, and how do you stop them hurting throughput? {#consumer-rebalancing}

**Level:** Senior

**Model answer:**
A consumer group divides a topic's partitions among its members. A **rebalance** reassigns them when a member joins, leaves, crashes or is considered dead. A consumer is presumed dead if it misses heartbeats for `session.timeout.ms` or doesn't call `poll()` within `max.poll.interval.ms`.

Why it hurts: with the classic **eager** protocol, every consumer gives up *all* partitions and stops processing until the new assignment is made, even for partitions that didn't move. Deployments, autoscaling and slow handlers can cause repeated "rebalance storms".

Mitigations:
- **Cooperative incremental rebalancing** (`CooperativeStickyAssignor`): only the partitions that move are revoked.
- **Static membership** (`group.instance.id`): a restarting pod rejoins with the same identity within the session timeout and does not trigger a rebalance. This is ideal for rolling deploys on Kubernetes.
- **The next-generation consumer protocol** (KIP-848), where the broker coordinates assignment incrementally. Generally available for consumers from Kafka 4.0.
- **Keep `poll()` loops fast:** bound `max.poll.records` and move slow work off the poll thread (with care for offset commits), or raise `max.poll.interval.ms` deliberately.
- **Commit offsets** in the partitions-revoked callback so the next owner doesn't reprocess a large batch.

**What the interviewer is looking for:**
Understanding of liveness detection (heartbeat vs poll interval), eager vs cooperative protocols, static membership, and the link between slow processing and rebalances.

**Follow-ups:**
- Why might a consumer that is healthy and heartbeating still be kicked out of the group?
- How do rebalances interact with exactly-once (transactional) consumers?

**Red flags:**
- Treating rebalances as rare events that need no design.
- Fixing rebalance loops only by raising every timeout to hours.

### Thin events or fat events? When do you include the full state in the payload? {#thin-vs-fat-events}

**Level:** Senior

**Model answer:**
- **Thin (event notification):** `{ "type": "CustomerUpdated", "customerId": "c-42", "version": 17 }`. Consumers call the owner's API for details. Payloads stay small and never stale, and sensitive data isn't broadcast. The cost is runtime coupling back to the producer (load spikes, availability dependency) and read-your-writes races, where the consumer fetches before the owner's read model has caught up.
- **Fat (event-carried state transfer):** the event carries the state consumers need, often the full entity snapshot after the change. Consumers can build local copies and work when the producer is down. Payloads get larger, schemas couple more tightly and data spreads (GDPR erasure, PII exposure).
- **Delta events** (only the changed fields) are a middle ground but force consumers to have applied every previous delta in order.

Rules of thumb: carry what most consumers need to act without calling back, include an entity **version** so consumers can ignore stale updates, keep sensitive fields out (or on a restricted topic) and use thin events plus fetch for rare, heavy or sensitive details. For compacted Kafka topics that act as a table, fat snapshots keyed by entity id are the natural fit.

**What the interviewer is looking for:**
Trade-offs in coupling, availability, consistency and data governance, with the versioning detail.

**Follow-ups:**
- How do you handle a GDPR erasure request when customer data is in retained events?
- What is log compaction and how does it relate to fat events?

**Red flags:**
- Dogmatism either way.
- Putting the entire aggregate, including secrets, on a company-wide topic.

### When would you choose Azure Service Bus over Event Hubs or Kafka, and the other way round? {#service-bus-vs-event-hubs}

**Level:** Senior

**Model answer:**
They solve different problems.

**Service Bus** is an enterprise message broker. Pick it for commands and workflows that need per-message features:
- Peek-lock with explicit complete/abandon, automatic dead-lettering after `MaxDeliveryCount`.
- Sessions for ordered, exclusive processing per key; scheduled and deferred messages; duplicate detection within a time window.
- Transactions across send and complete within a namespace; topic subscriptions with SQL-like filters.

**Event Hubs or Kafka** are partitioned logs. Pick them for high-volume event streams:
- Telemetry, clickstream and change data capture at millions of events per second.
- Many independent consumer groups, replay from retention, and integration with stream processing (Flink, Stream Analytics, Spark).
- Event Hubs exposes a Kafka endpoint, so Kafka clients work without running brokers.

Signals for Service Bus: low or medium volume, each message is a unit of work, routing per message, need to delay or retry individual messages. Signals for a log: volume, fan-out to many readers, replay, analytics, ordered history per key.

Many systems use both: Service Bus for the order workflow commands, Event Hubs for the analytics firehose.

**What the interviewer is looking for:**
Feature-level reasoning rather than "Kafka is faster", and comfort with using both.

**Follow-ups:**
- How would you implement a 30-minute delayed retry on Event Hubs?
- What limits the throughput of a single Service Bus session?

**Red flags:**
- Choosing Kafka for a 50-messages-a-minute job queue because it is popular.
- Not knowing that Event Hubs lacks per-message acknowledgement and dead-lettering.

### Design the order flow across payment, inventory and shipping services. Choreography or orchestration? {#saga-design}

**Level:** Architect

**Model answer:**
A single database transaction cannot span three services, so the flow is a **saga**: a sequence of local transactions, each with a **compensating action** for when a later step fails (`RefundPayment`, `ReleaseStock`).

**Choreography:** each service reacts to events. `OrderPlaced` → Payment captures and emits `PaymentCaptured` → Inventory reserves and emits `StockReserved` → Shipping books. Failures emit events that trigger compensations upstream.
- Pros: loose coupling, no central component, easy to add listeners.
- Cons: the business process exists only implicitly across services. It is hard to answer "where is order 123 stuck?" and cyclic dependencies creep in.

**Orchestration:** an order orchestrator (a state machine, or a workflow engine such as Temporal, Azure Durable Functions or AWS Step Functions) sends commands and waits for replies, persisting state at each step.
- Pros: the process is explicit, versioned and observable, timeouts and compensations live in one place.
- Cons: the orchestrator is a component to run, and it can grow into a god service if it absorbs domain logic.

My default: **orchestrate the core money-moving flow**, because it needs visibility, timeouts and auditable compensation, and **choreograph the side effects** (emails, analytics, loyalty points) off domain events.

Design details either way:
- Idempotent steps and idempotency keys on payment calls.
- Pivot step ordering: do the hardest-to-compensate step, such as shipping, last.
- Semantic locks or a `PENDING` status so other processes don't act on half-finished orders.
- Timeouts that trigger compensation.
- A per-saga correlation id for tracing.

**What the interviewer is looking for:**
Saga mechanics, compensation (not rollback), an explicit trade-off between the two styles, failure and timeout handling and observability. Architect answers justify the hybrid.

**Follow-ups:**
- Payment succeeded, inventory failed and the refund call is timing out. What happens?
- How do you version a long-running workflow while instances are in flight?
- How do you handle the user cancelling mid-saga?

**Red flags:**
- Proposing two-phase commit across services and the payment provider.
- No compensation design, or assuming compensation is an exact undo.
- Choreography with no way to see the end-to-end state.

### Your organisation wants to replace synchronous REST calls between 12 microservices with events. How do you evaluate and run that change? {#migrate-sync-to-async}

**Level:** Architect

**Model answer:**
Start from the problem, not the pattern. Which pain is real? Cascading failures, latency chains (p99 compounding through 5 hops), tight release coupling, or scaling bottlenecks? Then classify each interaction:

- **Queries that need an answer now** (price lookup, auth checks) stay synchronous, or become local read models fed by events if availability matters more than freshness.
- **Notifications of facts** ("order shipped, update loyalty") become events. This is the biggest win.
- **Commands for long-running work** become queued commands, with the result reported asynchronously.

The cost of going asynchronous has to be accepted explicitly:
- **Eventual consistency in the UI:** design pending states and "we'll email you" flows.
- **Debugging:** you need distributed tracing with context propagated through message headers, and correlation ids.
- **New failure modes:** duplicates, reordering, poison messages, DLQs.
- **Platform and skills:** schema governance, a broker platform and team skills.

Execution:
1. Pick one high-value seam and prove the paved road: outbox library, schema registry, tracing, DLQ dashboards.
2. Run the event path and the REST path side by side (strangler pattern), compare the results, then cut over.
3. Measure before and after: availability, p99, incident count, lead time.
4. Write an ADR with the guidelines, so teams don't apply events everywhere.

**What the interviewer is looking for:**
Problem-first reasoning, keeping sync where it fits, a candid account of costs, and incremental migration with measurement. This is a judgement question, not a Kafka question.

**Follow-ups:**
- The product owner insists the confirmation page shows the final shipping date. How do you design it?
- How do you prevent the event mesh becoming an untraceable "distributed monolith"?

**Red flags:**
- "Events everywhere" as an end in itself.
- Ignoring the user-experience impact of eventual consistency.
- A big-bang migration.

### Design event streaming across two regions for disaster recovery. What happens to ordering and offsets on failover? {#multi-region-streaming}

**Level:** Architect

**Model answer:**
First agree the targets. Can the business accept losing the last few seconds of events (the **RPO**, recovery point objective)? How fast must processing resume (the **RTO**, recovery time objective)? Is active-active really needed? Then choose a topology:

- **Active-passive with asynchronous replication.** Mirror topics to the DR cluster with MirrorMaker 2 or Confluent Cluster Linking (on Azure, Event Hubs geo-replication, generally available since 2025 for Premium and Dedicated, replicates data and consumer offsets; the older geo-disaster recovery pairing replicates metadata only). The RPO is the replication lag. On failover, producers and consumers switch bootstrap servers.
- **Active-active.** Each region produces to local topics (`eu.orders`, `us.orders`) and mirrors the other's. Consumers read both. There is no single global order, so per-entity ordering needs **home-region ownership** of each entity, or conflict handling with versions.
- **Stretched cluster** across nearby availability zones or metro regions with synchronous replication (`acks=all`, `min.insync.replicas`). It gives a zero RPO but needs low latency between sites, so it doesn't work across continents.

Offsets and ordering on failover:
- Offsets are *not* the same number across clusters. Use the replication tool's **offset translation** (MirrorMaker 2 checkpoints, or cluster linking that preserves offsets), or restart from a timestamp.
- Expect duplicates (rewind slightly) or gaps (unreplicated tail). Idempotent consumers make "rewind a bit" the safe choice.
- Events produced in the old region but not yet replicated are lost or must be reconciled when it returns. Decide the procedure in advance and rehearse it.

Operations: replication lag alerts, regular game days, runbooks and an explicit failback plan.

**What the interviewer is looking for:**
RPO and RTO first, topology trade-offs, offset translation, accepting duplicates over loss and practising failover.

**Follow-ups:**
- How would you guarantee no double-charging after failover?
- What is the effect of `acks=1` versus `acks=all` on data loss during a broker failure?

**Red flags:**
- Assuming offsets carry over unchanged.
- Active-active with global ordering assumptions.
- A DR design that has never been tested.

## Cheat Sheet

- **Queue** — competing consumers, message deleted on ack; for commands and jobs.
- **Log/stream** — retained, replayable, per-consumer-group offsets; for facts and fan-out at scale.
- **At-least-once** — the realistic default; duplicates will happen, so make consumers idempotent.
- **Kafka exactly-once** — idempotent producer + transactions; holds only inside Kafka.
- **Ordering** — per partition key / Service Bus session, never global.
- **Outbox** — write the event to a table in the same DB transaction; a relay or CDC publishes it.
- **Poison message** — permanently failing message; classify errors, dead-letter, alert.
- **Retry topics** — delayed retry tiers so failures don't block the main partition.
- **Consumer lag** — the key streaming health metric; alert on growth and age.
- **Schema compatibility** — add optional fields; breaking changes get a new topic version.
- **KRaft** — Kafka's built-in metadata quorum; ZooKeeper was removed in Kafka 4.0.
- **Command vs event** — command: imperative, one handler, can be rejected; event: past tense, many subscribers, a fact.
- **Static membership** — `group.instance.id` lets a restarting consumer rejoin without triggering a rebalance.
- **Cooperative rebalancing** — only partitions that move are revoked, so the group keeps processing.
- **Saga** — sequence of local transactions with compensating actions; orchestrate money flows, choreograph side effects.

## Further Reading

- [Apache Kafka documentation](https://kafka.apache.org/documentation/) — design, delivery semantics and configuration.
- [Azure Service Bus messaging overview](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-messaging-overview) — queues, topics, sessions and dead-lettering.
- [Azure Event Hubs for Apache Kafka](https://learn.microsoft.com/en-us/azure/event-hubs/azure-event-hubs-apache-kafka-overview) — using the Kafka protocol on Azure.
- [AsyncAPI specification](https://www.asyncapi.com/docs) — documenting event-driven APIs.
- [Transactional outbox pattern (Azure Architecture Center)](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos) — a worked outbox example on Azure.
