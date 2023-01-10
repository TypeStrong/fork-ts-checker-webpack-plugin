import type { Issue } from '../issue';

type Formatter = (issue: Issue) => string;
type FormatterPathType = 'relative' | 'absolute';

export { Formatter, FormatterPathType };
