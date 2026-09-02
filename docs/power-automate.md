# Generic Power Automate setup

This guide deliberately uses placeholders. Never commit tenant URLs, mailbox addresses, connection identifiers, or exported flow packages to a public repository.

## Flow 1 — acquire source documents

Trigger: **Office 365 Outlook — When a new email arrives (V3)**.

- Subject filter: a generic keyword chosen for the project.
- Only with attachments: Yes.
- Include attachments: No.

For each attachment:

1. Continue only when the filename ends with `.pdf`.
2. Use **Get attachment (V2)** to download that PDF.
3. Use **SharePoint — Create file** to save it under the selected library's `/automation/in` folder.
4. Prefix the filename with a UTC timestamp to avoid collisions.

Emails without PDFs finish without side effects.

## Flow 2 — deliver generated reports

Trigger: **SharePoint — When a file is created (properties only)**.

- Site: your own site.
- Library: your own document library.
- Folder: `/automation/out`.

Use this expression to validate the report filename:

```text
and(
  startsWith(toLower(triggerOutputs()?['body/{FilenameWithExtension}']), 'tender_summary_'),
  endsWith(toLower(triggerOutputs()?['body/{FilenameWithExtension}']), '.docx')
)
```

In the true branch:

1. Wait briefly for synchronization.
2. Get the file content using `{Identifier}` from the trigger.
3. Send the report with **Office 365 Outlook — Send an email (V2)**.

Keep the false branch empty. Start with a test recipient and add production recipients only after acceptance testing.

## Recommended acceptance tests

- subject keyword with a valid PDF;
- subject keyword with mixed attachment types;
- duplicate source document;
- invalid or unreadable PDF;
- unrelated DOCX created in the output folder;
- restart of the scheduled processing host.
