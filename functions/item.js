import MySQL from '../modules/mysql.js';
import User from '../functions/user.js';
import Game from '../functions/game.js';
import Redis from 'redis';
import rp from 'request-promise';

const redisClient = Redis.createClient();
const {promisify} = require('util');
const getAsync = promisify(redisClient.get).bind(redisClient);

const Item = {};
let io = {};


Item.sell = async (userId, data) => {
    const user = await User.getUser(userId);
    const game = await Game.getGame(data.bsh);

    if (data.type !== 'seli') {
        const checkLastOpen = await getAsync(`lastSell_${user.id}`);
        if (checkLastOpen === '1') return {success: false, message: 'Подождите еще...'};
        redisClient.set(`lastSell_${user.id}`, '1', 'EX', 2);
    }

    if (!user || !game) return {success: false, message: 'Ошибка, попробуйте снова'};
    if (parseInt(game.status) === 1 && parseInt(game.buy) === 0 && parseInt(game.send) === 0 && parseInt(game.user_id) === parseInt(user.id)) {
        const item = await Item.getItem(game.weapon_id, game.case_id);

        if (!item) return {success: false, message: 'Ошибка, попробуйте снова'};

        await MySQL.Query(`UPDATE games SET buy = 1 WHERE id = ${game.id}`);
        await User.updateBalance(user.id, parseInt(user.balance) + parseInt(game.price));
        if (data.type !== 'seli') {
            return {success: true, message: 'Вещь продана!', type: data.type, id: game.id, price: item.price};
        } else {
            return {success: true, message: 'Вещь продана!', type: 'wai', id: game.id, price: item.price};
        }
    } else {
        return {success: false, message: 'Ошибка доступа'};
    }
};

Item.sellMost = async (userId, data) => {
    const user = await User.getUser(userId);

    let price = 0;

    for (let id of data.items) {
        const game = await Game.getGame(id);

        if (!user || !game) continue;

        if (parseInt(game.status) === 1 && parseInt(game.buy) === 0 && parseInt(game.send) === 0 && parseInt(game.user_id) === parseInt(user.id)) {
            const item = await Item.getItem(game.weapon_id, game.case_id);

            if (!item) continue;

            await MySQL.Query(`UPDATE games SET buy = 1 WHERE id = ${game.id}`);

            price += game.price;
        }
    }

    await User.updateBalance(user.id, parseInt(user.balance) + parseInt(price));

    return {success: true, message: 'Вещи проданы!', type: 'wai', price: price};
};

Item.giveItem = async (userId, id) => {
    const user = await User.getUser(userId);
    const config = await MySQL.Query(`SELECT * FROM settings WHERE id = 1`);
    const APIKEY = config[0]['csgo_tm'];

    let item = [];

    const checkLastOpen = await getAsync(`lastGive_${user.id}`);
    if (checkLastOpen === '1') return {success: false, message: 'Подождите еще...'};
    redisClient.set(`lastGive_${user.id}`, '1', 'EX', 10);

    const game = await Game.getGame(id);

    if (game.user_id !== user.id) return {success: false, message: 'Попробуйте еще раз'};
    if (user.trade_link === '') return {success: false, message: 'Введите ссылку на обмен'};

    if (parseInt(game.status) === 1 && parseInt(game.buy) === 0 && parseInt(game.send) === 0) {
        item = await Item.getItem(game.weapon_id, game.case_id);

        await MySQL.Query(`UPDATE games SET send = 1 WHERE id = ${game.id}`);

        const names = [
            'Закаленное в боях',
            'Немного поношенное',
            'Поношенное',
            'После полевых испытаний',
            'Прямо с завода',
            'Не покрашено'
        ];

        let i_classid = 0;
        let i_instanceid = 0;
        let price = 0;

        if (game.case_id === 0) {
            let request = await rp.get(`https://market.csgo.com/api/SearchItemByName/${encodeURI(item.market_hash_name)}/?key=${APIKEY}`);
            request = JSON.parse(request);

            if (request.success) {
                if (typeof (request['list'][0]) !== "undefined") {
                    i_classid = request['list'][0]['i_classid'];
                    i_instanceid = request['list'][0]['i_instanceid'];
                    price = request['list'][0]['price'];
                }
            }
        } else {
            for (let i = 0; i < 5; i++) {
                let request = await rp.get(`https://market.csgo.com/api/SearchItemByName/${encodeURI(item.market_name + ' (' + names[i] + ')')}/?key=${APIKEY}`);
                request = JSON.parse(request);

                if (request.success) {
                    if (typeof (request['list'][0]) !== "undefined") {
                        i_classid = request['list'][0]['i_classid'];
                        i_instanceid = request['list'][0]['i_instanceid'];
                        price = request['list'][0]['price'];
                        break;
                    }
                }
            }
        }

        if (i_classid === 0 && i_instanceid === 0 && price === 0) {
            await MySQL.Query(`UPDATE games SET send = 0 WHERE id = ${game.id}`);
            return {
                success: false,
                message: 'К сожалению в данный момент мы не смогли подобрать нужный лот для покупки на market.csgo.com, попробуйте позже!'
            };
        } else {
            const splitPartner = user.trade_link.split('?partner=');
            const partnerSplit = splitPartner[1].split('&token');
            const splitToken = partnerSplit[1].split('=');
            const partner = partnerSplit[0];
            const token = splitToken[1];

            let buy = await rp.get(`https://market.csgo.com/api/Buy/${i_classid}_${i_instanceid}/${parseInt(price)}//?key=${APIKEY}&partner=${partner}&token=${token}`);
            buy = JSON.parse(buy);

            if (buy.result === 'ok') {
                await MySQL.Query(`UPDATE games SET trade_id = ${buy.id} WHERE id = ${game.id}`);
                return {
                    success: true,
                    message: 'Вывод оформлен, ожидайте обмена',
                    trade_id: buy.id,
                    id: game.id
                }
            } else {
                await MySQL.Query(`UPDATE games SET send = 0 WHERE id = ${game.id}`);
                return {
                    success: false,
                    message: 'К сожалению в данный момент мы не смогли подобрать нужный лот для покупки на market.csgo.com, попробуйте позже!'
                };
            }
        }
    } else {
        return {success: false, message: 'Ошибка доступа'};
    }
};

Item.getItem = async (id, caseId) => {
    let item = [];
    if (caseId === 0) {
        item = await MySQL.Query(`SELECT * FROM all_items WHERE id = ${id}`);
    } else {
        item = await MySQL.Query(`SELECT * FROM items WHERE id = ${id}`);
    }

    if (!item[0]) return false;

    return item[0];
};

Item.setIo = (socket) => {
    io = socket;
};

Item.checkStatus = () => {
    setInterval(async () => {
        const request = await rp.get('https://market.csgo.com/api/Trades/?key=hWd8oqK05eye3rG12R93Q2gfCOL5rEa');
        const data = JSON.parse(request);

        for (let item of data) {
            const bd = await MySQL.Query(`SELECT * FROM games WHERE trade_id = ${item['ui_id']}`);
            if (bd[0]) {
                if (item['ui_status'] === "4") {
                    io.sockets.emit('item.updateStatus', {
                        id: bd[0]['id'],
                        status: 4,
                        userID: bd[0]['user_id']
                    });
                }
                if (item['ui_status'] === "3") {
                    io.sockets.emit('item.updateStatus', {
                        id: bd[0]['id'],
                        status: 3,
                        userID: bd[0]['user_id']
                    });
                }
            }
        }
    }, 10000);
    setInterval(async () => {
        const request = await rp.get(`https://market.csgo.com/api/OperationHistory/${parseInt(new Date().getTime() / 1000) - (86400 * 2)}/${parseInt(new Date().getTime() / 1000)}/?key=hWd8oqK05eye3rG12R93Q2gfCOL5rEa`);
        const data = JSON.parse(request);

        if (data.success) {
            for (let item of data.history) {
                try {
                    if (item.stage === "7" || item.stage === "5") {
                        await MySQL.Query(`UPDATE games SET send = 0 WHERE trade_id = ${item['item']}`);
                    }
                    if (item.stage === "2") {
                        const bd = await MySQL.Query(`SELECT * FROM games WHERE trade_id = ${item['item']} AND status = 1`);
                        if (bd[0]) {
                            await MySQL.Query(`UPDATE games SET status = 2 WHERE trade_id = ${item['item']}`);
                            io.sockets.emit('item.updateStatus', {
                                id: bd[0]['id'],
                                price: bd[0]['price'],
                                status: 1,
                                userID: bd[0]['user_id']
                            });
                        }
                    }
                } catch (e) {

                }
            }
        }
    }, 30000);
};

module.exports = Item;