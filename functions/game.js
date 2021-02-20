import MySQL from '../modules/mysql.js';
import User  from '../functions/user.js';
import Case  from '../functions/cases.js';
import Redis from 'redis';

const redisClient = Redis.createClient();
const {promisify} = require('util');
const getAsync = promisify(redisClient.get).bind(redisClient);

const Game = {};
let io = {};

Game.openCase = async (userId, data) => {
    const user = await User.getUser(userId);
    if (!user) return { success: false, message: 'Переавторизуйтесь' };

    const box = await Case.getCase(data['id']);
    if (!box) return { success: false, message: 'Ошибка, попробуйте снова' };

    const checkLastOpen = await getAsync(`lastOpen_${user.id}`);
    if (checkLastOpen === '1') return { success: false, message: 'Подождите еще...' };
    redisClient.set(`lastOpen_${user.id}`, '1', 'EX', 3);

    if (user.trade_link === '') return { success: false, message: 'Введите ссылку на обмен' };

    if (box.type === 'promo') {
        let promo = data.promo;
        if (!promo) return { success: false, message: 'Промокод не найден' };
        let promoCode = await MySQL.Query(`SELECT * FROM promocodes WHERE code = '${promo}' AND type = 3 AND count > 0`);
        if (!promoCode[0]) return { success: false, message: 'Промокод не найден' };
        let activate = await MySQL.Query(`SELECT * FROM promocodes_used WHERE user_id = ${user.id} AND code_id = ${promoCode[0].id}`);
        if (activate[0]) return { success: false, message: 'Вы уже активировали промокод' };
        await MySQL.Query(`UPDATE promocodes SET count = ${promoCode[0].count - 1} WHERE id = ${promoCode[0].id}`);
        await MySQL.Query(`INSERT INTO promocodes_used SET code_id = ${promoCode[0].id}, type = 3, usin = 1, percent = 0, user_id = ${user.id}`);
    }

    if ( (user.balance < (box.price * data.opens)) || (box.price < 1) && box.type !== 'promo') return { success: false, message: `Пополните баланс на ${(box.price * data.opens) - user.balance}Р, чтобы открыть кейс` };

    if (data.opens === 1) {
        const item = await getItem(user, box);

        if (!item['game']) return { success: false, message: 'На данный момент, на ботах нет вещей' };

        await User.updateBalance(user.id, parseInt(user.balance) - parseInt(box.price));

        const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE case_id = ${box['id']}`);

        return { success: true, type: data.type, bsh: item['game'].insertId, weapon: item['item'], opens: data.opens, openss: opens['0']['COUNT(\'*\')'] };
    } else {
        if (data.type === 'default') {
            let items = [];
            let selIds = [];
            let allPrice = 0;

            for (let i = 0; i < data.opens; i++) {
                const item = await getItem(user, box);

                if (!item['game']) return { success: false, message: 'На данный момент, на ботах нет вещей' };

                selIds.push(item['game'].insertId);

                items.push({
                    item: item['item'],
                    id: item['game'].insertId
                });

                allPrice += item['item']['price'];
            }

            await User.updateBalance(user.id, parseInt(user.balance) - (parseInt(box.price) * data.opens));

            const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE case_id = ${box['id']}`);

            return { success: true, type: data.type, items: items, opens: data.opens, openss: opens['0']['COUNT(\'*\')'], selIds: selIds, price: allPrice };
        } else {
            let items = [];
            let selIds = [];
            let allPrice = 0;

            for (let i = 0; i < data.opens; i++) {
                const item = await getItem(user, box);

                if (!item['game']) return { success: false, message: 'На данный момент, на ботах нет вещей' };

                selIds.push(item['game'].insertId);

                items.push({
                    item: item['item'],
                    id: item['game'].insertId
                });

                allPrice += item['item']['price'];
            }

            await User.updateBalance(user.id, parseInt(user.balance) - (parseInt(box.price) * data.opens));

            const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE case_id = ${box['id']}`);

            return { success: true, type: data.type, items: items, opens: data.opens, openss: opens['0']['COUNT(\'*\')'], selIds: selIds, price: allPrice };
        }
    }
};

Game.getGame = async id => {
    const game = await MySQL.Query(`SELECT * FROM games WHERE id = ${id}`);

    if (!game[0]) return false;

    return game[0];
};

Game.setIo = (socket) => {
    io = socket;
};

const getItem = async (user, box) => {
    let It = [];
    let profit = 1;

    if (box.profit > box.price) {
        It = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price <= ${parseInt(box.profit)}`);
        if (!It) {
            It = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price <= ${parseInt(box.price)*(randomInteger(15,85)/100)} AND price > 0`);
            profit = 2;
        }
    } else if (box.type === 'promo') {
        It = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price <= ${randomInteger(1,200)} AND price > 0`);
        profit = 2;
    } else {
        It = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price <= ${parseInt(box.price)*randomInteger(15,85)/100} AND price > 0`);
        if (!It) {
            It = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price <= ${parseInt(box.price)*0.6} AND price > 0`);
        }
        profit = 2;
    }

    let items = [];
    for (const item of It) {
        items.push(item);
    }
    if (!items[0] || box.status === 0)  {
        const item = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box.id} AND price > 0`);
        items.push(item[0]);
    }
    shuffle(items);

    const item = items[0];

    const set = {
        user_id: user.id,
        case_id: box.id,
        weapon_id: item.id,
        weapon: JSON.stringify(item),
        price: item.price,
        status: 1,
        created_at: Date.now()
    };
    const game = await MySQL.Query(`INSERT INTO games SET ?`, set);

    if (profit === 1 && item.price > box.price) {
        await Case.setProfit(box.id, parseInt(box.profit) - parseInt(item.price));
    } else {
        await Case.setProfit(box.id, parseInt(box.profit) + parseInt(parseInt(box.price) - item.price));
    }

    await MySQL.Query(`UPDATE users SET profit = ${user.profit + (item.price - box.price)} WHERE id = ${user.id}`);

    io.sockets.emit('game.liveDrop', {
        id: game.insertId,
        user_id: user.steamid,
        userName: user.username,
        market_name: item.market_name,
        type: item.type,
        classid: item.classid,
        caseimage: box.images
    });

    return {
        item: item,
        game: game
    }
};

const randomInteger = (min, max) => {
    let rand = min + Math.random() * (max + 1 - min);
    rand = Math.floor(rand);
    return rand;
};
const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

module.exports = Game;