var actions = [];

function register(action) {
    actions.push(action);
}

function unregister(action) {
    let i = actions.indexOf(action);
    if (i >= 0) {
        actions.splice(i, 1);
    }
}

function shutdown() {
    return Promise.all(actions.map(action => action())).catch(err => {
        console.log(err);
        process.exit(1);
    });
}

function panic() {
    setTimeout(() => { process.exit(1); }, 1000);
    try {
        shutdown().then(() => process.exit(1));
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

function onShutdownSignal() {
    shutdown().then(() => process.exit(0));
}

process.on('SIGINT', onShutdownSignal);
process.on('SIGHUP', onShutdownSignal);
process.on('SIGTERM', onShutdownSignal);
process.on('uncaughtException', e => {
    console.log(e);
    try {
        require('fs').writeFileSync('crash.log', e + '\n');
    } catch (ex) {
        // don't log :(
    }
    panic();
});

shutdown.register = register;
shutdown.unregister = unregister;
shutdown.panic = panic;

module.exports = shutdown;
