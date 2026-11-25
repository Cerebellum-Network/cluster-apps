/**
 * The canonical quickstart, verbatim: the CLI and Python SDK's own text (ddc-node
 * `docs/compute/sandboxes/README.md`, quickstart section, and `API.md` 3.10), one
 * block per tab. The console shows it exactly as written, so a reader can diff the
 * page against the docs. Change it there first, then here.
 */
export const QUICKSTART_CLI = `pip install cere
cere login
cere sandbox create --image python:3.12-slim --timeout 600
cere sandbox exec <id> -- python -c "print('hello from a DDC sandbox')"`;

export const QUICKSTART_PYTHON_SETUP = `pip install cere
cere login`;

export const QUICKSTART_PYTHON = `import cere

sb = cere.Sandbox.create(image="python:3.12-slim", timeout=600)
p = sb.exec("python", "-c", "print('hello from a DDC sandbox')")
print(p.stdout.read(), end="")
sb.terminate()`;

/**
 * "With a credential", under the Python tab: API.md 3.10's block of that name, verbatim. A credential for this
 * sandbox only: the egress proxy adds it to the requests its rule allows and deletes it when the sandbox ends.
 */
export const QUICKSTART_PYTHON_CREDENTIAL = `import cere

sb = cere.Sandbox.create(
    image="python:3.12-slim",
    egress=[cere.Allow("api.github.com", ["GET"], credential="github")],
    secrets=[cere.Secret.bearer("github", token, hosts=["api.github.com"])],
)
p = sb.exec("python", "-c", "import urllib.request as u; print(u.urlopen('https://api.github.com/user').status)")
print(p.stdout.read(), end="")
sb.terminate()`;

/**
 * Until `cere` is on PyPI: the install that works today, shown above the tabs
 * instead of `pip install cere` (the docs' "> Until `cere` is on PyPI" line).
 * When `pip install cere` works, set it to '' and the note disappears.
 */
export const UNTIL_PYPI: string = `gh release download cli/v0.1.7 -R Cerebellum-Network/ddc-node -p 'cere-*.whl' -D cere-wheels && pip install --no-index --find-links cere-wheels cere`;

/** What "Try it here" runs: the Python example's sandbox and command, through the same API. */
export const FIRST_RUN = {
  image: 'python:3.12-slim',
  timeout_s: 600,
  command: ['python', '-c', "print('hello from a DDC sandbox')"],
} as const;
