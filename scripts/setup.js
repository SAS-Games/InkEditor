const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { spawnSync } = require("child_process");

const minimumNodeMajor = 20;
const repositoryDirectory = path.resolve(__dirname, "..");
const appDirectory = path.join(repositoryDirectory, "app");
const appPackagePath = path.join(appDirectory, "package.json");
const appLockPath = path.join(appDirectory, "package-lock.json");
const generatedDocumentationPath = path.join(
  appDirectory,
  "renderer",
  "documentation",
  "window.html"
);

function fail(message) {
  console.error(`\nSetup check failed: ${message}`);
  console.error("Run `npm run setup` from the repository root and try again.\n");
  process.exit(1);
}

function checkNodeVersion() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(nodeMajor) || nodeMajor < minimumNodeMajor) {
    console.error(
      `Inky development requires Node.js ${minimumNodeMajor} or newer; found ${process.version}.`
    );
    console.error(
      "Install Node.js 20 or newer (or run `nvm use` if you use nvm), then run this command again."
    );
    process.exit(1);
  }
}

function checkRepositoryFiles() {
  if (!fs.existsSync(appPackagePath) || !fs.existsSync(appLockPath)) {
    fail("app/package.json or app/package-lock.json is missing.");
  }
}

function checkInstallation() {
  if (!fs.existsSync(path.join(appDirectory, "node_modules"))) {
    fail("application dependencies have not been installed.");
  }

  const appRequire = createRequire(appPackagePath);
  const appPackage = JSON.parse(fs.readFileSync(appPackagePath, "utf8"));
  const requiredPackages = [
    ...Object.keys(appPackage.dependencies || {}),
    ...Object.keys(appPackage.devDependencies || {})
  ];
  const missingPackages = requiredPackages.filter((packageName) => {
    try {
      appRequire.resolve(packageName);
      return false;
    } catch (_error) {
      return true;
    }
  });

  if (missingPackages.length > 0) {
    fail(`missing packages: ${missingPackages.join(", ")}.`);
  }

  if (!fs.existsSync(generatedDocumentationPath)) {
    fail("generated documentation is missing (the app postinstall step did not finish).");
  }
}

function install() {
  console.log("Installing the locked application dependencies in app/ ...");
  const npmCliPath = process.env.npm_execpath;
  const npmCommand = npmCliPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const npmArguments = npmCliPath
    ? [npmCliPath, "ci", "--prefix", appDirectory]
    : ["ci", "--prefix", appDirectory];
  const result = spawnSync(npmCommand, npmArguments, {
    cwd: repositoryDirectory,
    env: process.env,
    stdio: "inherit",
    shell: !npmCliPath && process.platform === "win32"
  });

  if (result.error) {
    console.error(`Unable to start npm: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  checkInstallation();
  console.log("\nInky is ready. Run `npm start` from the repository root.\n");
}

checkNodeVersion();
checkRepositoryFiles();

if (process.argv.includes("--check")) {
  checkInstallation();
  console.log(`Setup looks good (Node ${process.versions.node}).`);
} else {
  install();
}
