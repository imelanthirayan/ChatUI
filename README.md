# ChatUI

A customizable chat interface built with Next.js that connects to any LLM backend (Azure OpenAI, OpenAI, Ollama, LM Studio, or custom APIs). Features real-time streaming, multi-provider support, and a fully configurable UI — all from a single config file.

## Features

- **Multi-provider support** — Azure OpenAI, OpenAI, Ollama, LM Studio, or any custom backend
- **Streaming responses** — Token-by-token display with stop generation button
- **Multiple chat options** — Route conversations to different backends with per-option system prompts
- **Markdown rendering** — Full GFM support with code block copy buttons
- **Copy to clipboard** — Copy any message or code block with one click
- **Message timestamps** — Configurable timestamps on all messages
- **Chat management** — Create, rename, delete conversations with confirmation modals
- **Welcome screen** — Configurable hero image, suggestion chips, and grid layout
- **Theme system** — Customize all colors from the config file (sidebar, accent, text, etc.)
- **Responsive design** — Mobile-friendly with overlay sidebar and adaptive message widths
- **File panel** — Optional sidebar for session-associated files
- **Single config file** — All customization in `app/chat.config.ts`
- **Built-in auth** — Simple username/password login (configurable)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the default credentials:
- Username: `admin` / Password: `admin123`
- Username: `user` / Password: `user123`

## Configuration

All configuration is in [`app/chat.config.ts`](app/chat.config.ts). See [CONFIGURATION.md](CONFIGURATION.md) for full documentation.

### Quick Examples

**Connect to Azure OpenAI:**
```ts
endpoints: {
  "my-gpt": {
    url: "https://<resource>.openai.azure.com/openai/deployments/<model>/chat/completions?api-version=2025-01-01-preview",
    type: "azure-openai",
  },
},
apiKeys: { "my-gpt": "<your-key>" },
```

**Connect to local Ollama (no API key needed):**
```ts
endpoints: {
  "local": {
    url: "http://localhost:11434/api/chat",
    type: "ollama",
    model: "llama3",
  },
},
```

**Customize theme colors:**
```ts
theme: {
  sidebar: "#171717",
  main: "#212121",
  accent: "#FFC600",
  // ... see CONFIGURATION.md for all options
},
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Markdown:** react-markdown + remark-gfm
- **Storage:** File-based (JSON + Markdown)

## Project Structure

```
app/
├── chat.config.ts       # All configuration (theme, branding, endpoints, keys, users)
├── ChatApp.tsx          # Main chat component
├── page.tsx             # Login page
├── layout.tsx           # Root layout
├── globals.css          # Global styles & CSS variables
└── api/
    ├── llm/route.ts     # LLM proxy (multi-provider, streaming, auth)
    ├── chats/           # Chat CRUD API
    ├── files/route.ts   # File metadata API
    └── mock/route.ts    # Mock LLM for testing
data/
└── chats/               # Persisted chat data (per user)
public/                  # Static assets (logo, favicon)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## License

Private
