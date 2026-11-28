---
id: stakeholder-management
title: "Stakeholder Management"
group: product-business
tags: [stakeholders, communication]
level: Senior
estimatedMinutes: 45
related: [influence-without-authority, product-management]
lastReviewed: 2026-11-28
status: complete
---

## TL;DR

- Stakeholders are **anyone affected by, or able to affect, your work**. Map them by influence and interest, and engage each group differently.
- **Most stakeholder problems are expectation problems.** Agree goals, scope, trade-offs and how you'll communicate *at the start*, and re-confirm them when things change.
- **No surprises:** deliver bad news early, in person, with options and a recommendation.
- Speak each stakeholder's language: outcomes, risk, cost and time for executives; impact and timelines for business partners; detail for engineers.
- Clear **decision rights** (who decides, who is consulted) prevent most conflicts. RACI or a DACI-style model helps.

## Core Concepts

### Identifying and mapping stakeholders

Brainstorm broadly. Teams usually miss people, not the obvious sponsor:
- **Sponsor and decision-makers:** who funds it and who signs off?
- **Users and customers** and their proxies (support, sales, customer success).
- **Delivery partners:** other engineering teams, platform, security, data, legal, compliance, finance, procurement, vendors.
- **The affected:** operations, on-call teams, teams whose systems you depend on or change.
- **Influencers:** respected senior engineers, people whose opinion others follow.

**Power/interest grid (Mendelow):**

| | Low interest | High interest |
|---|---|---|
| **High power** | Keep satisfied (concise updates, consult on key decisions) | Manage closely (regular 1:1s, involve in decisions) |
| **Low power** | Monitor (broadcast updates) | Keep informed (demos, newsletters, feedback channels) |

Also note each stakeholder's **current stance** (champion, supporter, neutral, sceptic, blocker) and **what they care about**: their goals, fears and success metrics. Then plan the move: "Head of Support, neutral to supporter: show the reduced ticket volume from the pilot."

### Decision rights: RACI and DACI

**RACI** assigns, per decision or deliverable:
- **R**esponsible: does the work.
- **A**ccountable: the single owner who signs off.
- **C**onsulted: two-way input before the decision.
- **I**nformed: told after.

**DACI** (Driver, Approver, Contributors, Informed) is a variant for decisions. Rules: one Accountable or Approver per decision, Consulted kept small, and decision rights agreed before the contentious moment, not during it.

### Expectations and communication plan

At kick-off, agree:
- **Goals and success measures:** what outcome, measured how.
- **Scope and non-goals,** plus the **trade-off preference**: if we must flex, do we flex scope, date or quality? (Quality shouldn't really flex.)
- **Constraints and assumptions,** with dependencies listed.
- **Communication cadence:** weekly written update, monthly steering meeting, the channel for urgent issues, and how decisions get escalated.

### Status updates that work

A good update can be read in two minutes:

```markdown
**Checkout redesign — week 14 — Status: AMBER (was GREEN)**
**Summary:** Payment-provider certification slipped 2 weeks (their test env outage). Launch at risk for 3 March.
**Decisions needed:** By Fri: accept 17 March launch (recommended) OR launch 3 March without Apple Pay.
**Progress:** Address validation done; load test passed at 3× peak.
**Risks:** Provider capacity for re-certification (owner: Priya, mitigation: escalated to account manager).
**Next:** Complete certification run; start staged rollout plan.
```

Honest RAG status (red, amber, green), with trends and decisions needed at the top, beats long activity lists. "Watermelon reporting" (green outside, red inside) destroys trust.

### Worked example: retiring a legacy reporting tool

A data team plans to retire an old internal reporting tool used by about 400 people, moving them to the company's standard BI platform within two quarters. A first brainstorm lists 6 groups. A second pass, asking "who uses its exports, who supports it, who signs off?", finds 11.

**Stakeholder map (excerpt):**

| Stakeholder | Power | Interest | Stance | What they care about | Plan |
|---|---|---|---|---|---|
| CFO (sponsor) | High | Medium | Champion | Licence cost (£180,000 a year), audit findings on the old tool | Keep satisfied: monthly one-page update, decisions only |
| Finance controllers | Medium | High | Sceptic | Month-end close must not slip | Manage closely: migrate their 12 reports first, with parallel running over one close |
| Regional sales ops | Medium | High | Neutral | Their weekly pipeline export | Keep informed, plus a champion in each region |
| Internal audit | High | Low | Neutral | Evidence that report logic didn't change | Consult on the reconciliation approach early |
| Service desk | Low | High | Unaware | Ticket volume at switch-over | Keep informed: briefing pack and FAQ two weeks before |
| Owner of a nightly integration that reads the old tool's database | Low | Low (doesn't know yet) | Unaware | Their job will break | **Found by searching access logs.** Contacted directly in week 1 |

**Communication plan:**

| Audience | What | Channel | When |
|---|---|---|---|
| Sponsor and steering | Status, risks, decisions needed | One-page update and monthly meeting | Monthly |
| Report owners | Migration schedule, testing requests | Direct messages and office hours | Fortnightly |
| All 400 users | What changes, when, where to get help | Email, intranet banner, in-tool notice | 6 weeks, 2 weeks and 1 day before |
| Service desk | FAQ, known issues, escalation path | Briefing session | 2 weeks before |

**Result:** usage data showed 140 of the 900 reports had been opened in the past year, so the rest were archived instead of migrated, after owners confirmed. The finance reports ran in parallel through one month-end close and reconciled exactly. The undocumented integration was rebuilt before switch-off, not discovered by an outage.

## How It Works

```mermaid
flowchart TD
  A["Identify stakeholders broadly"] --> B["Map: power and interest, stance, what they care about"]
  B --> C["Agree goals, scope, trade-offs, decision rights (RACI)"]
  C --> D["Communication plan: cadence and channel per group"]
  D --> E["Execute: updates, demos, 1:1s, early warnings"]
  E --> F{"Change, risk or conflict?"}
  F -->|"no"| E
  F -->|"yes"| G["Engage early: facts, options, recommendation"]
  G --> H["Decision by the accountable owner, recorded"]
  H --> I["Update plan and re-confirm expectations"]
  I --> E
```

### Delivering bad news without surprises

```mermaid
sequenceDiagram
  participant L as Tech lead
  participant S as Sponsor
  participant G as Steering group
  participant A as Affected teams
  %% step: The payment provider's certification slips by two weeks. Within a day, the tech lead confirms the impact: the 3 March launch is at risk. They don't wait in the hope of catching up.
  %% step: The same day, the tech lead tells the sponsor one to one: the facts, the impact, two options and a recommendation. Nobody senior hears it first in a meeting.
  %% step: The sponsor asks what launching without Apple Pay would cost. The tech lead answers with data: about 12% of mobile checkouts use it.
  %% step: Two days before the steering meeting, a short pre-read sets out the decision needed, the options and the recommendation, so the meeting can decide rather than discover.
  %% step: The steering group chooses to move the launch to 17 March. The decision is recorded with its owner and reasoning.
  %% step: The tech lead tells affected teams such as support and marketing directly, with the new date and what changes for them, before the general announcement.
  %% step: The weekly update shows the status as amber, with its trend and the next checkpoint. The status is honest rather than optimistic.
  %% step: After launch, the tech lead and sponsor review what early signal could have warned them sooner, and add it to the risk checks for the next project.
  L->>L: Confirm impact within a day
  L->>S: Tell the sponsor 1:1: facts, options, recommendation
  S-->>L: Cost of launching without Apple Pay?
  L->>G: Pre-read: decision, options, recommendation
  G-->>L: Decision: launch on 17 March
  L->>A: New date and what changes for you
  L->>G: Weekly update: AMBER, trend, next checkpoint
  L->>S: Review the early warning signs
```

## When to Use / Trade-offs

| Technique | Use when | Avoid when | Trade-off |
|---|---|---|---|
| Power/interest grid | Any project with more than a handful of stakeholders | Tiny, single-team work | Quick insight; can oversimplify individuals |
| RACI / DACI | Cross-team decisions; recurring confusion about who decides | Small teams with obvious ownership | Clarity vs bureaucracy if over-applied |
| Steering committee | Large programmes with significant funding or risk | Small projects; it becomes theatre | Senior alignment vs meeting overhead |
| Written weekly update | Many stakeholders, async orgs | Stakeholders who need dialogue on decisions | Scales well; one-way |
| 1:1 pre-wiring | Contentious decisions, influential sceptics | Routine updates | Builds trust; time-consuming |
| Demos | Showing progress, getting early feedback | Nothing real to show yet | Concrete and engaging; can set false expectations if mocked-up |

## Common Pitfalls & Anti-patterns

- **Watermelon status** — green on the dashboard, red in reality, until it's too late.
- **Surprising stakeholders** — the first they hear of a delay is in a public meeting or on launch day.
- **Talking tech to executives** — "the Kafka consumer rebalance issue" instead of "orders may be delayed by up to 2 hours on peak days."
- **Forgetting quiet stakeholders** — security, legal, support or the on-call team discovered at the end, with veto power.
- **Saying yes to everyone** — scope creep, then broken commitments.
- **Unclear decision rights** — two VPs both believe they approve the scope.
- **Communicating only through tickets** — no relationships, so no goodwill when things go wrong.
- **Hiding behind process** — "it's not in the backlog" without understanding the need.

## Real-world Scenario

**Context:** A platform team was replacing the company's identity system, affecting 40 internal applications and every customer login. Six months in, the programme was "green" in reports, but three application teams hadn't started integration, security was unhappy about a token design detail, and customer support didn't know login screens would change.

**Decision:** The new technical lead:
1. Ran a stakeholder mapping session and found 14 groups. Five, including support, the mobile release managers and the fraud team, had never been engaged.
2. Agreed a RACI: the CISO accountable for the security design, the platform lead for the delivery plan, application teams responsible for their integrations.
3. Reset the status to amber with a clear recovery plan and the decisions needed.
4. Set up a fortnightly written update, a monthly steering group with business owners, office hours for app teams and a support briefing pack with screenshots and FAQs.

**Outcome:** The launch moved by 5 weeks, but with no surprises. All 40 applications migrated, support handled the change with ticket volume only 8% above normal, and security signed off without late changes.

**What I'd do differently:** Map stakeholders on day one, not in month six. The fraud team's requirements alone would have changed the session design early, at a fraction of the cost.

## Interview Questions

### How do you identify and map stakeholders for a new project? {#stakeholder-mapping}

**Level:** Foundation

**Model answer:**
Start broad. Brainstorm everyone who is affected by, or can affect, the project: sponsors and decision-makers, users and customers, delivery partners (other teams, platform, security, legal, finance, vendors), operations and support, and influential individuals. Ask existing stakeholders "Who else should I talk to?"

Then map them:
- **Power/interest grid:** manage high-power, high-interest people closely. Keep high-power, low-interest people satisfied. Keep low-power, high-interest people informed. Monitor the rest.
- **Stance:** champion, supporter, neutral, sceptic or blocker, and *why*.
- **What they care about:** their goals, metrics and fears.

Use the map to plan engagement for each group (cadence, format, who owns the relationship) and revisit it as the project evolves. People's power, interest and stance change.

**What the interviewer is looking for:**
Breadth of identification, a mapping technique, attention to motivations and stance, and using the map to drive engagement.

**Follow-ups:**
- Which stakeholders are most often forgotten?
- How do you engage a high-power stakeholder who doesn't care about your project?

**Red flags:**
- Considering only the sponsor and the immediate team.
- A map made once and never used.

### What is RACI, and when is it useful? {#raci}

**Level:** Foundation

**Model answer:**
RACI is a responsibility matrix that sets, for each key decision or deliverable, who is:
- **Responsible:** does the work. There can be several.
- **Accountable:** owns the outcome and makes the final call. Exactly **one** per item.
- **Consulted:** gives input before the decision (two-way communication).
- **Informed:** kept up to date after decisions (one-way).

It's useful when work crosses teams or departments and there's confusion or conflict about who decides: security sign-off, scope changes, go-live approval, budget. DACI (Driver, Approver, Contributors, Informed) is a similar decision-focused variant.

Keep it lightweight: cover the decisions that matter, agree it at kick-off and keep "Consulted" small, or decisions slow down.

**What the interviewer is looking for:**
Correct definitions, the single-Accountable rule and pragmatic use.

**Follow-ups:**
- What goes wrong when two people are Accountable?
- How is DACI different?

**Red flags:**
- Several Accountable people for one decision.
- A RACI for every trivial task.

### What does a good status update look like? {#status-updates}

**Level:** Foundation

**Model answer:**
- **Headline first:** overall status (red, amber or green), with the trend ("amber, was green") and a one-line summary.
- **Decisions or help needed,** with deadlines and a recommendation. This is the most important section for senior readers.
- **Progress against milestones,** not a list of activity.
- **Risks and issues,** each with an owner and a mitigation.
- **Next steps.**
- **Brief:** readable in two minutes, with links to the detail.

Principles:
- **Honest status:** amber when the risk is real, not when it's certain. Explain what would turn it green.
- **Consistent format and cadence,** so people know where to look.
- **Tailored:** a short version for executives, more detail for delivery partners.
- **No surprises:** anything serious is discussed in person *before* it appears in a written update.

**What the interviewer is looking for:**
Decision-oriented structure, honest RAG status with trends, brevity and audience awareness.

**Follow-ups:**
- When do you turn a project red?
- How do you report on a project with lots of uncertainty?

**Red flags:**
- Pages of activity with no decisions or risks.
- Status that stays green until the deadline is missed.

### How do you set expectations at the start of a project? {#setting-expectations}

**Level:** Foundation

**Model answer:**
In a kick-off and a short written charter, agree:
- **The problem and goals,** with success measures ("reduce checkout abandonment from 22% to 18%").
- **Scope and explicit non-goals.**
- **Constraints, assumptions and dependencies:** what we rely on from others, and the dates that depend on it.
- **The trade-off preference:** if something has to give, is it scope or date? Agree upfront that quality and security don't flex.
- **The estimate as a range with confidence** ("6–9 weeks; we'll narrow it after the first 2 weeks of discovery"), not a single date.
- **Decision rights and escalation path** (RACI).
- **The communication plan:** who gets what, how often and where.

Then re-confirm expectations whenever something material changes, rather than assuming the original agreement still holds.

**What the interviewer is looking for:**
Goals and measures, non-goals, range estimates, an explicit trade-off preference, decision rights and a communication plan.

**Follow-ups:**
- The sponsor insists on a fixed date and fixed scope. What do you do?
- How do you handle a stakeholder who skipped the kick-off?

**Red flags:**
- Committing to a single date before discovery.
- No written record of what was agreed.

### You discover your project will be six weeks late. How do you tell stakeholders? {#delivering-bad-news}

**Level:** Senior

**Model answer:**
1. **Tell them early.** As soon as the slip is likely, not certain. Bad news ages badly.
2. **Get the facts straight:** what happened, the new estimate with confidence, and the impact on dependants (marketing launch, customer commitments).
3. **Prepare options with trade-offs:**
   - Ship a reduced scope on the original date.
   - Move the date.
   - Add capacity, with its real effect (often small, per Brooks's law).
   - Phase the launch.

   Include a recommendation.
4. **Tell the key people individually first,** in person or on a call: the sponsor and those most affected. Then put it in writing for everyone else. Nobody should learn it from a dashboard.
5. **Own it** without blame or excessive apology, explain what we've learned and what we're changing so it doesn't recur (estimation, dependency management).
6. **Agree a decision and update the plan.** Communicate the new commitments and then hit them.

**What the interviewer is looking for:**
Timeliness, prepared options with a recommendation, private-before-public communication, ownership and a corrective plan.

**Follow-ups:**
- The sponsor reacts angrily. How do you handle the conversation?
- How do you avoid being late again?

**Red flags:**
- Waiting until the deadline.
- Blaming another team in front of stakeholders.

### Two stakeholders give you conflicting requirements. What do you do? {#conflicting-stakeholders}

**Level:** Senior

**Model answer:**
1. **Understand each need deeply.** Talk to each separately: what problem are they solving, why does it matter and what does success look like? Conflicts at the level of *solutions* often disappear at the level of *needs*. For example, Sales wants custom fields per customer and Compliance wants a strict schema. The underlying needs may both be met by a validated extension mechanism.
2. **Look for options that satisfy both,** or sequence them (one now, the other next).
3. **If there is a genuine trade-off, make it explicit:** describe it neutrally, with the impact of each option on the business goals, ideally in one document both agree is fair.
4. **Escalate to the right decision-maker:** the person accountable for both areas, or the product owner. Use a joint conversation, not separate lobbying.
5. **Record the decision and the reasoning,** and communicate it to both. Make sure the "losing" side understands why and what they can expect later.

**What the interviewer is looking for:**
Separating needs from solutions, creative options, neutral framing of trade-offs and clean escalation to the right decider.

**Follow-ups:**
- What if both stakeholders are equally senior and have no common manager below the CEO?
- How do you stay neutral when you have an opinion?

**Red flags:**
- Implementing both and creating an incoherent product.
- Choosing whoever is most senior or loudest without analysis.

### A stakeholder keeps changing the scope mid-project. How do you handle it? {#scope-changes}

**Level:** Senior

**Model answer:**
Change isn't bad in itself. Learning should change plans. **Unmanaged** change is the problem.

- **Understand why the changes happen:** new information, unclear original goals, pressure from their own stakeholders, or discovering what they want by seeing it? The fix depends on the cause.
- **Make the cost of change visible:** for each change, show its impact on the date, other scope and risk. "Adding multi-currency now moves launch by 3 weeks, or we drop bulk export. Which do you prefer?"
- **Have a lightweight change process:** changes go through the product owner, are assessed and are accepted with an explicit trade-off. Not every request becomes a commitment.
- **Shorten feedback loops:** frequent demos and prototypes surface changes earlier, when they're cheaper.
- **Revisit the goals:** if the changes keep coming, the original goals may have been wrong. Reset them openly rather than absorbing endless churn.

**What the interviewer is looking for:**
Curiosity about the cause, visible trade-offs, a light change mechanism and early feedback loops.

**Follow-ups:**
- The stakeholder is a senior executive who says "just make it happen". What now?
- How do you handle changes requested directly to engineers?

**Red flags:**
- Silently absorbing every change, then missing the deadline.
- Refusing all change on principle.

### How do you communicate a technical risk to non-technical stakeholders? {#technical-risk-communication}

**Level:** Senior

**Model answer:**
- **Translate it into business impact and likelihood:** not "the database is single-AZ", but "if one data centre fails, which happens a few times a year across the industry, customers can't place orders for 1–3 hours. At peak, that's about £80k in lost sales per hour."
- **Use concrete comparisons and recent events:** a competitor's outage, our own near miss.
- **Quantify what you can,** and be honest about uncertainty with ranges.
- **Offer options with cost, effort and residual risk:** fix fully, mitigate partially, or accept the risk.
- **Make a recommendation, and ask for a decision.** If they accept the risk, record who accepted it and when it will be reviewed.
- **Keep it short:** one page or five minutes, with technical detail available for those who want it.

**What the interviewer is looking for:**
Business framing, quantification, options and a decision, including documented risk acceptance.

**Follow-ups:**
- How do you avoid crying wolf?
- What do you do if they accept a risk you think is unacceptable?

**Red flags:**
- Jargon-heavy explanations.
- Raising risks without options.

### A senior stakeholder keeps going directly to engineers with requests, bypassing the process. What do you do? {#bypassing-process}

**Level:** Senior

**Model answer:**
1. **Understand why.** Is the official process too slow? Are their requests consistently deprioritised? Is it urgency, or habit? The bypass is often a symptom of a real problem.
2. **Talk to them directly and privately:** acknowledge their need, and explain the impact of the bypass. Engineers get interrupted, other commitments slip, and work is done without prioritisation, testing or visibility.
3. **Offer a better path:** a fast lane for genuinely urgent requests, a named contact (the product owner or me), regular slots to review their requests, and transparency on where their items sit.
4. **Support the engineers:** they should feel able to say "please raise this with our product owner" without fear. Back them up.
5. **If it continues, escalate respectfully,** to align with the stakeholder's manager or the product leadership on how requests are handled.

**What the interviewer is looking for:**
Diagnosing the root cause, a direct but respectful conversation, an improved process and protecting the team.

**Follow-ups:**
- The stakeholder is the CEO. Does your approach change?
- How do you handle it when the bypassed request was actually important?

**Red flags:**
- Blaming the engineers.
- Ignoring it and letting the team be pulled in many directions.

### How do you build trust with a sceptical stakeholder? {#skeptical-stakeholder}

**Level:** Senior

**Model answer:**
- **Understand the scepticism:** past experience (previous projects that failed them), different goals, fear of losing control, or a lack of information. Ask directly: "What would you need to see to be confident in this?"
- **Involve them early:** consult them on things that affect them, and incorporate their input visibly ("We changed the rollout plan based on your concern about month-end").
- **Deliver small, visible wins quickly:** reliability builds trust faster than presentations.
- **Be transparent:** share risks and bad news early. Sceptics trust people who don't hide problems.
- **Keep promises meticulously,** including small ones like sending the notes or answering the question by Friday.
- **Find common ground:** the shared goals you both care about.

Over time, a sceptic who has been listened to often becomes a strong advocate. Their concerns usually improve the plan.

**What the interviewer is looking for:**
Empathy and curiosity, involvement, early wins, transparency and reliability.

**Follow-ups:**
- What if their scepticism is based on a misunderstanding of the technology?
- How do you handle a sceptic who is actively undermining the project?

**Red flags:**
- Avoiding sceptics.
- Trying to win them over with more slides.

### How would you manage stakeholders for a migration affecting 30 teams and several business units? {#large-programme-stakeholders}

**Level:** Architect

**Model answer:**
**Structure:**
- **An executive sponsor** with authority across the affected units, who owns the "why now" and resolves priority conflicts.
- **A steering group** with business-unit representatives, meeting monthly, deciding on scope, sequencing and risk acceptance.
- **A working group** of team-level tech leads and champions, meeting weekly or fortnightly.
- **A RACI** for key decisions and for each team's migration.

**Mapping and segmentation:** classify the teams and business units by impact, readiness and stance. Plan engagement for each segment: early adopters as design partners, the majority with self-service support, laggards and blockers with individual plans and executive help.

**Communication:**
- A single source of truth (a programme page with the plan, FAQs, timelines and a migration tracker).
- A fortnightly written update.
- Dedicated channels and office hours.
- Business-friendly summaries for non-technical units: impact on their customers, timelines, what they need to do.

**Expectation management:** clear deadlines and why they exist, a published support model, transparent progress per team (a dashboard), and early warning when teams fall behind.

**Feedback:** surveys or retrospectives after each wave, and a visible "you said, we did" response.

**What the interviewer is looking for:**
Governance layers with clear roles, segmentation, a single source of truth, transparency and feedback loops.

**Follow-ups:**
- A business unit refuses to allocate time. What do you do?
- How do you keep the steering group from becoming a status theatre?

**Red flags:**
- One mass email and a deadline.
- No executive sponsor.

### How do you design an effective steering committee? {#steering-committee}

**Level:** Architect

**Model answer:**
- **A clear purpose and decision rights:** a steering committee exists to **make decisions** (scope trade-offs, funding, risk acceptance, resolving cross-unit conflicts) and remove blockers. It isn't for status updates, which go out in writing beforehand.
- **The right membership:** a small group (5–8) of people with real authority over the affected budgets and teams, plus the programme lead and chief architect. Delegates without decision power make it useless.
- **A cadence matched to the decision flow:** monthly, with ad hoc sessions for urgent decisions.
- **Prepared sessions:** a pre-read sent 48 hours ahead (status, key risks, the decisions needed with options and recommendations). The meeting time is spent on the decisions, and the decisions are recorded with owners and dates.
- **Honest information:** a culture where amber and red are welcome. Reward early bad news. A committee that punishes bad news gets watermelon reporting.
- **Review itself:** is it making decisions and unblocking work? If not, change it or disband it.

**What the interviewer is looking for:**
Decision focus, authority of members, pre-reads, recorded decisions and psychological safety for bad news.

**Follow-ups:**
- Members keep sending delegates. What do you do?
- How do you handle a decision the committee keeps deferring?

**Red flags:**
- A two-hour status slide-show.
- No recorded decisions.

### How do you manage stakeholders during a major production incident? {#incident-stakeholders}

**Level:** Architect

**Model answer:**
- **Separate the communication role from the technical response:** a communications lead (not the engineers debugging) handles stakeholders, while the incident commander coordinates. This protects the responders from interruptions.
- **Communicate early and on a cadence:** the first update within 15–30 minutes of declaring a SEV1, even if it only says "we're investigating", then at fixed intervals (for example every 30 minutes) even with no news, so stakeholders don't chase engineers.
- **Use templates:** what's affected (customer impact in business terms), what we know, what we're doing, the next update time. Avoid speculating on causes or promising ETAs you can't keep.
- **Segment the audiences:**
  - Executives: impact, business exposure, decisions needed.
  - Customer-facing teams (support, sales): what to tell customers, approved wording.
  - Customers: the status page and direct notifications for key accounts.
  - Regulators: when required, within the legal deadlines, via legal and compliance.
- **Close well:** a resolution notice, then a postmortem summary for stakeholders in business language, with the actions being taken. Brief key customers personally where appropriate.

**What the interviewer is looking for:**
Role separation, cadence and templates, audience segmentation, regulatory awareness and follow-through.

**Follow-ups:**
- An executive joins the incident bridge and starts directing engineers. What do you do?
- How do you communicate when you don't yet know the impact?

**Red flags:**
- Engineers fielding executive questions while debugging.
- Silence until it's fixed.

### How do you manage vendor and third-party stakeholders on a critical project? {#vendor-stakeholders}

**Level:** Architect

**Model answer:**
- **Know their incentives:** account managers optimise for renewals and upsells, their engineers for their own roadmap. Align your asks with their interests where possible (case studies, early-adopter feedback).
- **Make the contract match the reality:** SLAs, support tiers, escalation paths, data-processing terms and exit provisions agreed before you depend on them. Involve procurement and legal early.
- **Build relationships at several levels:** technical contacts for daily work, the account manager for commercial issues, and an executive sponsor on their side for escalation. Know the escalation path *before* an incident.
- **Make joint plans with shared milestones** and regular check-ins, and track the vendor's dependencies as risks with mitigations in your own plan.
- **Reduce dependency risk:** abstraction layers, fallback options, exit plans, and evaluating vendor health (financial, security posture).
- **Treat them as partners, but verify:** test their claims (load tests, failover tests) instead of trusting slides.

**What the interviewer is looking for:**
Understanding vendor incentives, contractual foundations, multi-level relationships, joint planning and risk mitigation with verification.

**Follow-ups:**
- The vendor misses a critical delivery date. What do you do?
- How do you handle a vendor whose product roadmap diverges from your needs?

**Red flags:**
- Relying on goodwill without contractual SLAs.
- Discovering the escalation path during an outage.

### Product, sales and engineering disagree strongly on a roadmap trade-off. How do you align them? {#cross-functional-alignment}

**Level:** Architect

**Model answer:**
1. **Bring everyone back to the shared goals:** company objectives, customer outcomes, revenue and retention targets. Agreement at that level makes the trade-off discussion concrete.
2. **Make each position explicit and steel-manned:**
   - *Sales:* "These 3 enterprise deals, worth £2.4M, need SSO and audit logs by Q2."
   - *Product:* "The activation redesign affects 100% of new users; we lose 30% at onboarding."
   - *Engineering:* "The payments platform upgrade is needed before PCI renewal in Q3; skipping it is a compliance risk."
3. **Quantify cost of delay and risk** for each option on a common scale (revenue at risk, users affected, compliance exposure) with confidence levels.
4. **Explore options:**
   - Sequence the work.
   - Reduce the scope of each (a minimal SSO for the top deal).
   - Add temporary capacity.
   - Buy instead of build (SSO through a managed identity provider).
5. **Decide with the right owner:** usually the product leader, or an executive above all three for the biggest trade-offs, in one joint session with the analysis prepared beforehand.
6. **Communicate the decision and its reasoning to all sides,** including what each group will get and when, and set review points.

**What the interviewer is looking for:**
Anchoring on shared goals, fair representation of each view, common-scale quantification, creative options and a clear decider.

**Follow-ups:**
- Sales escalates to the CEO after the decision. What now?
- How do you prevent this conflict recurring each quarter?

**Red flags:**
- Siding with whichever function you belong to.
- Splitting capacity evenly to avoid conflict.

### How do you write a one-page summary that gets an executive decision? {#executive-summary}

**Level:** Foundation

**Model answer:**
Executives read many documents in little time. A good one-pager lets them **understand the decision and make it in a few minutes**.

**Put the bottom line up front (BLUF):** the first two or three sentences say what you need and what you recommend. "We need a decision by Friday on the launch date. We recommend moving from 3 to 17 March, because launching earlier means dropping Apple Pay."

**A structure that works:**
1. **Decision needed and deadline.**
2. **Context:** only what's needed to understand the decision, in two or three sentences.
3. **Options,** usually two or three, each with its impact on outcomes, cost, time and risk.
4. **Recommendation and why.**
5. **Risks and what you'll do about them.**
6. **What happens next** once they decide.

**Writing style:**
- **Business language:** customers, revenue, cost, risk and dates, not system names.
- **Numbers with context:** "£40,000, about 5% of the quarter's budget".
- **Short sentences and headings,** and supporting detail in an appendix or link.
- **Honest uncertainty:** "We're confident about the cost; the date depends on the vendor."

**Test it:** ask someone outside the project to read it in two minutes and tell you what decision is being asked for. If they can't, rewrite the opening.

**What the interviewer is looking for:**
Bottom line up front, a clear decision with a deadline, comparable options, a recommendation, business language, and testing it on a fresh reader.

**Follow-ups:**
- The executive disagrees with your recommendation. What do you do?
- How is this different from a design document?

**Red flags:**
- Three pages of background before the decision.
- Presenting options with no recommendation.

### How do you facilitate a workshop that gets stakeholders to a decision? {#decision-workshops}

**Level:** Senior

**Model answer:**
Workshops fail when people arrive with different expectations and leave without a decision. **Most of the work happens before the room.**

**Before:**
- **Agree the purpose and output** with the sponsor: "Choose one of three migration approaches", not "discuss migration".
- **Agree the decision rule up front:** who decides, and how? The sponsor after hearing everyone, consensus, or a vote with the sponsor holding a veto.
- **Invite the right people:** those who decide, those with essential knowledge, and those who must carry it out. Keep it small enough to work.
- **Pre-wire the contentious ones** one to one, so objections are known before the meeting.
- **Send a short pre-read** with the options and the criteria.

**During:**
- Open with the purpose, the decision rule and the agenda.
- **Agree criteria before options:** weight cost, risk, time and customer impact first, so people don't just argue for favourites.
- **Diverge, then converge:** explore options and concerns, then narrow down. Silent writing before discussion stops the loudest voice dominating.
- Use simple tools: options against criteria in a table, dot voting to see where people stand, and a "parking lot" for off-topic issues.
- **Close by stating the decision,** owners and next steps, and check everyone heard the same thing.

**After:** send a written summary within a day, including the reasoning and any dissent, and follow up on actions.

**What the interviewer is looking for:**
A clear purpose and output, the decision rule agreed in advance, the right participants, pre-wiring, criteria before options, structured divergence and convergence, and a written follow-up.

**Follow-ups:**
- A senior person dominates the discussion. What do you do?
- The workshop ends without a decision. What next?

**Red flags:**
- A workshop with no defined output.
- Deciding how to decide only when people already disagree.

### How do you communicate a change to people who didn't ask for it? {#communicating-change}

**Level:** Senior

**Model answer:**
Changes people didn't ask for, such as a new login, a retired tool or a new process, fail more often through **poor change management** than through poor technology. People resist changes they don't understand or feel done to them.

**Plan for the stages people go through.** Prosci's ADKAR model is a useful checklist:
- **Awareness:** why the change is happening.
- **Desire:** what's in it for them, or at least why it's necessary.
- **Knowledge:** how to do things the new way.
- **Ability:** time, practice and support to actually do it.
- **Reinforcement:** follow-up, so people don't drift back.

**Segment the audience:** heavy users, occasional users, admins, support staff and people whose integrations depend on the old way all need different messages.

**Practical steps:**
- **Announce early and repeat:** for example 6 weeks, 2 weeks and 1 day before, through channels people actually read, including in-product notices.
- **Explain the why** in their terms, and be honest about anything that gets worse.
- **Show, don't just tell:** short videos, a sandbox, side-by-side guides.
- **Find champions** in each group to answer questions and report problems.
- **Prepare support:** brief the service desk, publish an FAQ, and staff up at switch-over.
- **Offer a transition period** where possible, with the old way available read-only.
- **Listen and adjust:** feedback channels, early pilots, and a willingness to fix real problems before full rollout.

**Measure:** adoption, support tickets, task completion and satisfaction after the change.

**What the interviewer is looking for:**
Change management as a discipline, ADKAR or similar stages, audience segmentation, early and repeated communication, champions, support readiness, transition periods and feedback.

**Follow-ups:**
- A vocal group lobbies to cancel the change. How do you respond?
- How do you communicate a change that makes some people's work harder?

**Red flags:**
- One email on the day of the change.
- Treating resistance as people being difficult.

### How do you manage regulators and auditors as stakeholders? {#regulators-auditors}

**Level:** Architect

**Model answer:**
Regulators and auditors have real power: findings can stop a launch, bring fines or require remediation programmes. Treat them as **high-power stakeholders whose trust is built over time**, not as adversaries to be handled at the end.

**Know what they need:**
- **Regulators** care about outcomes for customers and markets, and about whether you understand and control your risks.
- **Internal and external auditors** need evidence that controls exist, are designed well and work in practice.

**Principles:**
- **No surprises:** tell them about significant changes, incidents or risks early, through the agreed channel and within any required notification deadlines. Late disclosure damages trust more than the issue itself.
- **One accountable point of contact,** usually through compliance or risk teams. Engineers support them with accurate technical detail.
- **Evidence by design:** build controls that produce evidence automatically, such as pipeline approvals, access reviews and change logs. Audits then become extracting existing evidence.
- **Accuracy over reassurance:** answer precisely what's asked, say when you don't know and follow up. Never overstate a control.
- **Track commitments:** every finding and promised remediation has an owner, a date and visible progress.

**Engage early on big changes:** a cloud migration, a new AI system or outsourcing a critical service may need prior notification or approval, such as under the EU's DORA (Digital Operational Resilience Act) for financial entities' critical ICT third-party arrangements. Discuss the design while it can still change.

**When you disagree with a finding:** respond with evidence through the formal process, separate facts from interpretation, and propose alternatives that meet the underlying intent.

**What the interviewer is looking for:**
Understanding what regulators and auditors need, early disclosure, a single point of contact, evidence by design, precise answers, tracked remediation, early engagement on major changes, and constructive disagreement.

**Follow-ups:**
- An auditor asks for evidence of a control you're not sure works. What do you do?
- How do you explain a cloud architecture to a non-technical regulator?

**Red flags:**
- Treating audits as a quarterly scramble.
- Hiding or minimising an issue to avoid scrutiny.

### A programme has lost stakeholder trust after repeatedly missing its dates. How do you reset it? {#programme-reset}

**Level:** Architect

**Model answer:**
After repeated slips, another optimistic date makes things worse. A reset needs **honesty about the past, a credible plan and visible proof**.

**1. Find out the truth first** (2–4 weeks):
- Review the actual scope, progress and velocity, not the reported status. An independent review or a peer from outside the programme helps.
- Find the causes: scope growth, unrealistic estimates, dependencies, skills, decision delays or an architecture problem.

**2. Re-baseline honestly:**
- Forecast from **actual throughput,** using ranges ("most likely May, 85% confident by July") rather than a single date.
- **Cut or phase scope** to deliver value sooner. Ask what the smallest valuable release would be.
- Present it with the reasons for past misses and what will be different this time. Acknowledge the history plainly.

**3. Change how it's run:**
- **Shorter milestones** with demonstrable outcomes, such as working software every few weeks rather than percentage-complete reports.
- **Clear decision rights** and a steering group that decides quickly.
- **Honest status reporting,** including amber and red, with early warnings.
- Fix the structural causes, such as dependencies on teams with no capacity allocated.

**4. Rebuild trust with evidence:** hit the first few milestones exactly as promised, even if small. Credibility returns through kept promises, not presentations.

**Consider stopping:** if the reset shows the business case no longer holds, recommend stopping or reshaping the programme. Sunk costs aren't a reason to continue.

**What the interviewer is looking for:**
Diagnosing the real state, honest re-baselining with ranges and reduced scope, structural changes to governance and milestones, rebuilding trust through kept promises, and willingness to stop.

**Follow-ups:**
- The sponsor insists on keeping the original scope and date. What do you do?
- How do you keep the team motivated during a reset?

**Red flags:**
- Announcing a new single date without changing anything else.
- Blaming the previous leadership or the team.

## Cheat Sheet

- **Stakeholder** — anyone affected by, or able to affect, your work; identify them broadly and early.
- **Power/interest grid** — manage closely, keep satisfied, keep informed, monitor.
- **Stance mapping** — champion, supporter, neutral, sceptic or blocker; plan how to move each.
- **RACI** — Responsible, Accountable (exactly one), Consulted, Informed.
- **DACI** — Driver, Approver, Contributors, Informed; a decision-focused variant.
- **Kick-off agreement** — goals, measures, non-goals, trade-off preference, decision rights, comms plan.
- **No surprises** — deliver bad news early, privately first, with options and a recommendation.
- **Status update** — RAG status with trend, decisions needed, risks with owners; readable in 2 minutes.
- **Watermelon reporting** — green outside, red inside; destroys trust.
- **Needs vs solutions** — conflicting requests often share compatible underlying needs.
- **Visible cost of change** — every scope change shown with its impact on date, scope or risk.
- **Technical risk for executives** — impact, likelihood, cost and options, with an explicit decision or risk acceptance.
- **Steering committee** — exists to decide and unblock; pre-reads, recorded decisions, welcomes bad news.
- **Incident comms** — separate comms lead, fixed cadence, templates, segmented audiences.

### Revisit

- **Find hidden stakeholders** — search access logs, integrations and exports; the forgotten consumer is the one that causes the outage.
- **Bad news sequence** — confirm the impact fast, tell the sponsor one to one with options, pre-read, decide, then tell affected teams.
- **BLUF** — bottom line up front: the decision needed and your recommendation in the first sentences.
- **Decision workshops** — agree the output and decision rule before the meeting, and criteria before options.
- **ADKAR** — awareness, desire, knowledge, ability and reinforcement: the stages of individual change (Prosci).
- **Regulators and auditors** — no surprises, one point of contact, evidence by design and tracked remediation.
- **Programme reset** — find the truth, re-baseline with ranges and less scope, shorten milestones, then keep promises.

## Further Reading

- [Atlassian Team Playbook: DACI decision-making framework](https://www.atlassian.com/team-playbook/plays/daci) — a practical template for decision roles.
- [Atlassian Team Playbook: Stakeholder communications](https://www.atlassian.com/team-playbook/plays/stakeholder-communications-plan) — planning communication by stakeholder group.
- [Project Management Institute: PMBOK Guide](https://www.pmi.org/standards/pmbok) — the standard reference for stakeholder engagement in projects.
- [Google SRE Book: Managing Incidents](https://sre.google/sre-book/managing-incidents/) — roles and communication during incidents.
- [GOV.UK Service Manual: Agile delivery governance](https://www.gov.uk/service-manual/agile-delivery/governance-principles-for-agile-service-delivery) — principles for proportionate, decision-focused governance.
