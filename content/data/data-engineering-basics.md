---
id: data-engineering-basics
title: "Data Engineering Basics"
group: data
tags: [etl, pipelines, analytics]
level: Senior
estimatedMinutes: 60
related: [databases-sql-nosql, messaging-event-streaming]
lastReviewed: 2026-11-24
status: complete
---

## TL;DR

- Data engineering moves data from operational systems to where it creates value — analytics, reporting, ML, data products — **reliably, correctly and on time**.
- Operational (OLTP) databases are optimised for transactions; analytical (OLAP) stores — warehouses, lakehouses — are optimised for scanning and aggregating large volumes with columnar storage.
- Modern stacks favour **ELT**: land raw data, then transform inside the warehouse/lakehouse with versioned SQL (e.g. dbt), in layers (raw → cleaned → business-ready).
- Pipelines must be **idempotent, observable and tested**: re-runnable without duplicates, with data quality checks, lineage and freshness SLAs.
- At scale, treat data as a **product** with owners and **contracts** — schema changes in source systems are the most common cause of broken pipelines.

## Core Concepts

### OLTP vs OLAP

| | OLTP (operational) | OLAP (analytical) |
|---|---|---|
| Workload | Many small reads/writes, transactions | Large scans and aggregations |
| Storage | Row-oriented | Column-oriented, compressed |
| Schema | Normalised | Dimensional / wide tables |
| Examples | PostgreSQL, SQL Server, DynamoDB | BigQuery, Snowflake, Redshift, Databricks, Microsoft Fabric, ClickHouse |
| Users | Applications | Analysts, data scientists, BI tools |

Running heavy analytics on production OLTP databases hurts application performance and complicates schema evolution — replicate data to an analytical store.

### Ingestion

- **Batch extracts:** scheduled queries/exports (full or incremental by `updated_at` watermark).
- **Change data capture (CDC):** stream row-level changes from the database log (Debezium, cloud DMS, native change feeds) — captures deletes and preserves order, minimal source load.
- **Event streams:** application events via Kafka/Event Hubs/Kinesis.
- **SaaS connectors:** managed ELT tools (Fivetran, Airbyte, cloud data factories) for CRM, ads, payments.
- **Files:** CSV/JSON drops to object storage.

### Storage: warehouse, lake, lakehouse

- **Data warehouse:** managed analytical database with SQL, strong governance and performance; structured data.
- **Data lake:** cheap object storage holding raw files in any format; flexible but historically weak on transactions and governance ("data swamp" risk).
- **Lakehouse:** open table formats (**Apache Iceberg, Delta Lake, Apache Hudi**) on object storage add ACID transactions, schema evolution, time travel and efficient queries — warehouse-like capabilities on lake storage, readable by multiple engines.
- **File formats:** **Parquet** (columnar, compressed, the default for analytics), Avro (row-based, schema evolution, streaming), JSON/CSV (interchange only).

### Transformation and layering

ELT with SQL transformations versioned in Git (dbt is the de facto standard) — with tests, documentation and lineage. Common layering ("medallion"):

| Layer | Contents | Consumers |
|---|---|---|
| Bronze / raw | Data as ingested, append-only, with load metadata | Reprocessing, audit |
| Silver / staging + intermediate | Cleaned, deduplicated, typed, conformed keys | Data engineers, analysts |
| Gold / marts | Business-ready models: star schemas, metrics, feature tables | BI, analysts, ML, data products |

```sql
-- dbt model: models/marts/fct_orders.sql (incremental, idempotent by unique key)
{{ config(materialized='incremental', unique_key='order_id') }}
select
  o.order_id,
  o.customer_id,
  o.placed_at::date            as order_date,
  o.total_minor / 100.0         as order_total,
  o.currency,
  c.country
from {{ ref('stg_orders') }} o
join {{ ref('dim_customers') }} c using (customer_id)
{% if is_incremental() %}
where o.updated_at > (select max(updated_at) from {{ this }})
{% endif %}
```

### Orchestration

Pipelines are DAGs of tasks with dependencies, schedules, retries and alerts — orchestrated by Airflow, Dagster, Prefect, cloud services (Data Factory, Step Functions, Workflows) or dbt Cloud. Prefer **asset/data-aware** orchestration (run when upstream data changes) over blind cron schedules where possible.

### Pipeline properties

- **Idempotent:** re-running a run for the same period produces the same result (overwrite partitions or merge by keys; never blind appends).
- **Incremental:** process only new/changed data, with watermarks — plus a way to **backfill**.
- **Observable:** freshness, volume, schema and distribution checks; lineage to trace impact; alerts routed to owners.
- **Tested:** uniqueness, not-null, accepted values, referential integrity, row-count reconciliation with sources.

### Batch vs streaming

- **Batch** (hourly/daily): simpler, cheaper, easier to reprocess; latency of minutes to hours.
- **Streaming** (seconds): stream processors (Flink, Spark Structured Streaming, Kafka Streams, cloud stream analytics) handle windows, late events (watermarks), exactly-once state; more complex to build and operate.
- Many organisations use **micro-batch** or streaming ingestion with batch transformations; choose real-time only where the decision needs it (fraud, operational alerts, personalisation).

## How It Works

```mermaid
flowchart LR
  subgraph Sources
    DB[("Operational DBs")]
    EV[["App events"]]
    SAAS["SaaS APIs (CRM, payments)"]
  end
  DB -->|"CDC"| ING["Ingestion: CDC, connectors, streams"]
  EV --> ING
  SAAS -->|"ELT connectors"| ING
  ING --> RAW[("Raw / bronze tables (Parquet + Iceberg/Delta)")]
  RAW --> STG["Staging / silver: clean, dedupe, type"]
  STG --> MART["Marts / gold: star schemas, metrics, features"]
  MART --> BI["BI dashboards"]
  MART --> ML["ML features and training"]
  MART --> RE["Reverse ETL to operational tools"]
  ORCH["Orchestration, tests, lineage, freshness alerts"] -.-> STG
  ORCH -.-> MART
  CAT["Catalogue and governance: owners, classification, access"] -.-> RAW
  CAT -.-> MART
```

## When to Use / Trade-offs

| Choice | Use when | Avoid when | Trade-off |
|---|---|---|---|
| Managed warehouse (BigQuery, Snowflake, Fabric) | Most analytics needs, SQL-centric teams | Massive unstructured/ML workloads only | Simplicity vs cost at scale and lock-in |
| Lakehouse (Iceberg/Delta on object storage) | Large volumes, multiple engines, ML + BI, open formats | Small teams wanting minimal ops | Openness and cost vs more engineering |
| ELT with dbt | SQL transformations, versioned, tested | Complex non-SQL processing (use Spark/Python) | Accessibility vs compute in warehouse |
| CDC ingestion | Operational DB changes incl. deletes, low source impact | Tiny datasets where batch extracts suffice | Freshness vs operational complexity |
| Streaming processing | Decisions needing seconds (fraud, alerts) | Daily reporting | Latency vs complexity and cost |
| Reverse ETL | Push modelled data into CRM/support tools | When source systems should own the data | Activation vs data duplication |

## Common Pitfalls & Anti-patterns

- **Analytics on production OLTP** — slow queries hurting customers.
- **Non-idempotent pipelines** — re-runs create duplicates; backfills impossible.
- **No data quality checks** — dashboards silently wrong; trust lost.
- **Schema changes breaking pipelines** — upstream teams unaware of downstream consumers.
- **Data swamp** — undocumented raw files with no owners or catalogue.
- **Real-time everything** — streaming complexity where daily batches would do.
- **Business logic duplicated** across dashboards with different metric definitions.
- **PII sprawl** — personal data copied into every layer and tool without controls.
- **Cron-only orchestration** — jobs run whether or not upstream data arrived.

## Real-world Scenario

**Context:** A subscription company's finance and product teams reported different monthly recurring revenue (MRR) numbers. Data came from nightly CSV exports of production tables, transformed by ad-hoc scripts and spreadsheet logic; pipelines broke weekly after application schema changes, and backfills required manual SQL.

**Decision:** Introduced CDC from the billing database into raw tables in a cloud warehouse; dbt models in staging and mart layers with tests (uniqueness, not-null, accepted values, reconciliation of totals against the billing system); a single, documented `mrr` metric in the semantic layer used by all dashboards; incremental idempotent models with backfill support; data contracts with the billing team (schema changes reviewed in CI with downstream impact shown via lineage); freshness alerts routed to owners.

**Outcome:** One agreed MRR figure across finance and product; pipeline breakages from schema changes fell to near zero; finance month-end reporting shortened by several days.

**What I'd do differently:** Agree the metric definitions with finance first — technical improvements didn't matter until the definitions were settled.

## Interview Questions

### What's the difference between OLTP and OLAP systems? {#oltp-vs-olap}

**Level:** Foundation

**Model answer:**
- **OLTP** (online transaction processing) systems run applications: many small, concurrent reads and writes with transactions, row-oriented storage, normalised schemas, low latency — e.g. PostgreSQL behind an e-commerce site.
- **OLAP** (online analytical processing) systems answer analytical questions over large volumes: scans and aggregations over many rows but few columns, columnar compressed storage, denormalised/dimensional models — e.g. BigQuery, Snowflake, Databricks, ClickHouse.

Separating them protects production performance, allows analytical modelling without constraining application schemas, and lets each be optimised for its workload. Data moves from OLTP to OLAP via batch extracts, CDC or events.

**What the interviewer is looking for:**
Workload, storage and schema differences, and why to separate them.

**Follow-ups:**
- Why is columnar storage faster for analytics?
- What are HTAP databases?

**Red flags:**
- Running BI dashboards directly against the production database by default.

### ETL or ELT — what's the difference and which do you prefer? {#etl-vs-elt}

**Level:** Foundation

**Model answer:**
- **ETL (extract, transform, load):** transform data in a separate processing layer before loading it into the warehouse. Traditional when warehouse compute was expensive and storage limited.
- **ELT (extract, load, transform):** load raw data first, then transform inside the warehouse/lakehouse using its scalable compute (often SQL with dbt).

ELT is the modern default: raw data is preserved for reprocessing and audit; transformations are versioned SQL that analysts can contribute to; scaling is handled by the platform. ETL still makes sense when data must be cleaned, masked or reduced **before** landing (e.g. removing PII for compliance), for heavy non-SQL processing, or when the target can't do transformations.

**What the interviewer is looking for:**
Clear distinction, reasons ELT dominates, and valid ETL cases.

**Follow-ups:**
- How does keeping raw data help when a transformation bug is found?
- Where would you mask PII?

**Red flags:**
- No awareness of reprocessing needs.

### When should you use batch processing versus streaming? {#batch-vs-streaming}

**Level:** Foundation

**Model answer:**
- **Batch:** process accumulated data on a schedule (hourly, daily). Simpler, cheaper, easier to test and backfill. Fits reporting, finance, most analytics and ML training.
- **Streaming:** process events continuously with seconds of latency. Needed when decisions or user experiences depend on freshness: fraud detection, operational monitoring, real-time personalisation, inventory updates, IoT alerts.

Streaming adds complexity: event-time vs processing-time, watermarks for late data, windowing, stateful processing, exactly-once semantics, reprocessing and operational overhead. Many teams use streaming **ingestion** (CDC/events landing continuously) with batch or micro-batch **transformation**, getting reasonable freshness without full streaming complexity.

**What the interviewer is looking for:**
Use cases for each, streaming complexity, and the hybrid approach.

**Follow-ups:**
- What's a watermark in stream processing?
- How fresh does a sales dashboard really need to be?

**Red flags:**
- "Everything should be real-time."

### What are data warehouses, data lakes and lakehouses? {#warehouse-lake-lakehouse}

**Level:** Foundation

**Model answer:**
- **Data warehouse:** an analytical database for structured data — SQL, schemas, governance, high performance; e.g. Snowflake, BigQuery, Redshift, Synapse/Fabric warehouse.
- **Data lake:** cheap, scalable object storage holding raw data in any format (Parquet, JSON, images, logs). Flexible, supports ML and diverse data — but without table semantics, it lacks transactions, consistent schemas and governance, risking a "data swamp".
- **Lakehouse:** adds **open table formats** (Apache Iceberg, Delta Lake, Apache Hudi) on top of lake storage, providing ACID transactions, schema evolution, time travel, partition management and efficient queries — warehouse-like features on open, cheap storage, accessible from multiple engines (Spark, Trino, warehouses).

Many organisations converge on a lakehouse or a warehouse that can read open table formats, choosing based on scale, ML needs, openness and team skills.

**What the interviewer is looking for:**
Definitions, the problems each solves, and table formats as the lakehouse enabler.

**Follow-ups:**
- What does "time travel" in table formats enable?
- Why does Parquet matter?

**Red flags:**
- Treating a data lake as a dumping ground without catalogues or formats.

### How do you make data pipelines idempotent and re-runnable? {#idempotent-pipelines}

**Level:** Senior

**Model answer:**
- **Deterministic inputs per run:** process a defined slice (date partition, watermark range) rather than "everything since last time" without bounds.
- **Overwrite or merge, don't append blindly:** replace the target partition for that period (`INSERT OVERWRITE`), or `MERGE` on unique keys so re-runs update instead of duplicating.
- **Deduplicate on natural/event keys** in staging (CDC and events contain duplicates).
- **Atomic writes:** write to a temporary location/table and swap, or rely on table-format transactions, so partial failures don't leave half-written data.
- **Separate logic from schedule:** parameterise by logical date so backfills reuse the same code.
- **Track state explicitly:** watermarks and run metadata stored, not inferred.
- **Test re-runs:** run twice in CI or staging and compare results.

**What the interviewer is looking for:**
Bounded slices, overwrite/merge strategies, dedupe, atomicity, parameterised dates and testing re-runs.

**Follow-ups:**
- How do you backfill two years of data after a logic change?
- How do CDC deletes affect idempotency?

**Red flags:**
- Pipelines that append on every run and break on retries.

### How do you ensure data quality in pipelines? {#data-quality}

**Level:** Senior

**Model answer:**
- **Tests in transformations:** not-null, unique, accepted values, relationships (referential integrity), custom business rules (e.g. order total ≥ 0) — dbt tests or Great Expectations/Soda checks.
- **Reconciliation:** row counts and key totals compared with source systems (e.g. revenue matches billing).
- **Freshness checks:** alert when data hasn't arrived by its SLA.
- **Volume and distribution monitoring:** anomaly detection on row counts, null rates, value distributions (data observability tools).
- **Schema change detection** from sources with contracts and CI checks.
- **Circuit breakers:** stop publishing to downstream marts when critical tests fail, rather than spreading bad data.
- **Ownership and incident handling:** alerts routed to owners, documented runbooks, data incidents tracked like software incidents, consumers notified.

**What the interviewer is looking for:**
Layered checks (tests, reconciliation, freshness, anomalies), stopping bad data and ownership.

**Follow-ups:**
- What's the difference between data testing and data observability?
- Who should own data quality — producers or consumers?

**Red flags:**
- Discovering data issues from executives looking at dashboards.

### How does CDC work for feeding analytics? {#cdc-analytics}

**Level:** Senior

**Model answer:**
Change data capture reads the database's transaction log (Postgres WAL, MySQL binlog, SQL Server CDC) and emits row-level insert/update/delete events in commit order — via Debezium on Kafka Connect, cloud DMS, or native change feeds.

For analytics:
- Land change events in raw tables (append-only, with operation type, timestamps and log positions).
- Build **current-state tables** by merging changes (latest version per key, applying deletes) and **history tables** (SCD Type 2) when needed.
- Handle **initial snapshots** plus ongoing changes; **schema changes** (new columns) via schema registry/evolution; **ordering and duplicates** via log positions and keys.

Benefits over batch extracts: captures deletes, near-real-time freshness, low load on the source, no reliance on `updated_at` columns. Costs: operational complexity (connectors, replication slots that can bloat the source if consumers stall), and coupling to source schemas — mitigate with contracts or publishing curated events instead.

**What the interviewer is looking for:**
Mechanics, current-state and history modelling, edge cases and operational risks.

**Follow-ups:**
- What happens if a CDC consumer stops for a day on Postgres?
- CDC from tables vs publishing domain events — trade-offs?

**Red flags:**
- Ignoring deletes and schema changes.

### Why do file formats and partitioning matter for analytical performance? {#file-formats}

**Level:** Senior

**Model answer:**
**Formats:**
- **Parquet** (and ORC): columnar, compressed, with column statistics — queries read only needed columns and skip row groups via min/max stats. The default for analytics.
- **Avro:** row-based with schema evolution; good for streaming and ingestion.
- **CSV/JSON:** human-friendly interchange; slow and loosely typed for analytics.

**Table formats** (Iceberg, Delta, Hudi) add metadata for transactions, schema evolution, partition evolution and time travel over Parquet files.

**Partitioning and layout:**
- Partition by columns used in filters, commonly date (`event_date`) — enabling partition pruning.
- Avoid over-partitioning (millions of tiny files) — **small files** kill performance; compact regularly.
- Clustering/sorting (Z-ordering, clustering keys) co-locate related rows for better skipping.
- Choose file sizes in the hundreds-of-MB range for typical engines (VERIFY: engine-specific recommendations).

**What the interviewer is looking for:**
Columnar benefits, table formats, partition pruning and the small-files problem.

**Follow-ups:**
- What's partition evolution in Iceberg?
- How do you fix a table with 2 million small files?

**Red flags:**
- Storing analytical data as CSV at scale.

### How do you handle late-arriving data and backfills? {#late-data-backfills}

**Level:** Senior

**Model answer:**
**Late-arriving data** (events delayed by offline devices, retries, upstream outages):
- Partition by **event time**, but process by **ingestion time** windows and reprocess affected event-time partitions (e.g. re-run the last 3 days each night).
- In streaming, use **watermarks** and allowed lateness; route very late events to correction processes.
- Late dimension data (fact arrives before its customer record): use placeholder/"unknown" dimension members and update later, or delay processing.

**Backfills** (new logic, bug fixes, new sources):
- Pipelines parameterised by logical date and idempotent, so historical runs reuse the same code.
- Run in controlled batches with resource limits; compare outputs with previous versions; publish atomically.
- Communicate to consumers when historical numbers change, with explanations.

**What the interviewer is looking for:**
Event vs ingestion time, reprocessing windows, watermarks, late dimensions and safe backfills with communication.

**Follow-ups:**
- How far back should you reprocess each day?
- How do you backfill a streaming pipeline?

**Red flags:**
- Assuming data always arrives on time.

### How do you structure transformations in a modern analytics stack? {#transformation-layers}

**Level:** Senior

**Model answer:**
Use layered, version-controlled transformations (typically dbt):
- **Sources/raw (bronze):** declared sources with freshness checks; no business logic.
- **Staging (silver):** one model per source table — rename, cast types, standardise units and time zones, deduplicate; one-to-one with sources.
- **Intermediate:** reusable joins and business logic building blocks.
- **Marts (gold):** business-facing models — facts and dimensions, aggregated metrics, feature tables — organised by domain (finance, product, marketing).
- **Semantic layer/metrics definitions:** single definitions for metrics like MRR or active users, used consistently across BI tools.

Practices: tests and documentation on every model, code review in PRs, CI that builds changed models and their dependents against a sample or clone, environments (dev/prod), lineage graphs to understand impact, naming conventions (`stg_`, `int_`, `fct_`, `dim_`).

**What the interviewer is looking for:**
Clear layering, metric consistency, software engineering practices for SQL.

**Follow-ups:**
- Where should business logic live — BI tool or dbt?
- How do you test dbt changes before production?

**Red flags:**
- Metric logic duplicated in every dashboard.

### Design an analytics platform for a 300-person company. {#analytics-platform}

**Level:** Architect

**Model answer:**
**Requirements:** questions the business needs answered, data sources (product DB, payments, CRM, marketing, support), freshness needs (mostly daily; some hourly), data sensitivity, team skills and budget.

**Architecture (pragmatic, managed-first):**
- **Ingestion:** managed ELT connectors for SaaS sources; CDC for the product database; product events via an event pipeline or analytics SDK.
- **Storage/compute:** a managed cloud warehouse (or lakehouse if ML-heavy or large volumes), with raw/staging/marts layers.
- **Transformation:** dbt with tests, documentation and CI; orchestration via dbt Cloud, Dagster or Airflow.
- **Semantic layer and BI:** one BI tool with certified dashboards and governed metric definitions; self-service exploration on marts.
- **Data quality and observability:** freshness/volume checks, alerts to owners.
- **Governance:** catalogue (owners, descriptions, classification), role-based access, PII masking, retention policies, audit.
- **Activation:** reverse ETL for sales/support tools if needed.
- **Team:** a small central data team (analytics engineers, data engineer) plus embedded analysts; clear ownership of key domains.

Start with the highest-value use cases (revenue reporting, product funnel), deliver iteratively, and avoid over-building (no streaming or lakehouse until justified).

**What the interviewer is looking for:**
Requirements-first, managed components, layered modelling, governance, quality and a right-sized team and roadmap.

**Follow-ups:**
- How would you control warehouse costs?
- When would you add streaming?

**Red flags:**
- Starting with a complex big-data stack for modest volumes.

### What is data mesh, and when does it make sense? {#data-mesh}

**Level:** Architect

**Model answer:**
Data mesh (Zhamak Dehghani) is a socio-technical approach to analytical data at scale, based on four principles:
1. **Domain ownership:** domains (teams owning business capabilities) own their analytical data, not a central data team.
2. **Data as a product:** domains publish discoverable, trustworthy, documented datasets with SLAs, owners and contracts.
3. **Self-serve data platform:** a platform team provides infrastructure and tooling so domains can build data products without deep expertise.
4. **Federated computational governance:** global standards (interoperability, security, privacy, quality) defined federally and enforced automatically.

When it fits: large organisations where a central data team has become a bottleneck, with many domains and mature engineering teams. When it doesn't: small/medium companies — a central team with good practices is simpler; mesh adds organisational overhead and requires domain teams to take on data responsibilities.

Most organisations adopt elements (data products, contracts, ownership) without a full mesh.

**What the interviewer is looking for:**
Principles, conditions for success, costs, and pragmatic partial adoption.

**Follow-ups:**
- How do you avoid inconsistent metrics across domains in a mesh?
- What's in a data product?

**Red flags:**
- Presenting data mesh as a technology to buy.

### What are data contracts, and how do you implement them? {#data-contracts}

**Level:** Architect

**Model answer:**
A data contract is an agreement between data producers and consumers about a dataset or event stream:
- **Schema** (fields, types, nullability) and **semantics** (meaning, units, business definitions).
- **Quality expectations** (uniqueness, completeness, valid ranges), **freshness/SLAs**, and **ownership/contacts**.
- **Evolution rules:** compatible changes allowed; breaking changes require versioning and notice.
- **Access and classification** (PII, retention).

Implementation:
- Define contracts as code (YAML/JSON, schema registry entries, dbt model contracts) in the producer's repository.
- **CI enforcement:** producer changes are checked for compatibility; downstream impact shown via lineage.
- **Runtime checks:** validate data against the contract at ingestion or publication; quarantine violations.
- Prefer publishing **curated events or data products** from producers rather than consumers scraping internal tables.
- Make producers accountable (alerts go to them) and include contracts in definition of done for schema changes.

**What the interviewer is looking for:**
Contract contents, enforcement in CI and runtime, producer accountability and publishing curated interfaces.

**Follow-ups:**
- How do you introduce contracts for existing tables consumed by 50 dashboards?
- Who approves breaking changes?

**Red flags:**
- Consumers reading application tables directly with no agreements.

### Design a real-time analytics pipeline for live operational dashboards. {#real-time-pipeline}

**Level:** Architect

**Model answer:**
**Requirements:** which metrics, latency target (e.g. under 30 seconds), accuracy needs (exact vs approximate), volume (events/sec), retention and query patterns.

**Design:**
- **Event sources:** application events and CDC into a durable log (Kafka/Event Hubs/Kinesis), partitioned by a sensible key, with schemas in a registry.
- **Stream processing:** Flink or Spark Structured Streaming (or managed equivalents) computing windowed aggregates on **event time** with watermarks; stateful processing with checkpoints for fault tolerance; deduplication by event id.
- **Serving store:** a real-time OLAP database (ClickHouse, Apache Druid/Pinot) or the warehouse's streaming ingestion for low-latency queries; or materialised aggregates in a key-value store for fixed dashboards.
- **Dashboards:** query the serving layer; show data freshness explicitly.
- **Reconciliation with batch:** the batch pipeline remains the source of truth for financial reporting; real-time numbers may differ slightly — communicate and reconcile.
- **Operations:** lag monitoring, backpressure, replay capability from the log, schema evolution, cost controls.

**What the interviewer is looking for:**
Requirements, log-based architecture, event-time processing, appropriate serving stores, reconciliation with batch and operability.

**Follow-ups:**
- How do you handle a bug in the streaming job that produced wrong aggregates for 2 hours?
- When is a Lambda/Kappa architecture appropriate?

**Red flags:**
- Polling the production database every second.

### How do you implement data governance and privacy in data pipelines? {#data-governance}

**Level:** Architect

**Model answer:**
- **Catalogue and lineage:** every dataset has an owner, description, classification and lineage from source to consumption.
- **Classification-driven controls:** tag PII and sensitive fields at ingestion; apply masking/tokenisation, column- and row-level security automatically based on tags.
- **Minimisation:** don't ingest data you don't need; pseudonymise early (e.g. replace emails with hashed or tokenised ids in analytical layers).
- **Access management:** role-based and purpose-based access via groups; just-in-time access for sensitive data; audited queries.
- **Retention and deletion:** retention policies per dataset; propagate deletion requests (GDPR) through layers — design for it (keys that allow deletion, partitioning, crypto-shredding where data is immutable).
- **Residency:** keep data in permitted regions.
- **Quality and contracts** as part of governance; certified datasets for key metrics.
- **Federated model:** central standards and tooling, domain teams responsible for their data.

**What the interviewer is looking for:**
Catalogue/lineage, tag-based controls, minimisation, access, retention/erasure, residency and operating model.

**Follow-ups:**
- How do you propagate a deletion request through raw, staging and mart layers and backups?
- How do you let analysts work with sensitive data safely?

**Red flags:**
- Full production PII copied into every analytical layer and tool.

## Cheat Sheet

### Foundations
- **OLTP vs OLAP** — row-oriented transactions vs columnar scans and aggregations.
- **ELT** — load raw first, transform in the warehouse with versioned SQL (dbt).
- **CDC** — stream row changes from the DB log; captures deletes with low source load.
- **Warehouse / lake / lakehouse** — managed SQL store / raw object storage / open table formats adding ACID.
- **Parquet** — columnar, compressed default for analytics.
- **Iceberg / Delta / Hudi** — open table formats: transactions, schema evolution, time travel.

### Pipelines
- **Idempotent pipeline** — re-runs give the same result: overwrite partitions or merge on keys.
- **Medallion layers** — bronze (raw), silver (cleaned), gold (business-ready).
- **Data quality** — tests, reconciliation, freshness and volume checks; stop bad data publishing.
- **Event time vs processing time** — partition by event time; reprocess late windows.
- **Watermark** — streaming threshold for how late events can be before a window closes.
- **Small files problem** — too many tiny files kill query performance; compact.

### Organisation
- **Semantic layer** — single definitions of business metrics across tools.
- **Data contract** — schema, semantics, quality, SLAs and evolution rules between producer and consumers.
- **Data mesh** — domain ownership, data as a product, self-serve platform, federated governance.

## Further Reading

- [dbt documentation](https://docs.getdbt.com/docs/introduction) — ELT transformations, tests, documentation and best-practice project structure.
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/) — open table format concepts: snapshots, schema and partition evolution.
- [Delta Lake documentation](https://docs.delta.io/latest/index.html) — ACID tables on object storage.
- [Debezium documentation](https://debezium.io/documentation/) — change data capture connectors and semantics.
- [Apache Airflow documentation](https://airflow.apache.org/docs/) — orchestration concepts and idempotent task design.
- [Data Mesh Principles (Zhamak Dehghani)](https://martinfowler.com/articles/data-mesh-principles.html) — the original articulation of data mesh.
- [Fundamentals of Data Engineering (Reis & Housley)](https://www.oreilly.com/library/view/fundamentals-of-data/9781098108298/) — a broad, vendor-neutral overview of the data lifecycle.
