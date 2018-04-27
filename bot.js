const { RESTRICT_TO_GUILDS, TOKEN } = require('./config');

const Discord = require('discord.js');
const client = new Discord.Client();
const db = require('./mysql');

require('./shutdown').register(() => client.destroy());

const INFO_COMMAND = /^info(?:\s+|-)(.*)$/i;
const INFO_NOT_FOUND = "Données indisponibles ou corrompues.";

client.on('message', msg => {
    let match = INFO_COMMAND.exec(msg.content);
    if (match) {
        db.query('SELECT a.body FROM articles a JOIN article_keys ak ON a.id = ak.article_id WHERE ak.article_key = ?', match[1], (err, result) => {
            msg.channel.send(result[0] ? result[0].body : INFO_NOT_FOUND);
        });
    }
});

if (RESTRICT_TO_GUILDS) {
    const guilds = Array.isArray(RESTRICT_TO_GUILDS) ? RESTRICT_TO_GUILDS : [ RESTRICT_TO_GUILDS ];
    client.on('ready', () => {
        for (let guild of client.guilds.values()) {
            if (guilds.indexOf(guild.id) < 0) {
                guild.leave();
            }
        }
    });
    client.on('guildCreate', guild => {
        if (guilds.indexOf(guild.id) < 0) {
            guild.leave();
        }
    });
}

client.login(TOKEN);
