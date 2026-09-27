const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { spawnSync } = require("child_process");

const minimumNodeVersion = [22, 12, 0];
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
  const currentVersion = process.versions.node.split(".").map(Number);
  const isSupported = minimumNodeVersion.every((minimumPart, index) => {
    const earlierPartsMatch = minimumNodeVersion
      .slice(0, index)
      .every((part, earlierIndex) => currentVersion[earlierIndex] === part);
    return !earlierPartsMatch || currentVersion[index] >= minimumPart;
  });

  if (!isSupported) {
    console.error(
      `Inky development requires Node.js ${minimumNodeVersion.join(".")} or newer; found ${process.version}.`
    );
    console.error(
      "Install a supported Node.js version (or run `nvm use` if you use nvm), then run this command again."
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

  try {
    const electronExecutablePath = appRequire("electron");
    if (
      typeof electronExecutablePath !== "string" ||
      !fs.existsSync(electronExecutablePath)
    ) {
      fail("the Electron runtime binary is missing.");
    }
  } catch (_error) {
    fail("the Electron runtime binary is missing.");
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
