const fs = require('fs');
const path = require('path');

function create(name) {
    name = path.resolve(name);
    fs.writeFileSync(name, '' + process.pid);
    process.on('exit', () => {
        try {
            fs.unlinkSync(name);
        } catch (e) {
            // ignore, it'll just leave a "dead" pid file behind
        }
    });
}

exports.create = create;
