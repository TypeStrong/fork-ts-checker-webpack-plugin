export function fileLocation(file: string, location: string, async: boolean): string {
  // async: true uses our own WebpackFormatter which
  // separates file and location with a colon
  const locationSeperator = async ? ':' : ' ';

  // e.g. `/a/b/c.ts:2:10` or `/a/b/c.ts 2:10`
  return `${file}${locationSeperator}${location}`;
}
