import type { Issue } from '../issue';

type Formatter = (issue: Issue) => string;

export { Formatter };
