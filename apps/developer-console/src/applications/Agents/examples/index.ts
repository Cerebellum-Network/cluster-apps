/**
 * The example agents, byte for byte the `*.json` assets of the CLI's release
 * (ddc-node `cli/v0.1.12`, from `examples/agents/` at the tagged commit),
 * so "Run an example" runs exactly what `gh release download … '*.json'` gives
 * a terminal. Update them with the release: download the assets over these
 * files. Each input is a question the example's tools and allowed hosts can answer.
 */
import { validateAgentDefinition, type AgentDefinition } from '~/compute/agentDefinition';
import langgraph from './langgraph.json';
import research from './research.json';
import sre from './sre.json';

/** The release the examples come from. */
export const EXAMPLES_RELEASE = 'cli/v0.1.12';

export interface AgentExample {
  def: AgentDefinition;
  /** The release asset's file name. */
  file: string;
  /** What the example is asked in the quickstart. */
  input: string;
  /** What it shows, in a line. */
  shows: string;
}

const checked = (doc: unknown, file: string): AgentDefinition => {
  const errors = validateAgentDefinition(doc);
  if (errors.length) throw new Error(`${file} is not a cere.agent/v1 definition: ${errors.join(' ')}`);
  return doc as AgentDefinition;
};

export const AGENT_EXAMPLES: AgentExample[] = [
  {
    def: checked(research, 'research.json'),
    file: 'research.json',
    input: 'Write a short brief on how gVisor isolates containers, citing https://gvisor.dev/docs/',
    shows: 'Claude Code in the agent runner, reading one allowed site and citing it.',
  },
  {
    def: checked(langgraph, 'langgraph.json'),
    file: 'langgraph.json',
    input: 'What is the latest release of langgraph on PyPI and how many days ago was it uploaded?',
    shows: 'Your own container: a LangGraph agent with its own tools, calling PyPI.',
  },
  {
    def: checked(sre, 'sre.json'),
    file: 'sre.json',
    input:
      'Read-only status of github.com/Cerebellum-Network/cluster-apps: last 3 commits on dev, latest CI runs, open PRs about sandboxes',
    shows: 'A GitHub credential the proxy adds to api.github.com calls; the agent never holds it.',
  },
];
