export interface NodeDef {
  type: string
  label: string
  category: string
  provider: string
  color: string
  description: string
  configFields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'json'
  required?: boolean
  options?: string[]
  placeholder?: string
}

export const PROVIDER_COLORS: Record<string, string> = {
  core: '#6366f1',
  slack: '#4a154b',
  google: '#4285f4',
  gmail: '#ea4335',
  sheets: '#34a853',
  drive: '#4285f4',
  calendar: '#1967d2',
  whatsapp: '#25d366',
  telegram: '#2aabee',
  github: '#24292e',
  notion: '#000000',
  discord: '#5865f2',
  airtable: '#f82b60',
  hubspot: '#ff7a59',
  http: '#10b981',
  ai: '#8b5cf6',
}

export const NODE_CATALOG: NodeDef[] = [
  // ── AI ───────────────────────────────────────────────────────────────────────
  { type: 'ai.chat', label: 'AI Chat', category: 'AI', provider: 'ai', color: '#8b5cf6', description: 'Prompt an LLM (Claude / GPT)', configFields: [
    { key: 'provider', label: 'Provider', type: 'select', options: ['auto', 'anthropic', 'openai'] },
    { key: 'model', label: 'Model (optional)', type: 'text', placeholder: 'claude-sonnet-4-6' },
    { key: 'system_prompt', label: 'System Prompt', type: 'textarea' },
    { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, placeholder: 'Summarize this email: {{body}}' },
    { key: 'max_tokens', label: 'Max Tokens', type: 'number' },
    { key: 'temperature', label: 'Temperature', type: 'number' },
  ] },
  { type: 'ai.extract', label: 'AI Extract / Classify', category: 'AI', provider: 'ai', color: '#8b5cf6', description: 'Extract structured JSON from text', configFields: [
    { key: 'provider', label: 'Provider', type: 'select', options: ['auto', 'anthropic', 'openai'] },
    { key: 'model', label: 'Model (optional)', type: 'text', placeholder: 'claude-sonnet-4-6' },
    { key: 'text', label: 'Input Text (optional, supports {{field}})', type: 'textarea', placeholder: '{{body}}' },
    { key: 'schema_description', label: 'Fields to Extract', type: 'textarea', required: true, placeholder: "category: one of 'sales','support','spam'; urgency: 1-5; summary: string" },
    { key: 'max_tokens', label: 'Max Tokens', type: 'number' },
  ] },

  // ── Triggers ────────────────────────────────────────────────────────────────
  { type: 'trigger.manual', label: 'Manual Trigger', category: 'Triggers', provider: 'core', color: '#6366f1', description: 'Start workflow manually', configFields: [] },
  { type: 'trigger.webhook', label: 'Webhook', category: 'Triggers', provider: 'core', color: '#6366f1', description: 'Trigger on HTTP request', configFields: [{ key: 'method', label: 'Method', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH'] }] },
  { type: 'trigger.schedule', label: 'Schedule', category: 'Triggers', provider: 'core', color: '#6366f1', description: 'Cron or interval trigger', configFields: [{ key: 'cron_expression', label: 'Cron', type: 'text', placeholder: '0 9 * * 1-5' }, { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'UTC' }] },

  // ── Core ────────────────────────────────────────────────────────────────────
  { type: 'http.request', label: 'HTTP Request', category: 'Core', provider: 'http', color: '#10b981', description: 'Make any HTTP call', configFields: [{ key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], required: true }, { key: 'url', label: 'URL', type: 'text', required: true }, { key: 'headers', label: 'Headers (JSON)', type: 'json' }, { key: 'body', label: 'Body (JSON)', type: 'json' }] },
  { type: 'core.filter', label: 'Filter', category: 'Core', provider: 'core', color: '#6366f1', description: 'Filter items by condition', configFields: [{ key: 'field', label: 'Field', type: 'text', required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty', 'regex'], required: true }, { key: 'value', label: 'Value', type: 'text' }] },
  { type: 'core.transform', label: 'Transform', category: 'Core', provider: 'core', color: '#6366f1', description: 'Reshape data with mapping', configFields: [{ key: 'mapping', label: 'Mapping (JSON)', type: 'json', required: true }] },
  { type: 'core.set_variables', label: 'Set Variables', category: 'Core', provider: 'core', color: '#6366f1', description: 'Inject static values', configFields: [{ key: 'variables', label: 'Variables (JSON)', type: 'json', required: true }] },
  { type: 'core.condition', label: 'Condition', category: 'Core', provider: 'core', color: '#6366f1', description: 'Branch true/false', configFields: [{ key: 'field', label: 'Field', type: 'text', required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_true', 'is_false', 'regex'], required: true }, { key: 'value', label: 'Value', type: 'text' }] },
  { type: 'core.delay', label: 'Delay', category: 'Core', provider: 'core', color: '#6366f1', description: 'Wait N seconds', configFields: [{ key: 'seconds', label: 'Seconds', type: 'number', required: true }] },
  { type: 'core.merge', label: 'Merge', category: 'Core', provider: 'core', color: '#6366f1', description: 'Merge multiple inputs', configFields: [{ key: 'mode', label: 'Mode', type: 'select', options: ['merge', 'append', 'zip'] }] },
  { type: 'core.split_in_batches', label: 'Split Batches', category: 'Core', provider: 'core', color: '#6366f1', description: 'Iterate over list', configFields: [{ key: 'batch_size', label: 'Batch Size', type: 'number', required: true }] },
  { type: 'core.run_code', label: 'Run Code', category: 'Core', provider: 'core', color: '#6366f1', description: 'Execute Python snippet', configFields: [{ key: 'code', label: 'Python Code', type: 'textarea', required: true }] },
  { type: 'core.format_date', label: 'Format Date', category: 'Core', provider: 'core', color: '#6366f1', description: 'Format / convert dates', configFields: [{ key: 'output_format', label: 'Output Format', type: 'text', placeholder: 'YYYY-MM-DD HH:mm:ss' }, { key: 'output_timezone', label: 'Output Timezone', type: 'text', placeholder: 'Asia/Kolkata' }] },
  { type: 'core.json_parse', label: 'JSON Parse', category: 'Core', provider: 'core', color: '#6366f1', description: 'Parse JSON string', configFields: [{ key: 'json_string', label: 'JSON String', type: 'textarea' }] },
  { type: 'core.send_email_smtp', label: 'Send Email', category: 'Core', provider: 'core', color: '#6366f1', description: 'Send via SMTP', configFields: [{ key: 'to', label: 'To', type: 'text', required: true }, { key: 'subject', label: 'Subject', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'textarea', required: true }, { key: 'html', label: 'HTML?', type: 'boolean' }] },

  // ── Slack ───────────────────────────────────────────────────────────────────
  { type: 'slack.send_message', label: 'Send Message', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'Post to a channel', configFields: [{ key: 'channel', label: 'Channel', type: 'text', required: true, placeholder: '#general' }, { key: 'text', label: 'Text', type: 'textarea', required: true }] },
  { type: 'slack.send_dm', label: 'Send DM', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'Direct message a user', configFields: [{ key: 'user_email', label: 'User Email', type: 'text', required: true }, { key: 'text', label: 'Text', type: 'textarea', required: true }] },
  { type: 'slack.get_messages', label: 'Get Messages', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'Read channel history', configFields: [{ key: 'channel', label: 'Channel', type: 'text', required: true }, { key: 'limit', label: 'Limit', type: 'number' }] },
  { type: 'slack.create_channel', label: 'Create Channel', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'Create a channel', configFields: [{ key: 'name', label: 'Channel Name', type: 'text', required: true }, { key: 'is_private', label: 'Private?', type: 'boolean' }] },
  { type: 'slack.upload_file', label: 'Upload File', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'Upload file to channel', configFields: [{ key: 'channel', label: 'Channel', type: 'text', required: true }, { key: 'content', label: 'Content', type: 'textarea', required: true }, { key: 'filename', label: 'Filename', type: 'text' }] },
  { type: 'slack.add_reaction', label: 'Add Reaction', category: 'Slack', provider: 'slack', color: '#4a154b', description: 'React to a message', configFields: [{ key: 'channel', label: 'Channel', type: 'text', required: true }, { key: 'ts', label: 'Message TS', type: 'text', required: true }, { key: 'reaction', label: 'Emoji', type: 'text', placeholder: 'white_check_mark' }] },

  // ── Google Sheets ───────────────────────────────────────────────────────────
  { type: 'sheets.read_rows', label: 'Read Rows', category: 'Google Sheets', provider: 'sheets', color: '#34a853', description: 'Read spreadsheet rows', configFields: [{ key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', required: true }, { key: 'range', label: 'Range', type: 'text', placeholder: 'Sheet1' }] },
  { type: 'sheets.append_row', label: 'Append Row', category: 'Google Sheets', provider: 'sheets', color: '#34a853', description: 'Append a row', configFields: [{ key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', required: true }, { key: 'range', label: 'Range', type: 'text', placeholder: 'Sheet1' }, { key: 'row', label: 'Row Data (JSON)', type: 'json', required: true }] },
  { type: 'sheets.update_row', label: 'Update Row', category: 'Google Sheets', provider: 'sheets', color: '#34a853', description: 'Update a specific range', configFields: [{ key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', required: true }, { key: 'range', label: 'Range', type: 'text', required: true }, { key: 'row', label: 'Row Data (JSON)', type: 'json', required: true }] },
  { type: 'sheets.create_spreadsheet', label: 'Create Sheet', category: 'Google Sheets', provider: 'sheets', color: '#34a853', description: 'Create a spreadsheet', configFields: [{ key: 'title', label: 'Title', type: 'text', required: true }] },

  // ── Gmail ───────────────────────────────────────────────────────────────────
  { type: 'gmail.send_email', label: 'Send Email', category: 'Gmail', provider: 'gmail', color: '#ea4335', description: 'Send via Gmail', configFields: [{ key: 'to', label: 'To', type: 'text', required: true }, { key: 'subject', label: 'Subject', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'textarea', required: true }, { key: 'html', label: 'HTML?', type: 'boolean' }, { key: 'cc', label: 'CC', type: 'text' }, { key: 'bcc', label: 'BCC', type: 'text' }] },
  { type: 'gmail.get_emails', label: 'Get Emails', category: 'Gmail', provider: 'gmail', color: '#ea4335', description: 'Fetch emails', configFields: [{ key: 'query', label: 'Query', type: 'text', placeholder: 'is:unread' }, { key: 'max_results', label: 'Max Results', type: 'number' }] },
  { type: 'gmail.reply_email', label: 'Reply Email', category: 'Gmail', provider: 'gmail', color: '#ea4335', description: 'Reply to a thread', configFields: [{ key: 'thread_id', label: 'Thread ID', type: 'text', required: true }, { key: 'to', label: 'To', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'textarea', required: true }] },

  // ── Google Drive ────────────────────────────────────────────────────────────
  { type: 'drive.list_files', label: 'List Files', category: 'Google Drive', provider: 'drive', color: '#4285f4', description: 'List drive files', configFields: [{ key: 'folder_id', label: 'Folder ID', type: 'text' }, { key: 'query', label: 'Query', type: 'text' }] },
  { type: 'drive.upload_file', label: 'Upload File', category: 'Google Drive', provider: 'drive', color: '#4285f4', description: 'Upload to drive', configFields: [{ key: 'name', label: 'Filename', type: 'text', required: true }, { key: 'content', label: 'Content', type: 'textarea', required: true }, { key: 'mime_type', label: 'MIME Type', type: 'text', placeholder: 'text/plain' }, { key: 'folder_id', label: 'Folder ID', type: 'text' }] },
  { type: 'drive.create_folder', label: 'Create Folder', category: 'Google Drive', provider: 'drive', color: '#4285f4', description: 'Create a folder', configFields: [{ key: 'name', label: 'Folder Name', type: 'text', required: true }, { key: 'parent_id', label: 'Parent Folder ID', type: 'text' }] },

  // ── Google Calendar ─────────────────────────────────────────────────────────
  { type: 'calendar.create_event', label: 'Create Event', category: 'Google Calendar', provider: 'calendar', color: '#1967d2', description: 'Create calendar event', configFields: [{ key: 'summary', label: 'Title', type: 'text', required: true }, { key: 'start', label: 'Start (ISO)', type: 'text', required: true }, { key: 'end', label: 'End (ISO)', type: 'text', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'UTC' }] },
  { type: 'calendar.list_events', label: 'List Events', category: 'Google Calendar', provider: 'calendar', color: '#1967d2', description: 'List events', configFields: [{ key: 'time_min', label: 'From (ISO)', type: 'text' }, { key: 'max_results', label: 'Max Results', type: 'number' }] },
  { type: 'calendar.delete_event', label: 'Delete Event', category: 'Google Calendar', provider: 'calendar', color: '#1967d2', description: 'Delete a calendar event', configFields: [{ key: 'event_id', label: 'Event ID', type: 'text', required: true }] },

  // ── WhatsApp ────────────────────────────────────────────────────────────────
  { type: 'whatsapp.send_text', label: 'Send Text', category: 'WhatsApp', provider: 'whatsapp', color: '#25d366', description: 'Send WA text message', configFields: [{ key: 'to', label: 'To (E.164)', type: 'text', required: true, placeholder: '+919999999999' }, { key: 'text', label: 'Message', type: 'textarea', required: true }] },
  { type: 'whatsapp.send_template', label: 'Send Template', category: 'WhatsApp', provider: 'whatsapp', color: '#25d366', description: 'Send approved template', configFields: [{ key: 'to', label: 'To', type: 'text', required: true }, { key: 'template_name', label: 'Template Name', type: 'text', required: true }, { key: 'language_code', label: 'Language', type: 'text', placeholder: 'en_US' }] },
  { type: 'whatsapp.send_image', label: 'Send Image', category: 'WhatsApp', provider: 'whatsapp', color: '#25d366', description: 'Send image message', configFields: [{ key: 'to', label: 'To', type: 'text', required: true }, { key: 'image_url', label: 'Image URL', type: 'text', required: true }, { key: 'caption', label: 'Caption', type: 'text' }] },
  { type: 'whatsapp.mark_read', label: 'Mark Read', category: 'WhatsApp', provider: 'whatsapp', color: '#25d366', description: 'Mark message as read', configFields: [{ key: 'message_id', label: 'Message ID', type: 'text', required: true }] },

  // ── Telegram ────────────────────────────────────────────────────────────────
  { type: 'telegram.send_message', label: 'Send Message', category: 'Telegram', provider: 'telegram', color: '#2aabee', description: 'Send TG message', configFields: [{ key: 'chat_id', label: 'Chat ID', type: 'text', required: true }, { key: 'text', label: 'Text', type: 'textarea', required: true }, { key: 'parse_mode', label: 'Parse Mode', type: 'select', options: ['HTML', 'Markdown', 'MarkdownV2'] }] },
  { type: 'telegram.send_photo', label: 'Send Photo', category: 'Telegram', provider: 'telegram', color: '#2aabee', description: 'Send a photo', configFields: [{ key: 'chat_id', label: 'Chat ID', type: 'text', required: true }, { key: 'photo', label: 'Photo URL / file_id', type: 'text', required: true }, { key: 'caption', label: 'Caption', type: 'text' }] },
  { type: 'telegram.send_poll', label: 'Send Poll', category: 'Telegram', provider: 'telegram', color: '#2aabee', description: 'Create a poll', configFields: [{ key: 'chat_id', label: 'Chat ID', type: 'text', required: true }, { key: 'question', label: 'Question', type: 'text', required: true }, { key: 'options', label: 'Options (JSON array)', type: 'json', required: true }] },

  // ── GitHub ──────────────────────────────────────────────────────────────────
  { type: 'github.create_issue', label: 'Create Issue', category: 'GitHub', provider: 'github', color: '#24292e', description: 'Open a GitHub issue', configFields: [{ key: 'repo', label: 'Repo (owner/repo)', type: 'text', required: true }, { key: 'title', label: 'Title', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'textarea' }] },
  { type: 'github.add_comment', label: 'Add Comment', category: 'GitHub', provider: 'github', color: '#24292e', description: 'Comment on issue/PR', configFields: [{ key: 'repo', label: 'Repo', type: 'text', required: true }, { key: 'issue_number', label: 'Issue #', type: 'number', required: true }, { key: 'body', label: 'Comment', type: 'textarea', required: true }] },
  { type: 'github.create_pr', label: 'Create PR', category: 'GitHub', provider: 'github', color: '#24292e', description: 'Open a pull request', configFields: [{ key: 'repo', label: 'Repo', type: 'text', required: true }, { key: 'title', label: 'Title', type: 'text', required: true }, { key: 'head', label: 'Head Branch', type: 'text', required: true }, { key: 'base', label: 'Base Branch', type: 'text', placeholder: 'main' }] },
  { type: 'github.create_release', label: 'Create Release', category: 'GitHub', provider: 'github', color: '#24292e', description: 'Create a release', configFields: [{ key: 'repo', label: 'Repo', type: 'text', required: true }, { key: 'tag_name', label: 'Tag', type: 'text', required: true }, { key: 'name', label: 'Name', type: 'text' }, { key: 'body', label: 'Notes', type: 'textarea' }] },

  // ── Notion ──────────────────────────────────────────────────────────────────
  { type: 'notion.query_database', label: 'Query Database', category: 'Notion', provider: 'notion', color: '#000000', description: 'Query a Notion DB', configFields: [{ key: 'database_id', label: 'Database ID', type: 'text', required: true }, { key: 'filter', label: 'Filter (JSON)', type: 'json' }, { key: 'page_size', label: 'Limit', type: 'number' }] },
  { type: 'notion.create_page', label: 'Create Page', category: 'Notion', provider: 'notion', color: '#000000', description: 'Create a Notion page', configFields: [{ key: 'parent_id', label: 'Parent DB/Page ID', type: 'text', required: true }, { key: 'parent_type', label: 'Parent Type', type: 'select', options: ['database_id', 'page_id'] }, { key: 'properties', label: 'Properties (JSON)', type: 'json', required: true }] },
  { type: 'notion.update_page', label: 'Update Page', category: 'Notion', provider: 'notion', color: '#000000', description: 'Update a page', configFields: [{ key: 'page_id', label: 'Page ID', type: 'text', required: true }, { key: 'properties', label: 'Properties (JSON)', type: 'json', required: true }] },
  { type: 'notion.search', label: 'Search', category: 'Notion', provider: 'notion', color: '#000000', description: 'Search Notion', configFields: [{ key: 'query', label: 'Query', type: 'text', required: true }] },

  // ── Discord ─────────────────────────────────────────────────────────────────
  { type: 'discord.send_message', label: 'Send Message', category: 'Discord', provider: 'discord', color: '#5865f2', description: 'Post to channel', configFields: [{ key: 'channel_id', label: 'Channel ID', type: 'text', required: true }, { key: 'content', label: 'Content', type: 'textarea', required: true }] },
  { type: 'discord.send_embed', label: 'Send Embed', category: 'Discord', provider: 'discord', color: '#5865f2', description: 'Send embed card', configFields: [{ key: 'channel_id', label: 'Channel ID', type: 'text', required: true }, { key: 'title', label: 'Title', type: 'text', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'color', label: 'Color (hex int)', type: 'number' }] },
  { type: 'discord.assign_role', label: 'Assign Role', category: 'Discord', provider: 'discord', color: '#5865f2', description: 'Assign a role', configFields: [{ key: 'guild_id', label: 'Guild ID', type: 'text', required: true }, { key: 'user_id', label: 'User ID', type: 'text', required: true }, { key: 'role_id', label: 'Role ID', type: 'text', required: true }] },

  // ── Airtable ────────────────────────────────────────────────────────────────
  { type: 'airtable.list_records', label: 'List Records', category: 'Airtable', provider: 'airtable', color: '#f82b60', description: 'List table records', configFields: [{ key: 'base_id', label: 'Base ID', type: 'text', required: true }, { key: 'table', label: 'Table', type: 'text', required: true }, { key: 'filter_formula', label: 'Filter Formula', type: 'text' }, { key: 'max_records', label: 'Max Records', type: 'number' }] },
  { type: 'airtable.create_record', label: 'Create Record', category: 'Airtable', provider: 'airtable', color: '#f82b60', description: 'Create a record', configFields: [{ key: 'base_id', label: 'Base ID', type: 'text', required: true }, { key: 'table', label: 'Table', type: 'text', required: true }, { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true }] },
  { type: 'airtable.update_record', label: 'Update Record', category: 'Airtable', provider: 'airtable', color: '#f82b60', description: 'Update a record', configFields: [{ key: 'base_id', label: 'Base ID', type: 'text', required: true }, { key: 'table', label: 'Table', type: 'text', required: true }, { key: 'record_id', label: 'Record ID', type: 'text', required: true }, { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true }] },
  { type: 'airtable.upsert_record', label: 'Upsert Record', category: 'Airtable', provider: 'airtable', color: '#f82b60', description: 'Create or update', configFields: [{ key: 'base_id', label: 'Base ID', type: 'text', required: true }, { key: 'table', label: 'Table', type: 'text', required: true }, { key: 'fields', label: 'Fields (JSON)', type: 'json', required: true }, { key: 'fields_to_merge_on', label: 'Match Fields (JSON)', type: 'json' }] },

  // ── HubSpot ─────────────────────────────────────────────────────────────────
  { type: 'hubspot.create_contact', label: 'Create Contact', category: 'HubSpot', provider: 'hubspot', color: '#ff7a59', description: 'Create CRM contact', configFields: [{ key: 'properties', label: 'Properties (JSON)', type: 'json', required: true }] },
  { type: 'hubspot.update_contact', label: 'Update Contact', category: 'HubSpot', provider: 'hubspot', color: '#ff7a59', description: 'Update a contact', configFields: [{ key: 'contact_id', label: 'Contact ID', type: 'text', required: true }, { key: 'properties', label: 'Properties (JSON)', type: 'json', required: true }] },
  { type: 'hubspot.create_deal', label: 'Create Deal', category: 'HubSpot', provider: 'hubspot', color: '#ff7a59', description: 'Create a deal', configFields: [{ key: 'properties', label: 'Properties (JSON)', type: 'json', required: true }] },
  { type: 'hubspot.search_contacts', label: 'Search Contacts', category: 'HubSpot', provider: 'hubspot', color: '#ff7a59', description: 'Search CRM contacts', configFields: [{ key: 'filters', label: 'Filters (JSON)', type: 'json', required: true }] },
]

export const CATEGORIES = [...new Set(NODE_CATALOG.map(n => n.category))]

export function getNodeDef(type: string): NodeDef | undefined {
  return NODE_CATALOG.find(n => n.type === type)
}