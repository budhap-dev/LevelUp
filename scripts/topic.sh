#!/usr/bin/env bash
# Guided workflow for writing or upgrading one topic with an external chat model.
#   npm run topic            (or: bash scripts/topic.sh [topic-id])
# Steps: pick topic → branch → build prompt (copied to clipboard) → paste the model's reply
# → validate (and fix loop) → VERIFY review → preview → test → commit, PR, merge.
# Written for macOS (pbcopy/pbpaste) and bash 3.2.

set -euo pipefail
cd "$(dirname "$0")/.."

PROMPT_DOC=docs/prompts/generate-topic.md
TEMPLATE=content/_template.md
TODAY=$(date +%F)

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '\033[36m›\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✘\033[0m %s\n' "$*" >&2; exit 1; }
pause() { read -r -p "$(printf '\033[2m%s\033[0m' "${1:-Press Enter to continue…} ")" _; }
ask_yn() { # ask_yn "Question" default(y|n)
  local def=${2:-y} hint='[Y/n]' reply
  [ "$def" = n ] && hint='[y/N]'
  read -r -p "$1 $hint " reply
  reply=${reply:-$def}
  [[ $reply =~ ^[Yy] ]]
}

command -v pbcopy >/dev/null || die "pbcopy/pbpaste not found (this script is written for macOS)."
command -v node >/dev/null || die "node not found."

# Prints the body of the Nth ```text block in the prompt doc.
text_block() {
  awk -v want="$1" '
    /^```text[[:space:]]*$/ { n++; if (n == want) { on = 1; next } }
    on && /^```[[:space:]]*$/ { exit }
    on { print }
  ' "$PROMPT_DOC"
}

# ── 1. Pick a topic ───────────────────────────────────────────────────────────
# Lines: id|status|group|title|pathCount, unfinished topics first, most-used-by-paths first.
TOPICS=$(node -e '
  const fs = require("fs");
  const uses = {};
  for (const p of require("./content/paths.json")) for (const s of p.steps) uses[s.topicId] = (uses[s.topicId] || 0) + 1;
  const rank = { draft: 0, stub: 1, complete: 2 };
  const rows = [];
  for (const g of fs.readdirSync("content")) {
    const dir = "content/" + g;
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const src = fs.readFileSync(dir + "/" + f, "utf8");
      const get = (k) => ((src.match(new RegExp("^" + k + ":\\s*(.+)$", "m")) || [])[1] || "").replace(/^"|"$/g, "").trim();
      const id = f.slice(0, -3);
      rows.push({ id, status: get("status") || "stub", group: g, title: get("title") || id, uses: uses[id] || 0 });
    }
  }
  rows.sort((a, b) => (a.status === "complete") - (b.status === "complete") || b.uses - a.uses || rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
  for (const r of rows) console.log([r.id, r.status, r.group, r.title, r.uses].join("|"));
')

TOPIC_ID=${1:-}
if [ -z "$TOPIC_ID" ]; then
  bold "Suggested next topics (used by the most learning paths first):"
  i=0
  while IFS='|' read -r id status group title uses; do
    [ "$status" = complete ] && continue
    i=$((i + 1)); [ $i -gt 15 ] && break
    note="$status"; [ "$status" = draft ] && note="draft – needs more questions"
    printf '  %2d) %-30s %-36s %s\n' "$i" "$id" "($note)" "$( [ "$uses" -gt 0 ] && echo "on $uses path(s)")"
  done <<< "$TOPICS"
  echo
  read -r -p "Pick a number, or type any topic id: " choice
  if [[ $choice =~ ^[0-9]+$ ]]; then
    TOPIC_ID=$(grep -v '|complete|' <<< "$TOPICS" | sed -n "${choice}p" | cut -d'|' -f1)
  else
    TOPIC_ID=$choice
  fi
fi

ROW=$(grep "^${TOPIC_ID}|" <<< "$TOPICS" || true)
if [ -z "$ROW" ]; then
  matches=$(cut -d'|' -f1 <<< "$TOPICS" | grep -i -- "${TOPIC_ID:-^$}" | tr '\n' ' ' || true)
  die "Unknown topic '${TOPIC_ID}'.${matches:+ Did you mean: $matches}"
fi
IFS='|' read -r TOPIC_ID STATUS GROUP TITLE _ <<< "$ROW"
FILE="content/$GROUP/$TOPIC_ID.md"
UPGRADE=false; [ "$STATUS" != stub ] && UPGRADE=true
echo
bold "$TITLE  ($FILE, currently $STATUS)"

# ── 2. Branch ─────────────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  die "You have uncommitted changes. Commit or stash them first."
fi
BRANCH="content-$TOPIC_ID"
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  info "Updating main and creating branch $BRANCH"
  git checkout -q main
  git pull -q --ff-only || warn "Couldn't pull main (offline?). Continuing with your local main."
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout -q "$BRANCH"; else git checkout -q -b "$BRANCH"; fi
fi
ok "On branch $BRANCH"

# Keep the original for the id check and for undo.
ORIGINAL=$(mktemp); cp "$FILE" "$ORIGINAL"
PROMPT_FILE=$(mktemp -t levelup-prompt)
trap 'rm -f "$ORIGINAL" "$PROMPT_FILE"' EXIT

# ── 3. Build the prompt ───────────────────────────────────────────────────────
{
  esc_title=$(printf '%s' "$TITLE" | sed 's/[&|\\]/\\&/g')
  text_block 1 \
    | sed -e "s|<TOPIC TITLE>|$esc_title|g" -e "s|<topic-id>|$TOPIC_ID|g" -e "s|<group-id>|$GROUP|g" -e "s|<TODAY YYYY-MM-DD>|$TODAY|g"
  if $UPGRADE; then echo; text_block 2; fi
  echo
  echo "Reply with ONLY the complete file content, starting with the --- frontmatter line. No commentary before or after it."
  echo
  echo "TEMPLATE:"
  echo
  cat "$TEMPLATE"
  echo
  echo "CURRENT FILE ($FILE):"
  echo
  cat "$FILE"
} > "$PROMPT_FILE"
[ -s "$PROMPT_FILE" ] && grep -q "$TOPIC_ID" "$PROMPT_FILE" || die "Couldn't build the prompt from $PROMPT_DOC (has its \`\`\`text block moved?)."

pbcopy < "$PROMPT_FILE"
echo
ok "Prompt copied to your clipboard ($(wc -w < "$PROMPT_FILE" | tr -d ' ') words$($UPGRADE && echo ', including the upgrade-a-draft paragraph'))."
info "Paste it into a NEW chat in ChatGPT / Gemini / Claude and send it."
info "Then copy the model's whole reply (use its copy button)."
echo

# ── 4–5. Paste, clean, validate (loop until clean) ────────────────────────────
# Strips anything the model put around the file: text before the first ---, and a wrapping code fence.
clean_reply() {
  awk '
    !started {
      if ($0 ~ /^(```|~~~)/) { fence = $0; sub(/[^`~].*$/, "", fence); next }
      if ($0 ~ /^---[[:space:]]*$/) started = 1
      else next
    }
    { lines[++n] = $0 }
    END {
      if (fence != "") { for (i = n; i > 0; i--) if (lines[i] == fence) { n = i - 1; break } }
      while (n > 0 && lines[n] ~ /^[[:space:]]*$/) n--
      for (i = 1; i <= n; i++) print lines[i]
    }
  '
}

# Lists question ids and flashcard fronts from the original that are missing in the new file.
missing_keys() {
  local key
  { grep -oE '\{#[a-z0-9-]+\}' "$ORIGINAL" || true; awk '/^## /{on = ($0 ~ /^## Cheat Sheet/)} on' "$ORIGINAL" | grep -oE '^- \*\*[^*]+\*\*' || true; } | while IFS= read -r key; do
    grep -qF -- "$key" "$FILE" || echo "$key"
  done
}

while true; do
  pause "When the model's reply is on your clipboard, press Enter…"
  reply=$(pbpaste | clean_reply)
  if [ -z "$reply" ] || [ "$(printf '%s' "$reply" | wc -l)" -lt 20 ]; then
    warn "The clipboard doesn't look like a topic file (no '---' frontmatter, or too short). Copy the reply again."
    continue
  fi
  printf '%s\n' "$reply" > "$FILE"
  ok "Saved to $FILE ($(wc -l < "$FILE" | tr -d ' ') lines)"

  problems=""
  info "Checking format (npm run content)…"
  if out=$(npm run -s content 2>&1); then
    summary=$(grep -E 'topics \(' <<< "$out" | tail -1 || true)
    # Warnings are printed as the file path ("data/caching.md") followed by indented lines.
    file_warnings=$(awk -v f="$GROUP/$TOPIC_ID.md" '$0 == f { on = 1; next } on && /^[[:space:]]/ { print; next } { on = 0 }' <<< "$out")
    if [ -n "$file_warnings" ]; then problems="These warnings were reported:"$'\n'"$file_warnings"; else ok "Format OK. $summary"; fi
  else
    problems="The build check failed with:"$'\n'"$(grep -vE '^\s*$|^>' <<< "$out" | head -40)"
  fi

  if $UPGRADE; then
    lost=$(missing_keys)
    if [ -n "$lost" ]; then
      problems="${problems:+$problems$'\n\n'}You removed or changed these existing question ids / cheat-sheet fronts. They must stay EXACTLY as they were:"$'\n'"$lost"
    else
      ok "All existing question ids and flashcard fronts kept."
    fi
  fi

  [ -z "$problems" ] && break

  echo
  warn "Problems found:"
  echo "$problems" | sed 's/^/    /'
  printf '%s\n\n%s\n' "$problems" "Fix these and reply with the full corrected file only." | pbcopy
  echo
  info "A fix request is on your clipboard. Paste it into the same chat, then copy the model's new reply."
  if ! ask_yn "Try again with a corrected reply?" y; then
    if ask_yn "Keep the current file anyway?" n; then break; fi
    cp "$ORIGINAL" "$FILE"; git checkout -q main; git branch -D "$BRANCH" >/dev/null 2>&1 || true
    die "Discarded. $FILE is unchanged and you're back on main."
  fi
done

# ── 6. VERIFY markers ─────────────────────────────────────────────────────────
count=$(grep -c 'VERIFY:' "$FILE" || true)
if [ "$count" -gt 0 ]; then
  echo
  warn "$count claim(s) are marked VERIFY: – check each in the official docs, fix it, then delete the marker:"
  grep -n 'VERIFY:' "$FILE" | cut -c1-150 | sed 's/^/    line /'
  first=$(grep -n 'VERIFY:' "$FILE" | head -1 | cut -d: -f1)
  if command -v code >/dev/null; then code -g "$FILE:$first"; info "Opened in VS Code at the first one."; fi
  pause "Press Enter when you've finished (or to leave them for later)…"
  npm run -s content >/dev/null 2>&1 || warn "The file no longer passes the content check – run 'npm run content' to see why."
else
  ok "No VERIFY markers."
fi

# ── 7. Preview ────────────────────────────────────────────────────────────────
echo
if ask_yn "Preview the topic in the browser now?" y; then
  ./node_modules/.bin/vite --open "/topics/$TOPIC_ID" >/dev/null 2>&1 &
  VITE_PID=$!
  info "Dev server running. Read it through, edit $FILE if you want (the page reloads)."
  pause "Press Enter to stop the preview and continue…"
  kill "$VITE_PID" 2>/dev/null || true
fi

# ── 8. Ship ───────────────────────────────────────────────────────────────────
echo
info "Running tests…"
if npm test --silent >/dev/null 2>&1; then ok "Tests pass."; else
  warn "Tests failed. Run 'npm test' to see why. Your work is saved on branch $BRANCH."; exit 1
fi

NEW_STATUS=$(grep -m1 '^status:' "$FILE" | awk '{print $2}')
QUESTIONS=$(grep -cE '^### .*\{#' "$FILE" || true)
git --no-pager diff --stat -- "$FILE"
if ! ask_yn "Commit, open a PR and merge it?" y; then
  info "Left uncommitted on branch $BRANCH. Ship later with git/gh."; exit 0
fi

ACTION=Add; $UPGRADE && ACTION=Upgrade
git add "$FILE"
git commit -q -m "Content: $ACTION $TITLE ($NEW_STATUS, $QUESTIONS questions)"
git push -q -u origin "$BRANCH"
remaining=$(grep -c 'VERIFY:' "$FILE" || true)
gh pr create --base main --title "Content: $TITLE ($NEW_STATUS)" --body "$ACTION \`$TOPIC_ID\` → **$NEW_STATUS**, $QUESTIONS interview questions. $remaining VERIFY marker(s) remaining. Generated with docs/prompts/generate-topic.md, checked by \`npm run content\` and \`npm test\`." >/dev/null
ok "PR opened: $(gh pr view --json url -q .url)"

if ask_yn "Squash-merge it now?" y; then
  gh pr merge --squash --delete-branch >/dev/null
  git checkout -q main && git pull -q --ff-only
  ok "Merged. You're back on an up-to-date main."
else
  info "PR left open for review."
fi
echo
bold "Done: $TITLE. Run 'npm run topic' for the next one."
