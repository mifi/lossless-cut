import { Project } from 'ts-morph';
import fs from 'node:fs';

const project = new Project({
  tsConfigFilePath: 'tsconfig.common.json',
});

const memoryProject = new Project({ useInMemoryFileSystem: true });
const memoryFile = memoryProject.createSourceFile('');

const sourceFile = project.getSourceFileOrThrow('src/common/userTypes.ts');

let md = '# Public types\n\n';

// transfer interfaces to a temporary in-memory file
sourceFile.getInterfaces().forEach((iface) => {
  const struct = iface.getStructure();
  struct.isExported = false; // remove `export`
  memoryFile.addInterface(struct);
});

memoryFile.getInterfaces().forEach((iface) => {
  md += `## ${iface.getName()}\n\n`;
  md += '```ts\n';
  md += iface.getText(true);
  md += '\n```\n\n';
});

fs.writeFileSync('docs/generated/types.md', md);
