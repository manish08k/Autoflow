# AutoFlow

Production-grade workflow automation platform. Self-hosted, backend-first.
Inspired by n8n, Activepieces, Windmill, and Apache Airflow.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (TLS)                          │
└────────────┬──────────────────────────┬────────────────────┘
             │ /api  /oauth             │ /webhooks
    ┌────────▼────────┐        ┌────────▼────────┐
    │   FastAPI API   │        │  Webhook Router  │
    │  (4 workers)    │        │  (WhatsApp/TG/   │
    └────────┬────────┘        │  Slack/GitHub)   │
             │                 └────────┬────────┘
             │ enqueue                  │ enqueue
    ┌────────▼──────────────────────────▼────────┐
    │              Redis (Celery broker)          │
    └────────┬────────────────────────────────────┘
             │
    ┌────────▼─────────────────────────────────────┐
    │              Celery Workers                   │
    │  Queue: workflows  → execute_workflow()       │
    │  Queue: polling    → poll triggers every 60s  │
    │  Queue: maintenance→ token refresh, cleanup   │
    └────────┬─────────────────────────────────────┘
             │
    ┌────────▼──────────┐    ┌─────────────────────┐
    │    PostgreSQL      │    │   APScheduler        │
    │  (all state)       │    │  (cron / interval)   │
    └───────────────────┘    └─────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set APP_SECRET_KEY, CREDENTIAL_ENCRYPTION_KEY,
# and at minimum one OAuth provider's client_id + client_secret

# Generate keys:
make keygen

# 2. Start everything
make up

# 3. Create your first user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword"}'

# 4. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 5. Connect Google (opens browser OAuth consent)
open "http://localhost:8000/oauth/connect/google?label=My%20Google"

# 6. List connected credentials
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/credentials
```

---

## OAuth Flow (user perspective)

Every provider follows the same pattern:

1. **User clicks Connect** → frontend calls `GET /oauth/connect/{provider}?label=My Account`
2. **AutoFlow redirects** user to the provider's OAuth consent screen
3. **User approves** → provider redirects to `GET /oauth/callback/{provider}?code=...&state=...`
4. **AutoFlow exchanges** the code for tokens, encrypts them (AES-256-GCM), stores in DB
5. **Credential appears** in `/api/credentials` — ready to use in workflows

Token refresh is automatic. Credentials are referenced by ID in workflow nodes.

---

## Supported Providers

| Provider   | OAuth | Polling | Webhooks | Node Types |
|------------|-------|---------|----------|------------|
| Google     | ✅    | ✅      | —        | Sheets, Gmail, Drive, Calendar |
| Slack      | ✅    | ✅      | ✅       | Send msg, DM, channel ops |
| GitHub     | ✅    | ✅      | ✅       | Issues, PRs, files, releases |
| Notion     | ✅    | ✅      | —        | DB query, pages, blocks |
| Discord    | ✅    | ✅      | —        | Messages, roles, channels |
| HubSpot    | ✅    | ✅      | —        | Contacts, deals, notes |
| Airtable   | ✅    | ✅      | —        | Records CRUD |
| WhatsApp   | —     | —       | ✅       | Text, template, media, interactive |
| Telegram   | —     | —       | ✅       | Messages, polls, keyboards |

---

## Workflow Definition Format

```json
{
  "nodes": [
    {
      "id": "trigger",
      "type": "sheets.read_rows",
      "credential_id": "cred-uuid-here",
      "config": {
        "spreadsheet_id": "1BxiMVs0XRA...",
        "range": "Sheet1"
      },
      "retry": { "max_attempts": 3, "wait_min": 2, "wait_max": 30 }
    },
    {
      "id": "filter",
      "type": "core.filter",
      "config": {
        "field": "status",
        "operator": "equals",
        "value": "pending"
      }
    },
    {
      "id": "notify",
      "type": "slack.send_message",
      "credential_id": "slack-cred-uuid",
      "config": {
        "channel": "#alerts",
        "text": "New pending rows found!"
      }
    }
  ],
  "edges": [
    { "source": "trigger", "target": "filter" },
    { "source": "filter",  "target": "notify" }
  ]
}
```

---

## Trigger Types

### 1. Webhook Trigger
```bash
# Create a webhook trigger
curl -X POST http://localhost:8000/api/triggers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf-uuid",
    "trigger_type": "webhook",
    "provider": "generic",
    "event": "inbound"
  }'
# Response includes webhook_url and webhook_secret
```

### 2. Schedule Trigger (Cron)
```bash
curl -X POST http://localhost:8000/api/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf-uuid",
    "cron_expression": "0 9 * * 1-5",
    "timezone": "Asia/Kolkata"
  }'
```

### 3. Schedule Trigger (Interval)
```bash
curl -X POST http://localhost:8000/api/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf-uuid",
    "interval_seconds": 300
  }'
```

### 4. Polling Trigger
```bash
curl -X POST http://localhost:8000/api/triggers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf-uuid",
    "trigger_type": "polling",
    "provider": "gmail",
    "event": "new_email",
    "credential_id": "google-cred-uuid",
    "config": { "query": "is:unread from:boss@company.com" }
  }'
```

---

## Example: WhatsApp → Google Sheets workflow

```json
{
  "nodes": [
    {
      "id": "parse",
      "type": "core.transform",
      "config": {
        "mapping": {
          "phone": "{{from}}",
          "message": "{{text}}",
          "time": "{{timestamp}}"
        }
      }
    },
    {
      "id": "log_to_sheet",
      "type": "sheets.append_row",
      "credential_id": "google-cred-uuid",
      "config": {
        "spreadsheet_id": "YOUR_SHEET_ID",
        "range": "Messages!A:C"
      }
    },
    {
      "id": "reply",
      "type": "whatsapp.send_text",
      "config": {
        "text": "Thanks! Your message was logged."
      }
    }
  ],
  "edges": [
    { "source": "parse",        "target": "log_to_sheet" },
    { "source": "log_to_sheet", "target": "reply" }
  ]
}
```

---

## Available Node Types

### Core
- `http.request` — any HTTP call
- `core.filter` — filter items by condition
- `core.transform` — reshape data with field mapping
- `core.set_variables` — inject static values
- `core.merge` — merge multiple inputs
- `core.split_in_batches` — iterate over lists
- `core.delay` — sleep N seconds
- `core.condition` — branch true/false
- `core.run_code` — execute Python snippet
- `core.send_email_smtp` — SMTP email
- `core.format_date` — date formatting/timezone
- `core.json_parse` / `core.xml_parse`
- `core.respond_to_webhook`

### Google
- `sheets.read_rows`, `sheets.append_row`, `sheets.update_row`, `sheets.clear_range`, `sheets.create_spreadsheet`, `sheets.batch_update`
- `gmail.send_email`, `gmail.get_emails`, `gmail.reply_email`, `gmail.add_label`, `gmail.mark_read`, `gmail.get_thread`
- `drive.list_files`, `drive.upload_file`, `drive.download_file`, `drive.create_folder`, `drive.move_file`, `drive.share_file`, `drive.delete_file`
- `calendar.create_event`, `calendar.list_events`, `calendar.update_event`, `calendar.delete_event`, `calendar.quick_add`

### Slack
- `slack.send_message`, `slack.send_dm`, `slack.get_messages`, `slack.create_channel`, `slack.invite_to_channel`, `slack.upload_file`, `slack.add_reaction`, `slack.get_user_info`

### WhatsApp
- `whatsapp.send_text`, `whatsapp.send_template`, `whatsapp.send_image`, `whatsapp.send_document`, `whatsapp.send_interactive`, `whatsapp.mark_read`

### Telegram
- `telegram.send_message`, `telegram.send_photo`, `telegram.send_document`, `telegram.send_poll`, `telegram.edit_message`, `telegram.delete_message`, `telegram.pin_message`, `telegram.get_chat_info`, `telegram.send_inline_keyboard`

### GitHub
- `github.create_issue`, `github.close_issue`, `github.add_comment`, `github.create_pr`, `github.merge_pr`, `github.get_file`, `github.create_or_update_file`, `github.create_release`, `github.list_repos`, `github.trigger_workflow`

### Notion
- `notion.query_database`, `notion.create_page`, `notion.update_page`, `notion.get_page`, `notion.append_blocks`, `notion.search`, `notion.list_databases`

### Discord
- `discord.send_message`, `discord.send_embed`, `discord.edit_message`, `discord.delete_message`, `discord.add_reaction`, `discord.create_channel`, `discord.assign_role`, `discord.kick_member`, `discord.get_guild_members`

### Airtable
- `airtable.list_records`, `airtable.create_record`, `airtable.update_record`, `airtable.delete_record`, `airtable.upsert_record`, `airtable.list_bases`, `airtable.get_table_schema`

### HubSpot
- `hubspot.create_contact`, `hubspot.update_contact`, `hubspot.get_contact`, `hubspot.create_deal`, `hubspot.update_deal`, `hubspot.search_contacts`, `hubspot.create_note`, `hubspot.send_email`

---

## Monitoring

- **Flower** (Celery): `http://localhost:5555`
- **Prometheus**: `http://localhost:8000/metrics`
- **API Docs**: `http://localhost:8000/api/docs`

---

## Adding a New Integration

1. Create `integrations/myprovider/handler.py`
2. Decorate node functions with `@register_node("myprovider.action")`
3. Decorate polling functions with `@register_poller("myprovider", "event")`
4. Add OAuth config to `oauth/providers.py` (if OAuth)
5. Import the handler in `main.py`

That's it — no other changes needed.
