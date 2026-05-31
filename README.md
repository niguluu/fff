# fff — AI Coding Assistant CLI

**fff** is a terminal-based AI coding assistant that helps you build, edit, and manage code projects through natural language conversations. It runs entirely in your terminal with a beautiful TUI (Terminal User Interface) built with [Ink](https://github.com/vadimdemedes/ink) and React.

## Features

- 🤖 **AI-powered coding assistant** — Ask questions, request code changes, or get help debugging
- 🛠️ **Tool execution** — The AI can read, list, edit, and create files in your project
- 💬 **Interactive chat** — Full conversation history with scrollback support
- ⌨️ **Vim-like navigation** — Arrow keys for history, Page Up/Down for scrolling
- 🎨 **Beautiful TUI** — Color-coded messages, streaming output, and alternate screen buffer
- 🔄 **Automatic context pruning** — Keeps conversations manageable by trimming old messages

## Installation

### Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- An OpenAI API key (or compatible LLM provider)

### Quick Install

```bash
# Clone the repository
git clone https://github.com/yourusername/fff.git
cd fff

# Install dependencies
bun install

# Set up your environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Build the CLI
bun run build

# (Optional) Install globally
bun link
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | (required) |
| `OPENAI_BASE_URL` | Custom API endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model to use | `gpt-4o` |
| `MAX_TOOL_ROUNDS` | Max tool execution rounds | `20` |
| `MAX_CONVERSATION_MESSAGES` | Max messages before pruning | `40` |

## Usage

```bash
# Run directly with Bun
bun start

# Or use the built version
bun run build
./dist/index.js

# If linked globally
fff
```

### Commands & Controls

| Key | Action |
|-----|--------|
| `Enter` | Send your message |
| `↑` / `↓` | Navigate input history |
| `Page Up` / `Page Down` | Scroll through conversation |
| `Ctrl+C` / `Esc` | Exit the application |

### Example Conversation

```
> create a new file called hello.py that prints "Hello, World!"
→ atomic_overwrite hello.py
💾 write: hello.py

> now make it ask for the user's name
→ read_file hello.py
📄 read: hello.py
→ edit_file hello.py
✏️ edit: hello.py (replaced)
```

## Architecture

```
fff/
├── src/
│   ├── index.tsx      # Entry point
│   ├── app.tsx        # Main TUI application (React/Ink)
│   ├── llm.ts         # LLM client & tool invocation parser
│   └── tools.ts       # Tool implementations (read, list, edit, overwrite)
├── dist/              # Built output
├── .env               # Environment configuration
├── package.json
└── tsconfig.json
```

### How It Works

1. You type a natural language request
2. The app sends your message (plus conversation history) to the LLM
3. The LLM responds with either:
   - A text answer, or
   - Tool invocations (e.g., `read_file`, `edit_file`)
4. If tool invocations are detected, the app executes them and sends results back to the LLM
5. The LLM continues until it produces a final answer or reaches the tool round limit

## Development

```bash
# Run in watch mode (auto-restart on changes)
bun run dev

# Build for production
bun run build

# Type checking
bunx tsc --noEmit
```

## Available Tools

The AI assistant can use these tools to interact with your filesystem:

| Tool | Description |
|------|-------------|
| `read_file` | Read the contents of a file (with optional line limit) |
| `list_files` | List files and directories in a path |
| `edit_file` | Replace the first occurrence of a string in a file |
| `atomic_overwrite` | Completely overwrite a file (crash-safe) |

## License

MIT License

Copyright (c) 2025 fff

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
