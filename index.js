import fs from "fs";
import path from "path";
import mkdirp from "mkdirp";
import { SourceMapConsumer } from "source-map";
import { Command } from "commander";
import glob from "glob";

const program = new Command("restore-source-tree")
  .usage("[options] <file>")
  .description("Restores file structure from source map")
  .option(
    "-o, --out-dir [dir]",
    "Output directory ('output' by default)",
    "output",
  )
  .option("-n, --include-node-modules", "Include source files in node_modules")
  .parse(process.argv);

if (program.args.length === 0) {
  program.outputHelp();
  process.exit(1);
}

const readJson = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (e) {
    console.error(`Parsing file '${filename}' failed: ${e.message}`);
    process.exit(1);
  }
};

const getSourceList = (smc) => {
  return smc.sources.filter(
    (filePath) =>
      !filePath.includes("/webpack/") && !filePath.includes("/node_modules/"),
  );
};

const saveSourceContent = (smc, filePath) => {
  const content = smc.sourceContentFor(filePath, true);
  if (!content) {
    console.log(`Error content ${filePath}`);
    console.log(content);
    return;
  }

  const outPath = path.join(program.outDir, filePath.replace("webpack://", ""));
  const dir = path.dirname(outPath);

  mkdirp(dir, (err) => {
    if (err) {
      console.error("Failed creating directory", dir);
      process.exit(1);
    } else {
      fs.writeFile(outPath, content, (err) => {
        if (err) {
          console.error("Failed writing file", outPath);
          process.exit(1);
        }
      });
    }
  });
};

async function processFile(filename) {
  const json = readJson(filename);
  if (json.version !== 3) {
    throw new Error(`Invalid SourceMap Version ${json.version}`);
  }

  const smc = await new SourceMapConsumer(json);
  const sources = getSourceList(smc);
  sources.forEach((filePath) => saveSourceContent(smc, filePath));
  console.log(`Processed ${sources.length} files for ${filename}`);
}

program.args
  .map((pattern) => glob.sync(pattern))
  .reduce((prev, curr) => prev.concat(curr), [])
  .forEach((filename) => {
    try {
      fs.accessSync(filename);
      processFile(filename);
    } catch (err) {
      console.error(err.message);
    }
  });
