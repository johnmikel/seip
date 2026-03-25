# seip — Schema Evolution Intent Protocol

**Stop breaking downstream teams with undeclared schema changes.**

SEIP is a CLI tool that adds a "pull request" workflow for schema changes. Before you rename a column or drop a field, you declare the intent, affected consumers respond, and CI enforces that no breaking change ships without a declaration.

Zero dependencies. Zero config. Zero servers. JSON files in git.

## 30-second setup

```bash
npx seip init                                    # creates .seip/ directory
npx seip diff schema-v1.json schema-v2.json       # detect breaking changes
npx seip create --id scd_rename_org \
  --summary "Rename org field" \
  --breaking --strategy dual_write \
  --consumer analytics --consumer search          # create declaration
npx seip propose scd_rename_org                   # mark as ready for review
npx seip validate schema-v1.json schema-v2.json   # CI gate (exit 1 if undeclared)
```

## What it does

```
Producer                    SEIP                     Consumers
────────                    ────                     ─────────
                          ┌────────┐
seip diff ───────────────▶│ Detect │
                          └───┬────┘
seip create ─────────────▶│ DRAFT  │
                          └───┬────┘
seip propose ────────────▶│PROPOSED│──────────▶ Consumers review
                          └───┬────┘
                    ┌─────────┼─────────┐
                    │         │         │
              ACKNOWLEDGE   OBJECT   EXTEND
                    │         │         │
                    └─────────┼─────────┘
                         ACCEPTED
                              │
              seip validate ──┘──────────▶ CI passes ✓
```

## CI/CD integration

**GitHub Actions:**
```yaml
- name: Check for undeclared breaking changes
  run: npx seip validate schema-before.json schema-after.json
```

Build fails if any breaking change has no declaration. That's it.

## Commands

| Command | What it does |
|---------|-------------|
| `seip init` | Set up `.seip/` in your repo |
| `seip diff <before> <after>` | Compare two schema JSON files |
| `seip create [opts]` | Create a new declaration |
| `seip propose <id>` | Publish for consumer review |
| `seip respond <id> --team <t>` | Consumer responds |
| `seip status [id]` | Show declaration status |
| `seip validate <before> <after>` | CI gate — exit 1 if undeclared |

## How orgs adopt this

**Week 1 — single team, no buy-in needed:**
```bash
npx seip init
# Add to your CI pipeline:
npx seip validate schema-old.json schema-new.json
```
You now can't ship undeclared breaking changes. Just you, no downstream teams involved yet.

**Week 2 — add consumers:**
When you have a schema change, create a declaration with `--consumer analytics --consumer search`. The JSON file in `.seip/declarations/` serves as structured documentation — way better than a Slack message.

**Week 3 — consumers respond:**
Downstream teams run `seip status` to see pending changes, then `seip respond` to acknowledge or object. The JSON file tracks the negotiation.

**Month 2 — it's just how you do things:**
Nobody mandated it. It just works better than Slack threads.

## Schema format

SEIP reads simple JSON. Works with any schema source:

```json
{
  "objects": [
    {
      "name": "transactions",
      "properties": [
        { "name": "user_id", "type": "string", "required": true },
        { "name": "amount", "type": "integer", "required": true }
      ]
    }
  ]
}
```

Export from BigQuery, Postgres, dbt, Protobuf, OpenAPI — as long as it has `objects[].properties[]` with `name` and `type`, SEIP can diff it.

## Run the demo

```bash
git clone https://github.com/jmregida/seip.git
cd seip
node examples/full-workflow.mjs
```

Runs the full GOV.UK Publishing Platform scenario end to end.

## License

Apache-2.0
