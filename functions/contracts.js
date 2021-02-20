import MySQL from '../modules/mysql.js';
import User  from '../functions/user.js';
import Item  from '../functions/item.js';

const Contracts = {};

let Io = {};

Contracts.load = async (userId) => {
    const user = await User.getUser(userId);

    if (!user) return { success: false, message: 'Ошибка' };

    const Games = await MySQL.Query(`SELECT * FROM games WHERE user_id = ${user.id} AND buy = 0 AND send = 0 ORDER BY id DESC`);
    let items = [];

    for (let game of Games) {
        const item = await Item.getItem(game.weapon_id, game.case_id);
        let name = '';
        name = item['market_name'].split(' | ');

        items.push({
            id: parseInt(game.id),
            case_id: parseInt(game.case_id),
            buy: parseInt(game.buy),
            send: parseInt(game.send),
            item: {
                name: name,
                price: item.price,
                classid: item.classid,
                type: item.type
            }
        });
    }

    return { success: true, items: items }
};

Contracts.create = async (userId, items) => {
    const user = await User.getUser(userId);

    if (!user) return { success: false, message: 'Ошибка' };

    if (items.length < 3) return { success: false, message: 'Нужно выбрать 3 предмета' };

    let price = 0;
    for (let item of items) {
        const gameBD = await MySQL.Query(`SELECT * FROM games WHERE user_id = ${user.id} AND id = ${item.id} AND send = 0 AND buy = 0`);
        if (!gameBD[0]) return { success: false, message: 'Ошибка доступа, попробуйте снова' };
        price += gameBD[0]['price'];
    }

    let min = Math.floor(price * 0.1);
    let max = Math.floor(price * 3);
    if (min <= 0) {
        min = 0;
    }
    if (max <= 0) {
        max = 1;
    }
    const chance = randomInteger(1,100);
    if (chance <= 31) {
        max = price + 2;
    }
    const winItem = await MySQL.Query(`SELECT * FROM all_items WHERE price >= ${min} AND price <= ${max} ORDER BY rand() LIMIT 1`);
    if (!winItem[0]) return { success: false, message: 'Попробуйте снова' };

    for (let item of items) {
        const gameBD = await MySQL.Query(`SELECT * FROM games WHERE user_id = ${user.id} AND id = ${item.id} AND send = 0 AND buy = 0`);
        if (!gameBD[0]) return { success: false, message: 'Попробуйте снова' };
        await MySQL.Query(`DELETE FROM games WHERE id = ${gameBD[0]['id']}`);
    }

    const insert = {
        user_id: user.id,
        case_id: 0,
        weapon_id: winItem[0]['id'],
        weapon: JSON.stringify(winItem[0]),
        price: winItem[0]['price'],
        status: 1,
        created_at: Date.now()
    };

    const newGame = await MySQL.Query(`INSERT INTO games SET ?`, insert);

    Io.sockets.emit('game.liveDrop', {
        id: newGame.insertId,
        user_id: user.steamid,
        userName: user.username,
        market_name: winItem[0].market_name,
        type: winItem[0].type,
        classid: winItem[0].classid,
        caseimage: ''
    });

    return {
        success: true,
        item: {
            classid: winItem[0]['classid'],
            cost: winItem[0]['price'],
            name: winItem[0]['market_name'],
            id: newGame['insertId']
        }
    }
};

Contracts.setIo = (socket) => {
    Io = socket;
};

const randomInteger = (min, max) => {
    let rand = min + Math.random() * (max + 1 - min);
    rand = Math.floor(rand);
    return rand;
};

module.exports = Contracts;