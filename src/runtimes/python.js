const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PythonRuntime {
  constructor(parent, runtime, runtimeDir) {
    this.parent = parent;
    this.plugin = parent.plugin;

    this.default = {
      runtime,
      runtimeDir,
      libraryFolder: 'site-packages',
      packageManager: 'pip',
      packageManagerExtraArgs: '',
      dependenciesPath: 'requirements.txt',
      compatibleRuntimes: [runtime],
      compatibleArchitectures: parent.compatibleArchitectures,
      copyBeforeInstall: [],
      packagePatterns: [
        '!package.json',
        '!package-lock.json',
        '!node_modules/**',
      ],
      layerOptimization: {
        cleanupPatterns: [
          "node_modules/**/*.pyc",
          "node_modules/**/*.md",
        ]
      }
    };

    this.commands = {
      pip: `pip install -r ${this.default.dependenciesPath} -t .`,
    };
  }

  init () {
    const { dependenciesPath } = this.plugin.settings;

    const localpackageJson = path.join(
      process.cwd(),
      dependenciesPath
    );

    try {
      this.localPackage = fs.readFileSync(localpackageJson).toString();
    } catch (e) {
      this.plugin.log(`Error: Can not find ${localpackageJson}!`);
      process.exit(1);
    }
  }

  async isCompatibleVersion (runtime) {
    const osVersion = await this.parent.run('python --version');
    const [runtimeVersion] = runtime.match(/[0-9].[0-9]/);
    return {
      version: osVersion,
      isCompatible: osVersion.startsWith(`Python ${runtimeVersion}`)
    };
  }

  isDiff (depsA, depsB) {
    if (!depsA) {
      return true;
    }
    return depsA !== depsB;
  }

  async hasDependenciesChanges () {
    const remotePackage = await this.plugin.bucketService.downloadDependencesFile();

    let isDifferent = true;

    if (remotePackage) {
      this.plugin.log(`Comparing ${this.default.dependenciesPath} dependencies...`);
      isDifferent = await this.isDiff(remotePackage, this.localPackage);
    }

    return isDifferent;
  }

  async getDependenciesChecksum () {
    return new Promise(function (resolve, reject) {
      const hash = crypto.createHash('md5');
      hash.update(this.localPackage);
      resolve(hash.digest('hex'));
    });
  }
}

module.exports = PythonRuntime;
