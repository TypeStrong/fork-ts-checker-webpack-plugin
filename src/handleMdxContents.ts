import * as compiler from '@mdx-js/mdx';

export function handleMdxContents(content: string) {
  const src = compiler.sync(content);

  const finalContent = `
/* tslint:disable */
import * as React from 'react';
declare class MDXTag extends React.Component<{ name: string; components: any; parentName?: string; props?: any }> {
public render(): JSX.Element;
}
${src}`.replace(
    /export default class MDXContent extends React.Component \{/,
    `export default class MDXContent extends React.Component<{components: any}> {
    private layout: any;
    public static isMDXComponent: boolean = true;`
  );

  return finalContent;
}
