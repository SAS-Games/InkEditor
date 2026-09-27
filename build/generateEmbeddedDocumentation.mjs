import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const buildDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(buildDirectory, "../app");
const requireFromApp = createRequire(path.join(appDirectory, "package.json"));
const markedModulePath = requireFromApp.resolve("marked");
const { marked } = await import(pathToFileURL(markedModulePath).href);

const documentationSourceDirectory = path.join(
  appDirectory,
  "resources",
  "Documentation"
);
const outputDirectory = path.join(appDirectory, "renderer", "documentation");
const markdown = fs.readFileSync(
  path.join(documentationSourceDirectory, "WritingWithInk.md"),
  "utf8"
);
const stylesheet = fs.readFileSync(
  path.join(documentationSourceDirectory, "documentation.css"),
  "utf8"
);
const content = marked.parse(markdown);
const document = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Writing with ink</title>
    <style>
${stylesheet}
    </style>
  </head>
  <body>
${content}
  </body>
</html>
`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "embedded.html"), document);
console.log("Embedded documentation was created");
