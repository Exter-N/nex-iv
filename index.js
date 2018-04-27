#!/usr/bin/node

if (process.argv[2] !== '-i') {
    require('daemon')();
}

process.chdir(__dirname);

require('./pidfile').create('nex-iv.pid');

require('./shutdown');

require('./compat');

require('./mysql');
require('./bot');
require('./web');
