const { WRITERS, SESSION_SECRET, HTTP_PORT, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = require('./config');

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const btoa = require('btoa');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const nocache = require('nocache');
 
const db = require('./mysql');

const api = express.Router();

const COMMON_LIST_QUERY = `
    SELECT a.id, LEFT(a.body, 140) bodySummary, ak.article_key firstKey
    FROM articles a
    LEFT JOIN (
        SELECT article_id, MIN(id) first_key_id
        FROM article_keys
        GROUP BY article_id
    ) a1k ON a.id = a1k.article_id
    LEFT JOIN article_keys ak ON a1k.first_key_id = ak.id
`;

const NO_SEARCH_LIST_QUERY = `
    ORDER BY firstKey ASC
`;

const SEARCH_LIST_QUERY = `
    WHERE a.id IN (
        SELECT id
        FROM articles
        WHERE body LIKE ?
    )
    OR a.id IN (
        SELECT article_id
        FROM article_keys
        WHERE article_key LIKE ?
    )
    ORDER BY firstKey ASC
`;

function isWriter(discordUser) {
    return discordUser != null && WRITERS.indexOf(discordUser.id) >= 0;
}

api.use(nocache());

api.get('/me', (req, res) => {
    res.json(Object.assign({ id: null, username: null, discriminator: null, mfaEnabled: null, avatar: null }, req.session.discordUser, { writer: isWriter(req.session.discordUser) })).end();
});

api.post('/logout', (req, res) => {
    req.session.discordUser = null;
    res.status(204).end();
});

api.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].indexOf(req.method.toUpperCase()) >= 0 && !isWriter(req.session.discordUser)) {
        res.status(403).end('Forbidden');
    } else {
        next();
    }
});

api.get('/articles', (req, res) => {
    let { search } = req.query;
    db.queryAsync(COMMON_LIST_QUERY + ((search != null) ? SEARCH_LIST_QUERY : NO_SEARCH_LIST_QUERY), (search != null) ? Array(2).fill('%' + search.replace(/[_%\\]/g, ch => '\\' + ch) + '%') : [ ])
        .then(({ result }) => {
            res.json({ articles: result }).end();
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

api.post('/articles', (req, res) => {
    let { body, keys } = req.body;
    body = body.trim().substr(0, 2000);
    keys = keys.map(key => key.trim().substr(0, 191)).filter(key => !!key);
    db.queryAsync('INSERT INTO articles (body) VALUES (?)', [ body ])
        .then(({ result: { insertId: id } }) => {
            let keysPromise;
            if (keys.length > 0) {
                let placeholders = keys.map(() => '(?, ?)').join(', ');
                let params = Array(keys.length * 2);
                for (let i = 0; i < keys.length; ++i) {
                    params[i * 2] = id;
                    params[i * 2 + 1] = keys[i];
                }
                keysPromise = db.queryAsync('INSERT INTO article_keys (article_id, article_key) VALUES ' + placeholders, params)
                    .catch(err => db.queryAsync('DELETE FROM articles WHERE id = ?', [ id ])
                        .then(() => {
                            throw err;
                        }));
            } else {
                keysPromise = Promise.resolve();
            }
            return keysPromise.then(() => {
                res.status(201).json({ id, body, keys }).end();
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

api.get('/articles/:id', (req, res) => {
    let { id } = req.params;
    Promise.all([
        db.queryAsync('SELECT * FROM articles WHERE id = ?', [ id ]),
        db.queryAsync('SELECT * FROM article_keys WHERE article_id = ?', [ id ]),
    ])
        .then(([ { result }, { result: keysResult } ]) => {
            if (!result[0]) {
                res.status(404).end('No Such Article');
                return;
            }
            res.json({
                id: result[0].id,
                body: result[0].body,
                keys: keysResult.map(row => row.article_key),
            }).end();
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

api.put('/articles/:id', (req, res) => {
    let { id } = req.params;
    let { body, keys } = req.body;
    body = body.trim().substr(0, 2000);
    keys = keys.map(key => key.trim().substr(0, 191)).filter(key => !!key);
    db.queryAsync('SELECT id, article_key FROM article_keys WHERE article_id = ?', [ id ])
        .then(({ result }) => {
            let keysToProcess = keys.slice();
            let ids = [];
            for (let row of result) {
                let i = keysToProcess.indexOf(row.article_key);
                if (i >= 0) {
                    keysToProcess.splice(i, 1);
                } else {
                    ids.push(row.id);
                }
            }
            let queries = [
                db.queryAsync('UPDATE articles SET body = ? WHERE id = ?', [ body, id ]),
            ].concat(keysToProcess.slice(0, ids.length).map((key, i) => db.queryAsync('UPDATE article_keys SET article_key = ? WHERE id = ?', [ key, ids[i] ])));
            if (keysToProcess.length > ids.length) {
                let extraKeys = keysToProcess.slice(ids.length);
                let placeholders = extraKeys.map(() => '(?, ?)').join(', ');
                let params = Array(extraKeys.length * 2);
                for (let i = 0; i < extraKeys.length; ++i) {
                    params[i * 2] = id;
                    params[i * 2 + 1] = extraKeys[i];
                }
                queries.push(db.queryAsync('INSERT INTO article_keys (article_id, article_key) VALUES ' + placeholders, params));
            } else if (keysToProcess.length < ids.length) {
                let params = ids.slice(keysToProcess.length);
                let placeholders = params.map(() => '?').join(', ');
                queries.push(db.queryAsync('DELETE FROM article_keys WHERE id IN (' + placeholders + ')', params));
            }
            return Promise.all(queries);
        }).then(() => {
            res.json({ id, body, keys }).end();
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

api.delete('/articles/:id', (req, res) => {
    let { id } = req.params;
    db.queryAsync('DELETE FROM articles WHERE id = ?', [ id ])
        .then(({ result: { affectedRows } }) => {
            if (affectedRows) {
                res.status(204).end();
            } else {
                res.status(404).end('Not Found');
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    store: new MemoryStore({
        checkPeriod: 86400000,
    }),
    secret: SESSION_SECRET,
}));

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));
app.use('/api', api);

app.get('/callback', (req, res) => {
    let { code } = req.query;
    if (!code) {
        res.status(400).end('Bad Request');
        return;
    }
    fetch('https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=' + code + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI), {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET),
        },
    })
        .then(response => {
            if (response.status >= 400) {
                throw new Error('Discord API /oauth2/token returned ' + response.status);
            }
            return response.json();
        })
        .then(json => fetch('http://discordapp.com/api/users/@me', {
            headers: {
                Authorization: json.token_type + ' ' + json.access_token,
            },
        }))
        .then(response => {
            if (response.status >= 400) {
                throw new Error('Discord API /users/@me returned ' + response.status);
            }
            return response.json();
        })
        .then(json => {
            if ('mfa_enabled' in json) {
                json.mfaEnabled = json.mfa_enabled;
                delete json.mfa_enabled;
            }
            req.session.discordUser = json;
            res.redirect('/');
        })
        .catch(err => {
            console.log(err);
            res.status(500).end('Internal Server Error');
        });
});

app.listen(HTTP_PORT);
