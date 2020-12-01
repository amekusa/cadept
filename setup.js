/*!
 * Setup script for development
 * @author amekusa (https://amekusa.com)
 */

const process = require('process');
const cp = require('child_process');
const pkg = require('./package.json');

function run(cmd) {
	return new Promise((resolve, reject) => {
		console.log(`cmd:`, cmd);
		cp.exec(cmd, {}, function(err, out) {
			if (!err) return resolve(out);
			return reject(err);
		});
	});
}

function resolveDeps(deps) {
	return new Promise((resolve, reject) => {
		let names = Object.keys(deps);
		if (!names.length) {
			console.log(`No dependencies.`);
			return resolve()
		}
		console.log(`Resolving dependencies:`, deps, `...`);

		let l, g;
		return Promise.all([
			// populate locals
			run(`npm ls ${names.join(' ')} --json --depth=0`).then(out => {
				l = JSON.parse(out).dependencies || {};
			}).catch(() => { l = {} }),
			// populate globals
			run(`npm ls -g ${names.join(' ')} --json --depth=0`).then(out => {
				g = JSON.parse(out).dependencies || {};
			}).catch(() => { g = {} })

		]).then(() => {
			let exist = Object.assign(g, l);
			console.log(`Existent dependencies:`, exist);

			let installs = [];
			for (let i in deps) {
				let I = deps[i];
				if (i in exist && I.version <= exist[i].version) {
					console.log(`Newer version of '${i}' is already installed:`, `${I.version} > ${exist[i].version}`);
					continue;
				}
				installs.push(i+'@'+I.version);
			}
			return installs;

		}).then(installs => {
			if (!installs.length) {
				console.log(`Nothing to install.`);
				return resolve();
			}
			console.log(`Installing ${installs.join(', ')} ...`);
			return run(`npm i --no-save ${installs.join(' ')}`).then(() => {
				console.log(`Installation complete.`);
				console.log(`All the dependencies have been resolved.`);
			});;

		}).catch(e => {
			console.error(e)
			return reject(e);
		});
	})
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
	});
}

main();
