import Server    from './app.js';
import MySQL     from '../modules/mysql.js';
import Http      from 'http';
import SocketIO  from 'socket.io';
import Cases     from '../functions/cases.js';
import Game      from '../functions/game.js';
import User      from "../functions/user.js";
import Item      from '../functions/item.js';
import Profile   from '../functions/profile.js';
import Contracts from '../functions/contracts.js';
import strftime  from 'strftime';

const server = Http.createServer(Server.app),
    io = SocketIO.listen(server);

server.listen(8080);

io.use((socket, next) => {
    Server.Session(socket.handshake, {}, next);
});

let online = 0;

Game.setIo(io);
Item.setIo(io);
Contracts.setIo(io);
Item.checkStatus();

io.on('connection', async (socket) => {
    const userPassport = socket.handshake.session.passport &&
        socket.handshake.session.passport.user;

    let user = null;

    online++;
    socket.emit('online', online);

    if (userPassport !== undefined) {
        const userBD = await MySQL.Query(`SELECT * FROM users WHERE steamid = ${userPassport['id']}`);

        if (userBD[0]) {
            user = userBD[0];
            socket.emit('auth', {
                auth: true,
                user: userBD[0]
            });
        } else {
            socket.emit('auth', {
                auth: false
            })
        }
    } else {
        socket.emit('auth', {
            auth: false
        })
    }

    socket.on('cases.getLoad', async () => {
        const cases = await Cases.loadCases();
        return socket.emit('cases.load', cases);
    });

    socket.on('cases.loadCase', async (id) => {
        const box = await Cases.loadCase(id);
        return socket.emit('cases.getCase', box);
    });

    socket.on('game.open', async (data) => {
        const open = await Game.openCase(user.id, data);

        if (open.success) {
            return socket.emit('game.openCase', open);
        } else {
            return await notify(open);
        }
    });

    socket.on('item.sell', async data => {
        const sell = await Item.sell(user.id, data);

        if (sell.success) {
            return socket.emit('item.selling', sell);
        } else {
            return await notify(sell);
        }
    });

    socket.on('item.sellMost', async data => {
        const sell = await Item.sellMost(user.id, data);

        if (sell.success) {
            return socket.emit('item.selling', sell);
        } else {
            return await notify(sell);
        }
    });

    socket.on('item.give', async data => {
        const Give = await Item.giveItem(user.id, data.bsh);

        if (Give.success) {
            return socket.emit('item.trade', Give);
        } else {
            return await notify(Give);
        }
    });

    socket.on('user.updateBalance', async (data) => {
        let id = data.id;
        if (user !== null) id = user.id;
        const balance = await User.getBalance(id);

        return socket.emit('user.updatesBalance', {
            balance: balance,
            id: id
        });
    });

    socket.on('app.getStatistic', async data => {
        const users = await MySQL.Query(`SELECT COUNT('*') FROM users`);
        const opens = await MySQL.Query(`SELECT COUNT('*') FROM games`);
        return socket.emit('app.loadStatistic', {
           users: users[0]['COUNT(\'*\')'],
           opens: opens[0]['COUNT(\'*\')']
        });
    });

    socket.on('app.getLiveDrop', async () => {
        let liveDrop = [];
        const games = await MySQL.Query(`SELECT * FROM games ORDER BY id DESC LIMIT 30`);

        for (const game of games) {
            const user = await User.getUser(game.user_id);
            const box = await Cases.getCase(game.case_id);
            const item = await Item.getItem(game.weapon_id, game.case_id);
            liveDrop.push({
                id: game.id,
                user_id: user.steamid,
                userName: user.username,
                market_name: item.market_name,
                type: item.type,
                classid: item.classid,
                caseimage: box.images
            });
        }

        return socket.emit('app.liveDrop', liveDrop);
    });

    socket.on('user.getProfile', async id => {
        const getProfile = await Profile.getProfile(id, user);

        return socket.emit('user.profile', getProfile);
    });

    socket.on('user.saveTradeLink', async link => {
        const saveLink = await Profile.saveLink(link, user);

        return socket.emit('user.saveLink', saveLink);
    });

    socket.on('user.activatePromo', async promo => {
        const activatePromo = await Profile.activatePromo(promo, user);

        return socket.emit('user.activePromo', activatePromo);
    });

    socket.on('contracts.load', async () => {
        const Load = await Contracts.load(user.id);

        if (Load.success) {
            return socket.emit('contracts.loads', Load);
        } else {
            return await notify(Load);
        }
    });

    socket.on('contracts.create', async items => {
       const Create = await Contracts.create(user.id, items);

       return socket.emit('contracts.creates', Create);
    });

    socket.on('live.getLoad', async () => {
        let returnLives = [];
        const lives = await MySQL.Query(`SELECT * FROM games WHERE status = 2 ORDER BY id DESC LIMIT 20`);

        const strftimeIT = strftime.timezone(180);

        for (let live of lives) {
            const userBD = await User.getUser(live.user_id);
            const item = await Item.getItem(live.weapon_id, live.case_id);
            const date = strftimeIT('%d-%m-%y %H:%M:%S', new Date(parseInt(live.created_at)));

            returnLives.push({
                id: live.trade_id,
                user: {
                    avatar: userBD.avatar,
                    username: userBD.username
                },
                item: {
                    classid: item.classid,
                    market_name: item.market_name
                },
                time: date
            });
        }

        return socket.emit('live.load', returnLives);
    });

    socket.on('top.getLoad', async () => {
        let returnTop = [];
        const top = await MySQL.Query(`SELECT * FROM users ORDER BY profit DESC LIMIT 3`);
        let place = 1;

        for (let t of top) {
            const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE user_id = ${t.id}`);

            returnTop.push({
                id: t.steamid,
                avatar: t.avatar,
                username: t.username,
                profit: t.profit,
                opens: opens['0']['COUNT(\'*\')'],
                place: place
            });
            place++;
        }

        return socket.emit('top.load', returnTop);
    });

    socket.on('disconnect', () => {
        online--;
        socket.emit('online', online);
    });

    const notify = async (data) => {
        let type = 'error';
        if (data.success) type = 'success';

        socket.emit('notify', {
            userId: user['id'],
            type: type,
            message: data.message
        });

        return true;
    };
});