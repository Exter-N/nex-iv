const { MYSQL_PARAMS } = require('./config');

const mysql = require('mysql');

const db = mysql.createConnection(MYSQL_PARAMS);

db.query('SELECT 1');
const keepAlive = setInterval(() => {
    db.query('SELECT 1');
}, 60000);

require('./shutdown').register(() => new Promise((resolve, reject) => {
    clearInterval(keepAlive);
    db.end(err => {
        if (err) {
            reject(err);
        } else {
            resolve();
        }
    });
}));

db.queryAsync = function (query, params = [ ]) {
    return new Promise((resolve, reject) => {
        this.query(query, params, (err, result, fields) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({ result, fields });
        });
    });
};

module.exports = db;
