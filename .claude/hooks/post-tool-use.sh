#!/bin/bash

# BooksTrack Backend Post-Tool-Use Hook
# Automatically triggers relevant agents based on tool usage patterns

set -e

# Get the tool name from environment variable set by Claude Code
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TOOL_PATH="${CLAUDE_TOOL_PATH:-}"
TOOL_COMMAND="${CLAUDE_TOOL_COMMAND:-}"

# Exit early if no tool name provided
if [ -z "$TOOL_NAME" ]; then
  exit 0
fi

# Track if we should invoke an agent
INVOKE_AGENT=""
AGENT_CONTEXT=""

# Deployment-related tools → cloudflare-agent
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_COMMAND" | grep -qE "npx wrangler (deploy|publish)"; then
  INVOKE_AGENT="cloudflare-agent"
  AGENT_CONTEXT="Deployment detected. Monitoring health and metrics..."

# Wrangler rollback → cloudflare-agent
elif [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_COMMAND" | grep -q "npx wrangler rollback"; then
  INVOKE_AGENT="cloudflare-agent"
  AGENT_CONTEXT="Rollback executed. Verifying system stability..."

# Wrangler tail (log streaming) → cloudflare-agent
elif [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_COMMAND" | grep -q "npx wrangler tail"; then
  INVOKE_AGENT="cloudflare-agent"
  AGENT_CONTEXT="Log streaming active. Analyzing patterns..."

# Any wrangler command → cloudflare-agent
elif [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_COMMAND" | grep -q "npx wrangler"; then
  INVOKE_AGENT="cloudflare-agent"
  AGENT_CONTEXT="Wrangler operation detected."

# Code changes to handlers/services → zen-mcp-master for review
elif [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && echo "$TOOL_PATH" | grep -qE "src/(handlers|services|providers)/"; then
  INVOKE_AGENT="zen-mcp-master"
  AGENT_CONTEXT="Code changes in $TOOL_PATH detected. Consider code review (codereview tool)..."

# wrangler.toml changes → both agents
elif [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && echo "$TOOL_PATH" | grep -q "wrangler.toml"; then
  INVOKE_AGENT="cloudflare-agent,zen-mcp-master"
  AGENT_CONTEXT="wrangler.toml modified. Validate config (cloudflare-agent) and review changes (zen-mcp-master:codereview)..."

# Durable Object changes → zen-mcp-master
elif [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && echo "$TOOL_PATH" | grep -q "durable-objects/"; then
  INVOKE_AGENT="zen-mcp-master"
  AGENT_CONTEXT="Durable Object modified. Consider WebSocket pattern review (codereview)..."

# Test file changes → zen-mcp-master
elif [[ "$TOOL_NAME" =~ ^(Write|Edit)$ ]] && echo "$TOOL_PATH" | grep -qE "test/|\.test\.|\.spec\."; then
  INVOKE_AGENT="zen-mcp-master"
  AGENT_CONTEXT="Test file modified. Consider test coverage analysis (testgen)..."

# Multiple file changes → project-manager
elif [[ "$TOOL_NAME" == "MultiEdit" ]]; then
  INVOKE_AGENT="project-manager"
  AGENT_CONTEXT="Multiple files changed. Consider comprehensive review..."
fi

# If an agent should be invoked, notify the user
if [ -n "$INVOKE_AGENT" ]; then
  echo ""
  echo "🤖 Agent Suggestion: $AGENT_CONTEXT"
  echo "   Recommended Skills: $INVOKE_AGENT"
  echo ""
  echo "   To invoke manually, use:"
  for agent in $(echo "$INVOKE_AGENT" | tr ',' ' '); do
    echo "   /skill $agent"
  done
  echo ""
fi

exit 0
