import Express      from 'express';
import Session      from 'express-session';
import ConnectRedis from 'connect-redis';
import Redis        from 'redis';
import Settings     from '../variables/settings.js';

const redisClient = Redis.createClient();
const RedisStore = ConnectRedis(Session);
const dbSession = new RedisStore({
    client: redisClient,
    host: 'localhost',
    port: 27017,
    prefix: 'opencase_',
    disableTTL: true
});

const Server = {};

Server.Session = Session({
    resave: true,
    saveUninitialized: true,
    key: 'SID', // this will be used for the session cookie identifier
    secret: 'asdkajdulodyqwuelqwd',
    store: dbSession
});

Server.app = Express();
Server.app.use(Server.Session);

Server.app.get('/', function (req, res) {
    res.redirect(`${Settings.ssl}${Settings.domainBackend}`);
});

Server.app.listen(3000);

module.exports = Server;

setTimeout( () => {
    require('../auth/app.js');
    require('./socket.js');
}, 1000);