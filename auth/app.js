import Server        from '../express/app.js';
import Passport      from 'passport';
import SteamStrategy from 'passport-steam';
import Settings      from '../variables/settings.js';
import MySQL         from '../modules/mysql.js';

Passport.serializeUser(async (user, done) => {
    if (user['provider'] === 'steam') {
        const searchUser = await MySQL.Query(`SELECT * FROM users WHERE steamid = ${user['id']}`);

        if (!searchUser[0]) {
            const newUser = {
                steamid:    user['id'],
                username:   user['displayName'],
                avatar:     user['photos'][2]['value'],
                balance:    0.00,
                created_at: Date.now()
            };
            await MySQL.Query('INSERT INTO users SET ?', newUser);
        } else {
            await MySQL.Query(`UPDATE users SET username = '${user['displayName']}', avatar = '${user['photos'][2]['value']}' WHERE steamid = ${user['id']}`);
        }
        done(null, user);
    }
});

Passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

Passport.use(new SteamStrategy({
        returnURL:`${Settings.ssl}${Settings.domainFrontend}/auth/steam/return`,
        realm: `${Settings.ssl}${Settings.domainFrontend}`,
        apiKey: ''
    },
    function(identifier, profile, done) {
        process.nextTick(function () {
            return done(null, profile);
        });
    }
));

Server.app.use(Passport.initialize());
Server.app.use(Passport.session());

Server.app.get('/logout', function (req, res) {
    req.logout();
    res.redirect(`${Settings.ssl}${Settings.domainFrontend}`);
});

Server.app.get('/auth/steam', Passport.authenticate('steam'));

Server.app.get('/auth/steam/return',
    Passport.authenticate('steam', {
        successRedirect: '/',
    })
);