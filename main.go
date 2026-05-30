package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	apiKey    = "sk-75860882a7a846b1b1f0be9e9d3d9dd2"
	apiURL    = "https://api.deepseek.com/chat/completions"
	modelName = "deepseek-chat"
)

// --- API Types ---

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type llmResponseMsg struct {
	content string
	err     error
}

// --- Tools ---

func resolvePath(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	if strings.HasPrefix(p, "~") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, p[1:])
	}
	p, _ = filepath.Abs(p)
	return p
}

func readFileTool(filename string) map[string]any {
	fullPath := resolvePath(filename)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return map[string]any{"file_path": fullPath, "error": err.Error()}
	}
	return map[string]any{"file_path": fullPath, "content": string(data)}
}

func listFilesTool(path string) map[string]any {
	fullPath := resolvePath(path)
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return map[string]any{"path": fullPath, "error": err.Error()}
	}
	files := make([]map[string]string, 0, len(entries))
	for _, e := range entries {
		t := "file"
		if e.IsDir() {
			t = "dir"
		}
		files = append(files, map[string]string{"filename": e.Name(), "type": t})
	}
	return map[string]any{"path": fullPath, "files": files}
}

func editFileTool(path, oldStr, newStr string) map[string]any {
	fullPath := resolvePath(path)
	if oldStr == "" {
		if err := os.WriteFile(fullPath, []byte(newStr), 0644); err != nil {
			return map[string]any{"path": fullPath, "error": err.Error()}
		}
		return map[string]any{"path": fullPath, "action": "created_file"}
	}
	orig, err := os.ReadFile(fullPath)
	if err != nil {
		return map[string]any{"path": fullPath, "error": err.Error()}
	}
	idx := strings.Index(string(orig), oldStr)
	if idx == -1 {
		return map[string]any{"path": fullPath, "action": "old_str not found"}
	}
	edited := string(orig[:idx]) + newStr + string(orig[idx+len(oldStr):])
	if err := os.WriteFile(fullPath, []byte(edited), 0644); err != nil {
		return map[string]any{"path": fullPath, "error": err.Error()}
	}
	return map[string]any{"path": fullPath, "action": "edited"}
}

// --- System Prompt ---

func getSystemPrompt() string {
	var b strings.Builder
	b.WriteString("You are a coding assistant whose goal it is to help us solve coding tasks.\n")
	b.WriteString("You have access to a series of tools you can execute. Here are the tools you can execute:\n\n")

	tools := []struct {
		name string
		desc string
		sig  string
	}{
		{
			name: "read_file",
			desc: "Gets the full content of a file provided by the user.",
			sig:  `read_file_tool(filename string) -> {"file_path": string, "content": string}`,
		},
		{
			name: "list_files",
			desc: "Lists the files in a directory provided by the user.",
			sig:  `list_files_tool(path string) -> {"path": string, "files": [{"filename": string, "type": "file|dir"}]}`,
		},
		{
			name: "edit_file",
			desc: "Replaces first occurrence of old_str with new_str in file. If old_str is empty, create/overwrite file with new_str.",
			sig:  `edit_file_tool(path string, old_str string, new_str string) -> {"path": string, "action": "created_file|edited|old_str not_found"}`,
		},
	}

	for _, t := range tools {
		b.WriteString(fmt.Sprintf("TOOL\n===\nName: %s\nDescription: %s\nSignature: %s\n", t.name, t.desc, t.sig))
		b.WriteString(strings.Repeat("=", 15) + "\n")
	}

	b.WriteString("\nWhen you want to use a tool, reply with exactly one line in the format: 'tool: TOOL_NAME({JSON_ARGS})' and nothing else.\n")
	b.WriteString("Use compact single-line JSON with double quotes. After receiving a tool_result(...) message, continue the task.\n")
	b.WriteString("If no tool is needed, respond normally.\n")
	return b.String()
}

// --- Parser ---

type invocation struct {
	Name string
	Args map[string]any
}

func extractToolInvocations(text string) []invocation {
	var invs []invocation
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "tool:") {
			continue
		}
		after := strings.TrimSpace(line[len("tool:"):])
		idx := strings.Index(after, "(")
		if idx == -1 {
			continue
		}
		name := strings.TrimSpace(after[:idx])
		rest := strings.TrimSpace(after[idx+1:])
		if !strings.HasSuffix(rest, ")") {
			continue
		}
		jsonStr := strings.TrimSpace(rest[:len(rest)-1])
		var args map[string]any
		if err := json.Unmarshal([]byte(jsonStr), &args); err != nil {
			continue
		}
		invs = append(invs, invocation{Name: name, Args: args})
	}
	return invs
}

// --- LLM ---

func callLLM(conv []message) tea.Cmd {
	return func() tea.Msg {
		payload := map[string]any{
			"model":       modelName,
			"messages":    conv,
			"max_tokens":  4096,
			"temperature": 0.2,
		}
		body, _ := json.Marshal(payload)
		req, err := http.NewRequest("POST", apiURL, bytes.NewReader(body))
		if err != nil {
			return llmResponseMsg{err: err}
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return llmResponseMsg{err: err}
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 {
			return llmResponseMsg{err: fmt.Errorf("API %d: %s", resp.StatusCode, string(respBody))}
		}

		var result struct {
			Choices []struct {
				Message message `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(respBody, &result); err != nil {
			return llmResponseMsg{err: err}
		}
		if len(result.Choices) == 0 {
			return llmResponseMsg{err: fmt.Errorf("empty response from API")}
		}
		return llmResponseMsg{content: result.Choices[0].Message.Content}
	}
}

// --- TUI ---

var (
	userStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	assistantStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	toolStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("10"))
	errorStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("9"))
	busyStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Italic(true)
)

type model struct {
	vp      viewport.Model
	ta      textarea.Model
	conv    []message
	content string // rendered viewport text
	ready   bool
	busy    bool
	width   int
	height  int
}

func initialModel() model {
	ta := textarea.New()
	ta.Placeholder = "Send a message..."
	ta.Focus()
	ta.Prompt = "┃ "
	ta.SetHeight(3)
	ta.ShowLineNumbers = false

	vp := viewport.New(80, 20)

	conv := []message{{Role: "system", Content: getSystemPrompt()}}

	return model{
		ta:   ta,
		vp:   vp,
		conv: conv,
	}
}

func (m model) Init() tea.Cmd {
	return textarea.Blink
}

func (m *model) updateSizes() {
	if !m.ready {
		return
	}
	m.ta.SetWidth(m.width)
	m.vp.Width = m.width
	m.vp.Height = m.height - m.ta.Height() - 2 // help line + gap
}

func (m *model) appendView(label, text string, style lipgloss.Style) {
	line := style.Render(fmt.Sprintf("%s: %s", label, text))
	if m.content == "" {
		m.content = line
	} else {
		m.content += "\n" + line
	}
	m.vp.SetContent(m.content)
	m.vp.GotoBottom()
}

func (m *model) popBusyLine() {
	if m.content == "" {
		return
	}
	lines := strings.Split(m.content, "\n")
	if len(lines) > 0 && strings.Contains(lines[len(lines)-1], "Thinking...") {
		lines = lines[:len(lines)-1]
		if len(lines) == 0 {
			m.content = ""
		} else {
			m.content = strings.Join(lines, "\n")
		}
		m.vp.SetContent(m.content)
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		if !m.ready {
			m.vp = viewport.New(m.width, m.height-m.ta.Height()-2)
			m.ta.SetWidth(m.width)
			m.ready = true
		} else {
			m.updateSizes()
		}

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC, tea.KeyEsc:
			return m, tea.Quit
		case tea.KeyEnter:
			if !msg.Alt && !m.busy {
				userInput := strings.TrimSpace(m.ta.Value())
				if userInput != "" {
					m.ta.Reset()
					m.conv = append(m.conv, message{Role: "user", Content: userInput})
					m.appendView("You", userInput, userStyle)
					m.busy = true
					m.appendView("System", "Thinking...", busyStyle)
					return m, tea.Batch(callLLM(m.conv), m.ta.Cursor.BlinkCmd())
				}
				return m, nil
			}
			// Alt+Enter falls through to textarea to insert newline
		}
	case llmResponseMsg:
		m.popBusyLine()
		if msg.err != nil {
			m.appendView("Error", msg.err.Error(), errorStyle)
			m.busy = false
			return m, nil
		}

		assistantResp := msg.content
		invs := extractToolInvocations(assistantResp)

		if len(invs) == 0 {
			m.conv = append(m.conv, message{Role: "assistant", Content: assistantResp})
			m.appendView("Assistant", assistantResp, assistantStyle)
			m.busy = false
			return m, nil
		}

		// Tool calls requested
		m.conv = append(m.conv, message{Role: "assistant", Content: assistantResp})
		for _, inv := range invs {
			var result map[string]any
			switch inv.Name {
			case "read_file":
				fn, _ := inv.Args["filename"].(string)
				result = readFileTool(fn)
			case "list_files":
				p, _ := inv.Args["path"].(string)
				result = listFilesTool(p)
			case "edit_file":
				p, _ := inv.Args["path"].(string)
				oldStr, _ := inv.Args["old_str"].(string)
				newStr, _ := inv.Args["new_str"].(string)
				result = editFileTool(p, oldStr, newStr)
			default:
				result = map[string]any{"error": fmt.Sprintf("unknown tool %s", inv.Name)}
			}
			resJSON, _ := json.Marshal(result)
			toolResult := fmt.Sprintf("tool_result(%s)", string(resJSON))
			m.conv = append(m.conv, message{Role: "user", Content: toolResult})
			m.appendView("Tool", fmt.Sprintf("%s %v -> %s", inv.Name, inv.Args, string(resJSON)), toolStyle)
		}
		m.appendView("System", "Thinking...", busyStyle)
		return m, callLLM(m.conv)
	}

	// Update subcomponents
	var cmd tea.Cmd
	m.ta, cmd = m.ta.Update(msg)
	cmds = append(cmds, cmd)
	m.vp, cmd = m.vp.Update(msg)
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	if !m.ready {
		return "Loading..."
	}
	help := lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("enter: send • alt+enter: newline • ctrl+c: quit")
	if m.busy {
		help = lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Italic(true).Render("agent is working...")
	}
	return fmt.Sprintf("%s\n\n%s\n%s", m.vp.View(), m.ta.View(), help)
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
