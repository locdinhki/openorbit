# 13.5: Renderer UI

**Effort:** High | **Status:** Complete

## Background

The Skills Panel is a full-width sidebar view (like ExtensionsPanel and AutomationsPanel) with a Codex-inspired card grid layout. Users can browse, search, install/uninstall shipped skills, and create custom markdown instruction skills via a modal.

## Tasks

### IPC Client
- [ ] Add `skillCatalog` section to `src/renderer/src/lib/ipc-client.ts`:
  ```typescript
  skillCatalog: {
    list: (category?) => api.invoke(IPC.SKILL_CATALOG_LIST, { category }),
    install: (skillId) => api.invoke(IPC.SKILL_CATALOG_INSTALL, { skillId }),
    uninstall: (skillId) => api.invoke(IPC.SKILL_CATALOG_UNINSTALL, { skillId }),
    createCustom: (data) => api.invoke(IPC.SKILL_CUSTOM_CREATE, data),
    updateCustom: (data) => api.invoke(IPC.SKILL_CUSTOM_UPDATE, data),
    deleteCustom: (skillId) => api.invoke(IPC.SKILL_CUSTOM_DELETE, { skillId }),
  }
  ```

### Sidebar Item
- [ ] Add to `src/renderer/src/components/Shell/shell-sidebar-items.ts`:
  ```typescript
  { id: 'shell-skills', label: 'Skills', icon: 'puzzle', priority: 950 }
  ```
  Priority 950 = between Extensions (1000) and Automations (900)

### Shell View Registration
- [ ] Add to `src/renderer/src/App.tsx`:
  ```typescript
  registerShellView('shell-skills', SkillsPanel as never)
  ```

### SvgIcon
- [ ] Add `puzzle` icon to `src/renderer/src/components/shared/SvgIcon.tsx` ICON_MAP

### SkillsPanel Component
- [ ] Create `src/renderer/src/components/Shell/views/SkillsPanel.tsx` (~350 lines)
  - Header: title, refresh button, search input, "+ New" button
  - CategoryTabs: All, Document, Data, Media, Communication, Utility
  - SkillGrid: 2-column CSS grid of SkillCards
  - State: skills list, search query, active category, loading, modal open
  - Fetches skills on mount via `ipc.skillCatalog.list()`
  - Search filters by name and description
  - Category tabs filter by category

### SkillCard Component
- [ ] Create `src/renderer/src/components/Shell/views/SkillCard.tsx` (~80 lines)
  - Icon (SvgIcon, 32px) left
  - Name + description center
  - Action button right:
    - Built-in tool skills → "Built-in" badge (no action)
    - Installed → checkmark button (click to uninstall)
    - Not installed → "+" button (click to install)
    - Custom skills → installed + "Custom" badge, can edit/delete

### CreateSkillModal Component
- [ ] Create `src/renderer/src/components/Shell/views/CreateSkillModal.tsx` (~200 lines)
  - Modal overlay with form fields: name, description, category dropdown, markdown content textarea
  - Content textarea pre-filled with template:
    ```markdown
    ## Workflow
    1. ...

    ## Conventions
    - ...

    ## Dependencies
    - ...

    ## Quality Gates
    - ...
    ```
  - Save calls `ipc.skillCatalog.createCustom()`
  - Reused for editing existing custom skills (pre-filled data)
  - Cancel / ESC to close

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Skills                          ↻ Refresh  Search    + New   │
├──────────────────────────────────────────────────────────────┤
│  [All] [Document] [Data] [Media] [Communication] [Utility]   │
├────────────────────────────┬─────────────────────────────────┤
│  ┌────────────────────┐   │  ┌────────────────────┐         │
│  │ PDF                │   │  │ Calculator         │         │
│  │ Create, edit, and  │   │  │ Evaluate math      │         │
│  │ review PDFs        │   │  │ expressions        │         │
│  │            [+ / ✓] │   │  │         [Built-in] │         │
│  └────────────────────┘   │  └────────────────────┘         │
│  ┌────────────────────┐   │  ┌────────────────────┐         │
│  │ Spreadsheet        │   │  │ Email (SMTP)       │         │
│  │ Create, edit, and  │   │  │ Send emails via    │         │
│  │ analyze sheets     │   │  │ SMTP               │         │
│  │            [+ / ✓] │   │  │            [+ / ✓] │         │
│  └────────────────────┘   │  └────────────────────┘         │
│  ...                      │  ...                             │
└────────────────────────────┴─────────────────────────────────┘
```

## Component Hierarchy

```
SkillsPanel
├── Header (title, refresh, search input, + New button)
├── CategoryTabs (All, Document, Data, Media, Communication, Utility)
├── SkillGrid (2-column CSS grid)
│   └── SkillCard[] (icon, name, description, action button)
└── CreateSkillModal (modal for + New / Edit skill)
    ├── Name input
    ├── Description textarea
    ├── Category select
    ├── Content textarea (markdown)
    └── Save / Cancel buttons
```
