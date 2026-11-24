---
id: data-modelling
title: "Data Modelling"
group: data
tags: [databases, modelling]
level: Senior
estimatedMinutes: 60
related: [databases-sql-nosql, domain-driven-design]
lastReviewed: 2026-11-24
status: complete
---

## TL;DR

- Data models outlive code. Model the **domain** first (entities, relationships, invariants, lifecycle), then map to storage for your **access patterns**.
- Work at three levels: **conceptual** (business concepts), **logical** (entities, attributes, keys, relationships), **physical** (tables, types, indexes, partitions).
- Use constraints to protect invariants: primary/foreign keys, unique constraints, check constraints, NOT NULL. Normalise transactional data; denormalise deliberately for reads.
- Get the hard parts right early: **identifiers**, **money**, **time and time zones**, **history/temporal data**, **soft deletes**, **multi-tenancy**, and **personal data** (retention, erasure).
- Analytical models differ: **dimensional modelling** (facts and dimensions, star schemas) optimises for queries over history; event-sourced and NoSQL models optimise for specific access patterns.

## Core Concepts

### Levels of modelling

| Level | Audience | Contents |
|---|---|---|
| Conceptual | Business and engineering | Key concepts and relationships: Customer places Order; Order contains Product |
| Logical | Engineers, analysts | Entities, attributes, keys, cardinality, normalisation; technology-agnostic |
| Physical | Engineers, DBAs | Tables/collections, data types, indexes, partitioning, constraints for a specific engine |

### Entity-relationship modelling

- **Entities** with identity (Customer, Order), **attributes** (email, placed_at), **relationships** with **cardinality**: one-to-one, one-to-many, many-to-many (via a junction table, which often deserves its own name and attributes — `Enrolment` between Student and Course with a grade).
- **Optionality:** must an Order have a Customer? Can a Product exist without a Category?
- **Weak entities:** OrderLine depends on Order for identity.

### Keys

- **Surrogate keys** (UUID/ULID/bigint identity) — stable, meaningless, never change; default for most tables.
- **Natural keys** (email, ISBN, country code) — meaningful but can change or be reused; enforce with **unique constraints** in addition to the surrogate key.
- **UUIDv7/ULID** give time-ordered IDs (better index locality than random UUIDv4) and can be generated anywhere.
- Public identifiers: consider prefixed, opaque IDs (`ord_01J…`) for APIs; never expose sequential IDs that leak volumes or allow enumeration without authorisation checks.

### Normal forms (briefly)

- **1NF:** atomic values, no repeating groups.
- **2NF:** no partial dependency on part of a composite key.
- **3NF:** no transitive dependencies ("every non-key attribute depends on the key, the whole key, and nothing but the key").
- **BCNF** tightens 3NF. Most OLTP schemas aim for 3NF and denormalise selectively.

### Modelling money, time and identity details

```sql
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  customer_id   uuid NOT NULL REFERENCES customers(id),
  status        text NOT NULL CHECK (status IN ('draft','placed','paid','shipped','cancelled')),
  currency      char(3) NOT NULL,                 -- ISO 4217
  total_minor   bigint NOT NULL CHECK (total_minor >= 0), -- money as integer minor units
  placed_at     timestamptz,                      -- an instant, stored in UTC
  delivery_date date,                             -- a calendar date, no time zone
  shipping_addr jsonb NOT NULL,                   -- snapshot at time of order, not a live reference
  version       integer NOT NULL DEFAULT 1,       -- optimistic concurrency
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_tenant_customer_placed ON orders (tenant_id, customer_id, placed_at DESC);
```

- **Money:** integer minor units (or exact `numeric`) plus currency; never floating point. Store FX rates and rounding rules explicitly.
- **Time:** instants as UTC timestamps (`timestamptz`); local calendar concepts (birthdays, delivery dates, store opening hours) as dates/local times plus an IANA time zone where needed; never store local times without the zone for events.
- **Snapshots:** copy data that must not change with the source (address and prices on an order).
- **Enums:** check constraints or reference tables; plan how values evolve.

### History and temporal data

- **Audit tables / change data capture:** who changed what and when.
- **Slowly changing dimensions (SCD)** in analytics: Type 1 overwrite, Type 2 new row with `valid_from`/`valid_to` and a current flag.
- **Bitemporal modelling:** *valid time* (when it was true in the real world) and *transaction time* (when we recorded it) — essential in insurance, finance and compliance ("what did we believe on 1 March about the policy as of 1 January?").
- **Event sourcing:** store the sequence of events as the source of truth and derive current state.

### Soft deletes and lifecycle

Soft deletes (`deleted_at`) keep history and enable undo, but complicate every query, unique constraints (use partial unique indexes) and privacy erasure. Alternatives: move to an archive table, use status-based lifecycles (`cancelled`, `archived`), or event history. Define retention per data class.

### Multi-tenancy models

| Model | Isolation | Ops cost | Typical use |
|---|---|---|---|
| Shared tables with `tenant_id` | Logical (enforce in queries + row-level security) | Lowest | Most SaaS, many small tenants |
| Schema per tenant | Medium | Migrations across many schemas | Moderate tenant counts, some customisation |
| Database per tenant | Strong | Highest | Large/regulated tenants, noisy-neighbour isolation |
| Hybrid | Pooled for small, dedicated for large | Medium | Tiered SaaS |

## How It Works

```mermaid
flowchart LR
  A["Domain discovery: language, entities, invariants, lifecycle"] --> B["Conceptual model"]
  B --> C["Access patterns and volumes: reads, writes, queries, retention"]
  C --> D["Logical model: keys, relationships, normalisation"]
  D --> E["Physical model: types, constraints, indexes, partitioning"]
  E --> F["Migrations in code, reviewed"]
  F --> G["Operate: monitor queries, evolve with expand-contract"]
  G -->|"new requirements"| C
```

## When to Use / Trade-offs

| Approach | Use when | Avoid when | Trade-off |
|---|---|---|---|
| Normalised relational (3NF) | Transactional systems with invariants and varied queries | Pure append-only analytics at huge scale | Integrity and flexibility vs joins |
| Denormalised read models | Read-heavy screens, search, dashboards | As the system of record without sync strategy | Fast reads vs duplication and sync |
| JSON/JSONB columns | Variable attributes, snapshots, rarely queried details | Data with relationships, constraints or heavy filtering | Flexibility vs weaker integrity |
| Dimensional (star schema) | Analytics, BI, history over time | OLTP | Query simplicity and speed vs ETL effort |
| Event sourcing | Audit-critical domains, temporal queries, complex workflows | Simple CRUD | Full history vs complexity, projections |
| Access-pattern NoSQL models | Known queries at very high scale | Ad-hoc querying needs | Performance vs flexibility |

## Common Pitfalls & Anti-patterns

- **Floating-point money** — rounding errors in financial data.
- **Local timestamps without time zones** — ambiguous events, DST bugs.
- **Missing constraints** — "the application validates it" until a second writer arrives.
- **Generic EAV tables** (entity-attribute-value) for everything — unqueryable, no integrity.
- **God tables** — `customers` with 150 columns serving five departments.
- **Natural keys as primary keys** that later change (emails, codes).
- **Referencing live data where a snapshot is needed** — order totals changing when product prices change.
- **Soft deletes everywhere** — broken unique constraints, leaked "deleted" data, GDPR non-compliance.
- **Cross-service database sharing** — schema changes break other teams.
- **No plan for history** — "we need to know what the value was last March" with no data.

## Real-world Scenario

**Context:** An insurance platform stored policies in a single `policies` table updated in place. Regulators asked for the policy terms *as known on a specific date* for a set of claims, and finance needed premium recalculations for back-dated endorsements. The team couldn't answer either reliably.

**Decision:** Introduced a **bitemporal model** for policy versions: each change creates a new row with `valid_from/valid_to` (business-effective period) and `recorded_from/recorded_to` (when the system knew it). Endorsements became explicit domain events (`PolicyEndorsed`) feeding the model. Money moved from `decimal(10,2)` mixed currencies to minor units with currency codes; all instants moved to `timestamptz`. Reporting moved to a dimensional model in the warehouse with SCD Type 2 policy dimensions.

**Outcome:** Regulatory queries ("as of" and "as known on") became single SQL queries; back-dated recalculations were reproducible; audit findings closed. Query complexity increased for developers, mitigated by views and a small library.

**What I'd do differently:** Identify temporal requirements in initial domain discovery — retrofitting history onto years of in-place updates required painful reconstruction from logs.

## Interview Questions

### What are conceptual, logical and physical data models? {#model-levels}

**Level:** Foundation

**Model answer:**
- **Conceptual:** the main business concepts and how they relate, in business language — Customer places Order, Order contains Products. Used to align with domain experts; no technical detail.
- **Logical:** entities with attributes, keys, relationships and cardinality, normalised, independent of a specific database — e.g. Order(id, customer_id, status, total, currency), OrderLine(order_id, line_no, product_id, quantity, unit_price).
- **Physical:** the implementation in a specific engine — table and column names, data types, constraints, indexes, partitioning, storage parameters.

Moving through the levels separates "what the business means" from "how we store it", making it easier to validate the model with experts and to change technology later.

**What the interviewer is looking for:**
Clear distinctions, audiences and examples.

**Follow-ups:**
- Which level would you show a product owner?
- How does DDD's domain model relate to these?

**Red flags:**
- Jumping straight to tables without understanding the domain.

### How do you model relationships and cardinality in an ER model? {#er-modelling}

**Level:** Foundation

**Model answer:**
- **One-to-many:** foreign key on the "many" side — `order_lines.order_id → orders.id`.
- **One-to-one:** foreign key with a unique constraint, or the same primary key in both tables; often a sign the entities could be merged unless lifecycles or access differ.
- **Many-to-many:** a junction table with foreign keys to both sides and a composite unique constraint — `enrolments(student_id, course_id)`. Junction tables often become real entities with attributes (grade, enrolled_at) and deserve a domain name.
- **Optionality:** nullable vs NOT NULL foreign keys express whether the relationship is required.
- **Referential actions:** `ON DELETE RESTRICT/CASCADE/SET NULL` chosen deliberately — cascades can delete more than intended.

Draw ER diagrams (crow's foot notation) to validate cardinality with domain experts using concrete examples ("Can an order have zero lines? Can a product belong to two categories?").

**What the interviewer is looking for:**
Correct implementation of each cardinality, junction tables as entities, optionality and referential actions.

**Follow-ups:**
- When would you avoid foreign keys?
- How do you model a self-referencing relationship (manager/employee)?

**Red flags:**
- Comma-separated ids in a column for many-to-many.

### Natural or surrogate keys? {#keys}

**Level:** Foundation

**Model answer:**
- **Surrogate keys** (generated identifiers: bigint identity, UUID/ULID) are meaningless, stable and never change — the usual choice for primary keys. Time-ordered variants (UUIDv7, ULID) improve index locality compared with random UUIDv4 and can be generated client-side or in distributed systems.
- **Natural keys** (email, VAT number, ISO country code) carry business meaning but can change (emails), be reused, or have formatting issues. Enforce them with **unique constraints** rather than making them primary keys — except for stable, standardised codes (ISO currency codes) in reference tables.
- **Composite keys** fit junction tables and some partitioned designs.

For external APIs, expose opaque identifiers (optionally prefixed by type, like `cus_…`); never rely on obscurity — always authorise access.

**What the interviewer is looking for:**
Stability argument, unique constraints for natural keys, UUID ordering considerations and API exposure.

**Follow-ups:**
- What's the downside of random UUIDs as clustered primary keys?
- Why might sequential IDs in URLs be a problem?

**Red flags:**
- Email as primary key with foreign keys pointing to it.

### What is normalisation, and what problems does it prevent? {#normal-forms}

**Level:** Foundation

**Model answer:**
Normalisation organises data so each fact is stored once, preventing **update anomalies** (changing a customer's address in many rows), **insertion anomalies** (can't record a product until it's ordered) and **deletion anomalies** (deleting the last order removes the customer's details).

- **1NF:** atomic values; no repeating groups or lists in a column.
- **2NF:** in tables with composite keys, non-key attributes depend on the whole key.
- **3NF:** non-key attributes depend only on the key, not on other non-key attributes (no transitive dependencies — e.g. `city → country` stored on orders).
- **BCNF:** every determinant is a candidate key.

OLTP systems usually target 3NF, then **denormalise deliberately** for performance (read models, materialised views, cached totals) or for correctness (snapshots of prices and addresses at order time).

**What the interviewer is looking for:**
Anomalies prevented, normal forms in plain terms, and deliberate denormalisation.

**Follow-ups:**
- Give an example of a transitive dependency.
- When is duplication required for correctness?

**Red flags:**
- Unable to explain why normalisation matters.

### How do you model hierarchies and graphs in a relational database? {#hierarchies}

**Level:** Senior

**Model answer:**
Options for trees (categories, org charts, comment threads):
- **Adjacency list:** `parent_id` foreign key. Simple writes; recursive queries (`WITH RECURSIVE`) for subtrees — fine for moderate depth and size.
- **Materialised path:** store the path (`/1/4/9/`) or use Postgres `ltree`; fast subtree queries via prefix/index; moves require updating descendants.
- **Nested sets:** left/right numbers; fast reads, expensive writes — rarely worth it now.
- **Closure table:** a table of all ancestor–descendant pairs with depth; fast queries for any ancestor/descendant, more storage and write complexity.

For general graphs (many-to-many with traversal, like social networks or fraud rings), use edge tables with recursive queries at small scale, or a graph database when traversals are deep and central to the product.

Choose by read/write ratio, depth, frequency of moves, and query types.

**What the interviewer is looking for:**
Multiple techniques with trade-offs and when to switch to a graph database.

**Follow-ups:**
- How would you prevent cycles in an adjacency list?
- How do you find all descendants efficiently in Postgres?

**Red flags:**
- Only knowing parent_id without considering query needs.

### How do you model data that changes over time? {#temporal-data}

**Level:** Senior

**Model answer:**
First, decide what questions you must answer:
- "What is the value now?" → simple current-state tables.
- "Who changed what, when?" → **audit log** (application-level or CDC to an audit store).
- "What was the value on date X?" → **valid-time history**: version rows with `valid_from`/`valid_to` (e.g. prices, employee departments). In analytics, **SCD Type 2** dimensions.
- "What did we *know* on date Y about date X?" → **bitemporal** model: valid time plus transaction (recorded) time — needed for back-dated corrections in insurance, finance, payroll and regulatory reporting.
- "How did we get here, step by step?" → **event sourcing**: events as the source of truth, state derived by projection.

Implementation details: non-overlapping periods enforced with exclusion constraints (Postgres `EXCLUDE USING gist` with ranges) or application logic; views for "current" rows; indexes on period columns; SQL:2011 temporal features where supported (SQL Server/MariaDB system-versioned tables).

**What the interviewer is looking for:**
Mapping questions to techniques, bitemporal understanding and implementation details.

**Follow-ups:**
- How do you correct a past value that was wrong?
- What's the difference between valid time and transaction time?

**Red flags:**
- In-place updates for regulated data with no history.

### What are the trade-offs of soft deletes? {#soft-deletes}

**Level:** Senior

**Model answer:**
**Soft delete** sets a flag or `deleted_at` instead of removing the row.

Benefits: undo/restore, audit trails, preserving references from other records, simpler recovery from mistakes.

Costs:
- **Every query must filter** deleted rows — easy to forget, leaking "deleted" data (use views, ORM default scopes, or row-level security).
- **Unique constraints break** — a deleted user's email blocks re-registration; use partial unique indexes (`WHERE deleted_at IS NULL`).
- **Privacy and retention:** GDPR erasure and retention policies require actual deletion or anonymisation; soft-deleted personal data is still personal data.
- **Table bloat** and slower queries over time.

Alternatives: explicit lifecycle states (`cancelled`, `archived`) where they're domain concepts; moving records to archive tables; event history or audit logs for recovery; hard delete plus backups for mistakes. Choose per entity, with explicit retention rules.

**What the interviewer is looking for:**
Balanced trade-offs, unique index technique, privacy implications and alternatives.

**Follow-ups:**
- How do you implement GDPR erasure with soft deletes?
- When is a lifecycle status better than soft delete?

**Red flags:**
- Soft delete on everything by default with no retention plan.

### How should money and time be modelled? {#money-and-time}

**Level:** Senior

**Model answer:**
**Money:**
- Store as **integer minor units** (pence/cents) or exact decimals (`numeric`), plus an **ISO 4217 currency code**; never floats.
- Be aware of currencies with zero or three decimal places.
- Store FX rates with their timestamp and source when converting; define rounding rules (banker's rounding vs half-up) explicitly, and where rounding happens (per line vs total).
- Snapshot prices and taxes on transactions.

**Time:**
- **Instants** (when something happened) as UTC timestamps (`timestamptz` in Postgres).
- **Civil/local times** (a meeting at 09:00 in London next March, store opening hours, birthdays) as local date/time plus an **IANA time zone** (`Europe/London`), because offsets change with DST and law.
- **Dates without time** (delivery date, date of birth) as `date`.
- **Durations** separately from instants.
- Convert to local time only at presentation.

**What the interviewer is looking for:**
Integer/decimal money with currency, rounding and FX; instants vs civil times with IANA zones.

**Follow-ups:**
- How would you store a recurring meeting at 9am London time?
- Why not store everything as local time?

**Red flags:**
- `float` for money.
- Timestamps without time zone information for events.

### When would you use JSON columns instead of relational columns? {#json-columns}

**Level:** Senior

**Model answer:**
JSON/JSONB columns are good for:
- **Variable or sparse attributes** that differ by type (product specifications across categories).
- **Snapshots** of data at a point in time (shipping address, pricing breakdown on an order).
- **External payloads** stored for audit or reprocessing (webhook bodies).
- **Rarely queried details** displayed as a whole.

Prefer relational columns when:
- Data has **relationships** (foreign keys), **constraints** (NOT NULL, unique, check), or participates in joins.
- You **filter, sort or aggregate** on it frequently (JSON indexes exist — GIN, expression indexes — but are more limited and harder to maintain).
- Multiple services/reports depend on a stable schema.

Middle ground: promote frequently queried JSON fields to generated columns or real columns; validate JSON with schema checks (check constraints or application validation).

**What the interviewer is looking for:**
Appropriate uses, limitations, indexing options and hybrid approaches.

**Follow-ups:**
- How would you index a JSONB attribute used in filters?
- How do you evolve the structure of JSON data over time?

**Red flags:**
- Storing everything as one JSON blob per entity "for flexibility".

### How do you model data for a multi-tenant SaaS application? {#multi-tenant-schema}

**Level:** Senior

**Model answer:**
Choose the isolation model by tenant count, size variance, compliance and customisation:
- **Shared schema with `tenant_id`** on every tenant-owned table: cheapest and simplest to operate; enforce isolation with tenant-scoped data access (automatic filters), **row-level security** as defence in depth, composite indexes leading with `tenant_id`, and tests for cross-tenant access.
- **Schema per tenant:** stronger separation, per-tenant customisation; migrations across thousands of schemas are slow and error-prone.
- **Database per tenant:** strongest isolation, per-tenant backup/restore and residency; highest operational cost; good for large or regulated tenants.
- **Hybrid:** pooled for most tenants, dedicated for enterprise tiers — design the data access layer so a tenant can move between pools.

Other considerations: tenant id in every unique constraint (`UNIQUE (tenant_id, email)`), noisy-neighbour controls, per-tenant data export and deletion, sharding by tenant when scaling.

**What the interviewer is looking for:**
Options with trade-offs, enforcement mechanisms, constraint design and mobility between tiers.

**Follow-ups:**
- How do you move a large tenant to its own database without downtime?
- How do you run analytics across tenants?

**Red flags:**
- Relying only on developers remembering `WHERE tenant_id = ?`.

### Explain dimensional modelling and the star schema. {#dimensional-modelling}

**Level:** Architect

**Model answer:**
Dimensional modelling (Kimball) structures analytical data around business processes:
- **Fact tables:** measurements of events at a declared **grain** (one row per order line, per payment, per daily account balance) — numeric measures (amount, quantity) plus foreign keys to dimensions. Types: transaction, periodic snapshot, accumulating snapshot.
- **Dimension tables:** descriptive context — customer, product, date, store, channel — with attributes for filtering and grouping.
- **Star schema:** a fact table surrounded by denormalised dimensions; simple joins, fast aggregation, intuitive for analysts. **Snowflake** schemas normalise dimensions further (less common now with cheap storage).
- **Slowly changing dimensions:** Type 1 (overwrite), Type 2 (new row with validity dates, preserving history), others for special cases.
- **Conformed dimensions** shared across fact tables enable cross-process analysis.

Process: choose the business process → declare the grain → identify dimensions → identify facts. Modern warehouses (BigQuery, Snowflake, Fabric, Databricks) still benefit from dimensional models, often built with dbt from raw/staging layers.

**What the interviewer is looking for:**
Facts, dimensions, grain, star vs snowflake, SCDs, conformed dimensions and the design process.

**Follow-ups:**
- What happens if you mix grains in one fact table?
- When is a wide denormalised table preferable to a star schema?

**Red flags:**
- Running analytics directly on normalised OLTP schemas at scale.

### How does the data model change with event sourcing? {#event-sourcing-model}

**Level:** Architect

**Model answer:**
With event sourcing, the **source of truth is an append-only stream of domain events** per aggregate (`OrderPlaced`, `ItemAdded`, `OrderShipped`); current state is derived by replaying events.

Model elements:
- **Event store:** streams keyed by aggregate id with sequence numbers (optimistic concurrency on expected version), event type, payload, metadata (causation/correlation ids, timestamp, actor).
- **Events as contracts:** versioned schemas; upcasting old events to new shapes when reading.
- **Snapshots** to avoid replaying long streams.
- **Projections/read models:** denormalised tables built from events for queries (CQRS); rebuildable by replaying.
- **Process managers/sagas** reacting to events.

Benefits: complete audit history, temporal queries, ability to build new read models from history, natural integration via events. Costs: complexity (projections, eventual consistency between write and read sides), event schema evolution, GDPR erasure (crypto-shredding — encrypting personal data per subject and deleting keys), and harder ad-hoc querying.

**What the interviewer is looking for:**
Event store structure, concurrency, versioning, snapshots, projections and the costs including privacy.

**Follow-ups:**
- How do you handle a bug that wrote incorrect events?
- What's crypto-shredding?

**Red flags:**
- Event sourcing for simple CRUD.
- Treating events as mutable records.

### How do you manage schema evolution across services and data consumers? {#schema-evolution-strategy}

**Level:** Architect

**Model answer:**
- **Ownership:** each schema (database, API, event) has a single owning team; others consume through contracts, not by reading internal tables.
- **Compatibility rules:** additive changes by default (new optional fields/columns); no renames or type changes in place; breaking changes via **expand–migrate–contract** or new versions (new topic/API version).
- **Contracts and registries:** schema registry for events with compatibility modes; OpenAPI for APIs; data contracts for analytical datasets (schema, semantics, SLAs, owners).
- **Automated checks:** CI detects breaking changes (schema diffs, compatibility checks, dbt tests); consumers' contract tests.
- **CDC and analytics:** changes in source tables affect pipelines — publish data products with stable interfaces rather than exposing raw tables to the warehouse.
- **Communication:** deprecation notices, timelines, consumer inventories (lineage tools show who reads what).

**What the interviewer is looking for:**
Ownership, additive evolution, contracts/registries, automated detection, data products and lineage.

**Follow-ups:**
- A team wants to rename a column used by 12 dashboards. What's the process?
- What's a data contract?

**Red flags:**
- Consumers reading other services' tables directly.

### How do you handle data ownership and consistency in a microservices architecture? {#data-ownership}

**Level:** Architect

**Model answer:**
- **Database per service** (or schema per service with strict access control): each service owns its data and exposes it via APIs/events — no shared tables.
- **Data duplication is expected:** services keep local copies of data they need (e.g. Shipping stores the delivery address), updated via events (event-carried state transfer). Define which service is the **system of record** for each piece of data.
- **Consistency:** strong consistency within a service's transaction; **eventual consistency** across services with outbox-based events, idempotent consumers and sagas for multi-step processes.
- **Queries across services:** API composition for simple cases; dedicated read models or a reporting data store fed by events/CDC for complex queries and analytics.
- **Reference data:** owned by one service and published; cached elsewhere.
- **Governance:** data catalogue documenting ownership, classification (PII), retention and lineage.

**What the interviewer is looking for:**
Ownership boundaries, system of record, event-fed copies, consistency patterns, cross-service queries and governance.

**Follow-ups:**
- How do you handle a GDPR deletion request across 10 services?
- When is a shared database acceptable?

**Red flags:**
- Shared database across services "for simplicity" at scale.

### How do you design a data model that supports privacy requirements like GDPR? {#privacy-by-design-model}

**Level:** Architect

**Model answer:**
- **Data minimisation:** collect only what's needed; question every personal field.
- **Classification:** tag columns/fields by sensitivity (PII, special category, payment data) in a data catalogue; drive access control, masking and retention from it.
- **Separation:** keep personal data in a limited number of well-protected stores/tables, referenced by pseudonymous ids elsewhere — makes erasure and access control easier.
- **Retention:** explicit retention periods per data class, implemented with automated deletion/anonymisation jobs; legal holds when required.
- **Erasure and access requests:** know every location of a subject's data (lineage), including derived stores, analytics, logs and backups; implement deletion or anonymisation workflows; for immutable stores (event logs, backups), use **crypto-shredding** (encrypt per subject, delete the key) or documented backup expiry.
- **Pseudonymisation/anonymisation** for analytics and non-production environments; never copy production PII to dev/test unmasked.
- **Residency:** model region attributes and route storage accordingly.
- **Audit:** log access to sensitive data.

**What the interviewer is looking for:**
Minimisation, classification, separation, retention automation, erasure across stores (incl. crypto-shredding), masking and residency.

**Follow-ups:**
- How do you delete someone's data from an append-only event log?
- How do you test with realistic data without using PII?

**Red flags:**
- Production data copied to test environments.
- No inventory of where personal data lives.

## Cheat Sheet

### Foundations
- **Conceptual → logical → physical** — business concepts, then entities and keys, then engine-specific tables.
- **Many-to-many** — junction table, often a real entity with its own attributes.
- **Surrogate PK + unique natural key** — stable identity plus enforced business uniqueness.
- **UUIDv7 / ULID** — time-ordered IDs with better index locality than UUIDv4.
- **3NF** — every non-key attribute depends on the key, the whole key, and nothing but the key.

### Tricky details
- **Money** — integer minor units or exact decimals plus ISO 4217 currency; never floats.
- **Time** — instants in UTC; civil times as local time plus IANA zone; dates as `date`.
- **Snapshots** — copy prices and addresses onto transactions.
- **Soft deletes** — need filters, partial unique indexes and real erasure for privacy.
- **Bitemporal** — valid time (true in reality) plus transaction time (when recorded).
- **Hierarchies** — adjacency list, materialised path/ltree, closure table; choose by query pattern.

### Architecture
- **Multi-tenancy** — shared tables + RLS, schema per tenant, DB per tenant, or hybrid.
- **Star schema** — facts at a declared grain plus denormalised dimensions; SCD Type 2 for history.
- **Event sourcing** — append-only events as truth; projections for reads; crypto-shredding for erasure.
- **Data ownership** — one system of record per datum; others hold event-fed copies.
- **Data contracts** — owned, versioned schemas with semantics and SLAs for consumers.

## Further Reading

- [PostgreSQL documentation: Data Definition](https://www.postgresql.org/docs/current/ddl.html) — constraints, schemas, partitioning and row-level security.
- [PostgreSQL: Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) — timestamp with/without time zone semantics.
- [Kimball Group: Dimensional Modeling Techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) — the canonical reference for star schemas and SCDs.
- [Martin Fowler: Bitemporal History](https://martinfowler.com/articles/bitemporal-history.html) — an accessible explanation of bitemporal modelling.
- [Microsoft: Multitenant SaaS database tenancy patterns](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns) — tenancy models and trade-offs.
- [Designing Data-Intensive Applications](https://dataintensive.net/) — data models, storage and schema evolution in depth.
