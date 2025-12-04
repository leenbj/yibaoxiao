# AGENTS.md
所有的对话必须使用中文
> AI Development Guide for Motia Projects

This file provides context and instructions for AI coding assistants working on Motia projects.

## Project Overview

This is a **Motia** application - a framework for building event-driven, type-safe backend systems with:
- HTTP API endpoints (API Steps)
- Background event processing (Event Steps)  
- Scheduled tasks (Cron Steps)
- Real-time streaming capabilities
- Built-in state management
- Visual workflow designer (Workbench)

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate TypeScript types from steps
npx motia generate-types
```

## 📚 Comprehensive Guides

**This project includes detailed Cursor rules in `.cursor/rules/` that contain comprehensive patterns and examples.**

These guides are written in markdown and can be read by any AI coding tool. The sections below provide quick reference, but **always consult the detailed guides in `.cursor/` for complete patterns and examples.**

### Available Guides

Read these files in `.cursor/rules/motia/` for detailed patterns:

- **`api-steps.mdc`** - Creating HTTP endpoints with schemas, validation, and middleware
- **`event-steps.mdc`** - Background task processing and event-driven workflows
- **`cron-steps.mdc`** - Scheduled tasks with cron expressions
- **`state-management.mdc`** - State/cache management across steps
- **`middlewares.mdc`** - Request/response middleware patterns
- **`realtime-streaming.mdc`** - WebSocket and SSE patterns
- **`virtual-steps.mdc`** - Visual flow connections in Workbench
- **`ui-steps.mdc`** - Custom visual components for Workbench

Architecture guides in `.cursor/architecture/`:

- **`architecture.mdc`** - Project structure, naming conventions, DDD patterns
- **`error-handling.mdc`** - Error handling best practices

**Read these guides before writing code.** They contain complete examples, type definitions, and best practices.

## Quick Reference

> **⚠️ Important**: The sections below are brief summaries. **Always read the full guides in `.cursor/rules/` for complete patterns, examples, and type definitions.**

### Project Structure

```
project/
├── .cursor/rules/   # DETAILED GUIDES - Read these first!
├── steps/           # All step definitions
│   ├── api/        # API endpoints
│   │   └── api.step.ts
│   │   └── api.step.js
│   │   └── api_step.py
│   ├── events/     # Events
│   │   └── events.step.ts
│   │   └── events.step.js
│   │   └── events_step.py
│   └── cron/       # Scheduled tasks
│   │   └── cron.step.ts
│   │   └── cron.step.js
│   │   └── cron_step.py
├── middlewares/    # Reusable middleware
│   └── middleware.middleware.ts
├── src/
│   ├── services/   # Business logic
│   └── utils/      # Utilities
├── config.yml      # Motia configuration
└── types.d.ts      # Auto-generated types
```

### Step Naming Conventions

**TypeScript/JavaScript:** `my-step.step.ts` (kebab-case)  
**Python:** `my_step_step.py` (snake_case)

See `.cursor/architecture/architecture.mdc` for complete naming rules.

### Creating Steps - Quick Start

Every step needs two exports:

1. **`config`** - Defines type, routing, schemas, emits
2. **`handler`** - Async function with processing logic

**For complete examples and type definitions, read:**
- `.cursor/rules/motia/api-steps.mdc` - HTTP endpoints
- `.cursor/rules/motia/event-steps.mdc` - Background tasks
- `.cursor/rules/motia/cron-steps.mdc` - Scheduled tasks

## Detailed Guides by Topic

> **📖 Read the cursor rules for complete information**

### Step Types
- **API Steps** → Read `.cursor/rules/motia/api-steps.mdc`
  - HTTP endpoints, schemas, middleware, emits
  - Complete TypeScript and Python examples
  - When to use emits vs direct processing

- **Event Steps** → Read `.cursor/rules/motia/event-steps.mdc`
  - Background processing, topic subscriptions
  - Retry mechanisms, error handling
  - Chaining events for complex workflows

- **Cron Steps** → Read `.cursor/rules/motia/cron-steps.mdc`
  - Scheduled tasks with cron expressions
  - Idempotent execution patterns
  - Integration with event emits

### Architecture
- **Project Structure** → Read `.cursor/architecture/architecture.mdc`
  - File organization, naming conventions
  - Domain-Driven Design patterns (services, repositories)
  - Code style guidelines for TypeScript, JavaScript, Python

- **Error Handling** → Read `.cursor/architecture/error-handling.mdc`
  - ZodError middleware patterns
  - Logging best practices
  - HTTP status codes

### Advanced Features
- **State Management** → Read `.cursor/rules/motia/state-management.mdc`
  - Caching strategies, TTL configuration
  - When to use state vs database
  - Complete API reference

- **Middlewares** → Read `.cursor/rules/motia/middlewares.mdc`
  - Authentication, validation, error handling
  - Creating reusable middleware
  - Middleware composition

- **Real-time Streaming** → Read `.cursor/rules/motia/realtime-streaming.mdc`
  - Server-Sent Events (SSE) patterns
  - WebSocket support
  - Client-side integration

- **Virtual Steps** → Read `.cursor/rules/motia/virtual-steps.mdc`
  - Visual flow connections in Workbench
  - Documenting API chains
  - Flow organization

- **UI Steps** → Read `.cursor/rules/motia/ui-steps.mdc`
  - Custom Workbench visualizations
  - Available components (EventNode, ApiNode, etc.)
  - Styling with Tailwind

## Workflow for AI Coding Assistants

When working on Motia projects, follow this pattern:

1. **Read the relevant guide** in `.cursor/rules/` for the task
   - Creating API? Read `api-steps.mdc`
   - Background task? Read `event-steps.mdc`
   - Scheduled job? Read `cron-steps.mdc`

2. **Check the architecture guide** in `.cursor/architecture/architecture.mdc`
   - Understand project structure
   - Follow naming conventions
   - Apply DDD patterns

3. **Implement following the patterns** from the guides
   - Use the examples as templates
   - Follow type definitions exactly
   - Apply best practices

4. **Generate types** after changes
   ```bash
   npx motia generate-types
   ```

5. **Test in Workbench** to verify connections
   ```bash
   npx motia dev
   ```

## Critical Rules

- **ALWAYS** read `.cursor/rules/` guides before writing step code
- **ALWAYS** run `npx motia generate-types` after modifying configs
- **ALWAYS** list emits in config before using them in handlers
- **ALWAYS** follow naming conventions (`*.step.ts` or `*_step.py`)
- **NEVER** use API steps for background work (use Event steps)
- **NEVER** skip middleware for ZodError handling in multi-step projects
- **NEVER** implement rate limiting/CORS in code (infrastructure handles this)

## Resources

- **Detailed Guides**: `.cursor/rules/motia/*.mdc` (in this project)
- **Architecture**: `.cursor/architecture/*.mdc` (in this project)
- **Documentation**: [motia.dev/docs](https://motia.dev/docs)
- **Examples**: [motia.dev/docs/examples](https://motia.dev/docs/examples)
- **GitHub**: [github.com/MotiaDev/motia](https://github.com/MotiaDev/motia)

---

**Remember**: This AGENTS.md is a quick reference. The `.cursor/rules/` directory contains the comprehensive, authoritative guides with complete examples and type definitions. Always consult those guides when implementing Motia patterns.

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("openskills read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>algorithmic-art</name>
<description>Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.</description>
<location>project</location>
</skill>

<skill>
<name>brand-guidelines</name>
<description>Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.</description>
<location>project</location>
</skill>

<skill>
<name>canvas-design</name>
<description>Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.</description>
<location>project</location>
</skill>

<skill>
<name>docx</name>
<description>"Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"</description>
<location>project</location>
</skill>

<skill>
<name>frontend-design</name>
<description>Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.</description>
<location>project</location>
</skill>

<skill>
<name>hongmeng</name>
<description>HarmonyOS/鸿蒙应用开发指导，涵盖环境搭建、ArkTS/ArkUI开发、Stage模型、Ability/Extension、系统能力调用、构建签名发布、调试与多端适配。用户提出鸿蒙应用开发、API/Kit使用、调试发布、分布式特性等需求时使用。</description>
<location>project</location>
</skill>

<skill>
<name>internal-comms</name>
<description>A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).</description>
<location>project</location>
</skill>

<skill>
<name>mcp-builder</name>
<description>Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).</description>
<location>project</location>
</skill>

<skill>
<name>pdf</name>
<description>Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.</description>
<location>project</location>
</skill>

<skill>
<name>pptx</name>
<description>"Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"</description>
<location>project</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>project</location>
</skill>

<skill>
<name>slack-gif-creator</name>
<description>Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack."</description>
<location>project</location>
</skill>

<skill>
<name>template</name>
<description>Replace with description of the skill and when Claude should use it.</description>
<location>project</location>
</skill>

<skill>
<name>theme-factory</name>
<description>Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.</description>
<location>project</location>
</skill>

<skill>
<name>web-artifacts-builder</name>
<description>Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui components - not for simple single-file HTML/JSX artifacts.</description>
<location>project</location>
</skill>

<skill>
<name>webapp-testing</name>
<description>Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.</description>
<location>project</location>
</skill>

<skill>
<name>xlsx</name>
<description>"Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas"</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
