/**
 * The canonical quickstart, verbatim: the CLI and Python SDK's own text (ddc-node
 * `docs/compute/sandboxes/README.md`, quickstart section). The console shows it
 * exactly as written, so a reader can diff the page against the docs. Change it
 * there first, then here.
 */
export const QUICKSTART_SHELL = `# 1. Install the CLI and the Python SDK (release assets need access to Cerebellum-Network/ddc-node)
gh release download cli/v0.1.0 -R Cerebellum-Network/ddc-node -p "cere_$(uname -s | tr A-Z a-z)_$(uname -m).tar.gz" -O - | tar -xz cere
mkdir -p ~/.local/bin && install cere ~/.local/bin/cere && export PATH="$HOME/.local/bin:$PATH"
gh release download cli/v0.1.0 -R Cerebellum-Network/ddc-node -p 'cere_sdk-0.1.0-py3-none-any.whl'
python3 -m venv .venv && . .venv/bin/activate && pip install ./cere_sdk-0.1.0-py3-none-any.whl

# 2. Sign in: Developer Console → Sandboxes → CLI access → Create token, then paste it
cere login

# 3. Run something
cere sandbox create --image python:3.12-slim --timeout 600          # prints the sandbox id
cere sandbox exec <id> -- python -c "print('hello from a DDC sandbox')"
cere sandbox terminate <id>`;

export const QUICKSTART_PYTHON = `import cere

sb = cere.Sandbox.create(image="python:3.12-slim", timeout=600)
p = sb.exec("python", "-c", "print('hello from a DDC sandbox')")
print(p.stdout.read(), end="")
sb.terminate()`;

/** What "Try it here" runs: the Python example's sandbox and command, through the same API. */
export const FIRST_RUN = {
  image: 'python:3.12-slim',
  timeout_s: 600,
  command: ['python', '-c', "print('hello from a DDC sandbox')"],
} as const;
