/**
 * The agents quickstart: the example definitions from the CLI's release, their
 * model key, and one run, from a terminal and from the Python SDK (ddc-node
 * `client/python`: `cere.Secret.set_from_login`, `cere.Agent.from_file`,
 * `agent.run` → `AgentResult` with `output` and `error`). Installing and
 * signing in are the Sandboxes quickstart's steps 1 and 2.
 */
import { MODEL_KEY_SECRET } from '../../Sandboxes/components/TokenSecretButton';
import { AGENT_EXAMPLES, EXAMPLES_RELEASE } from '../examples';

const research = AGENT_EXAMPLES[0];

export const AGENTS_QUICKSTART_SHELL = `# The example definitions: assets of the CLI's release
gh release download ${EXAMPLES_RELEASE} -R Cerebellum-Network/ddc-node -p '*.json'

# Their model key: the token you logged in with (calls bill to your bucket)
cere secret set ${MODEL_KEY_SECRET} --from-login

# One run = one sandbox; the agent's output is kept
cere agent run -f ${research.file} "${research.input}"
cere agent runs`;

export const AGENTS_QUICKSTART_PYTHON_SETUP = `# The example definitions: assets of the CLI's release
gh release download ${EXAMPLES_RELEASE} -R Cerebellum-Network/ddc-node -p '*.json'`;

export const AGENTS_QUICKSTART_PYTHON = `import cere

cere.Secret.set_from_login("${MODEL_KEY_SECRET}")  # the examples' model key

agent = cere.Agent.from_file("${research.file}")
res = agent.run("${research.input}",
                on_event=lambda name, fields: print(name, fields))
print(res.error or res.output)`;
