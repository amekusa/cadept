/*!
 * Setup script for development
 * @author amekusa (https://amekusa.com)
 * @version 1.1.0
 */

const process = require('process');
const cp = require('child_process');
const pkg = require('./package.json');

const conf = {
	dryRun: ''
};

// parse command line arguments
for (let arg of process.argv) {
	switch (arg) {
	case '--dry-run':
		conf.dryRun = ' --dry-run';
		break;
	}
}

function run(cmd) {
	return new Promise((resolve, reject) => {
		console.log(`cmd:`, cmd);
		cp.exec(cmd, {}, function(err, out) {
			if (!err) return resolve(out);
			return reject(err);
		});
	});
}

async function resolveDeps(deps) {
	let names = Object.keys(deps);
	if (!names.length) {
		console.log(`No dependencies.`);
		return;
	}
	console.log(`Resolving dependencies:`, deps, `...`);

	// populate existent packages
	let l, g;
	await Promise.all([
		// locals
		run(`npm ls ${names.join(' ')} --json --depth=0`).then(out => {
			l = JSON.parse(out).dependencies || {};
		}).catch(() => { l = {} }),
		// globals
		run(`npm ls -g ${names.join(' ')} --json --depth=0`).then(out => {
			g = JSON.parse(out).dependencies || {};
		}).catch(() => { g = {} })
	]);
	let exist = Object.assign(g, l);
	console.log(`Existent dependencies:`, exist);

	// install semver
	console.log(`Installing semver ...`);
	await run(`npm i --no-save semver`);
	console.log(`semver installed.`);
	const semver = require('semver');

	// calculate which packages should be installed
	let installs = [];
	for (let i in deps) {
		let I = deps[i];
		if (!I.version) {
			console.warn(`The dependency '${i}' is skipped due to a lack of 'version' info.`);
			continue;
		}
		if (i in exist && semver.satisfies(exist[i].version, I.version)) {
			console.log(`The satisfied version of '${i}' already exists.`, `\n - Existent: ${exist[i].version}`, `\n - Required: ${I.version}`);
			continue;
		}
		installs.push(i+'@'+I.version);
	}
	if (!installs.length) {
		console.log(`Nothing to install.`);
		return;
	}

	// do install
	console.log(`Installing ${installs.join(', ')} ...`);
	return run(`npm i --no-save${conf.dryRun} ${installs.join(' ')}`).then(() => {
		console.log(`Installation complete.`);
		console.log(`All the dependencies have been resolved.`);

	}).catch(e => {
		console.error(e)
		throw new Error(`Installation failed.`);
	});
}

function main() {
	let config = pkg._setup;
	if (!config) {
		console.warn(`Configuration missing.`);
		process.exit(1);
	}
	console.log(`Running setup process for development ...`)
	resolveDeps(config.deps).then(() => {
		console.log(`Setup complete.`);
	}).catch(e => {
		console.error(e);
		console.error(`Setup failed.`);
		process.exit(1);
	});
}

main();
