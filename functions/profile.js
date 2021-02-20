import MySQL from '../modules/mysql.js';
import User  from '../functions/user.js';
import Item  from '../functions/item.js';

const Profile = {};

Profile.getProfile = async (id, localUser) => {
    const user = await User.getUser(id, 'steam');

    if (!user) return { success: false };

    const Games = await MySQL.Query(`SELECT * FROM games WHERE user_id = ${user.id} ORDER BY id DESC`);
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

    if ( (localUser !== null) && (localUser.id === user.id)) {
        return {
            success: true,
            user: {
                id: user.id,
                steamid: user.steamid,
                username: user.username,
                avatar: user.avatar,
                balance: user.balance,
                trade_link: user.trade_link
            },
            items: items
        };
    } else {
        const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE user_id = ${user.id}`);
        return {
            success: true,
            user: {
                id: user.id,
                steamid: user.steamid,
                username: user.username,
                avatar: user.avatar,
                balance: user.balance,
                opens: opens['0']['COUNT(\'*\')']
            },
            items: items
        };
    }
};

Profile.saveLink = async (link, localUser) => {
    if (localUser === null) return { success: false, message: 'Ошибка'};

    const user = await User.getUser(localUser.steamid, 'steam');

    if ( (link.indexOf('token') !== -1) && (link.indexOf('partner') !== -1) ) {
        await MySQL.Query(`UPDATE users SET trade_link = '${link}' WHERE id = ${user.id}`);

        return {success: true, message: 'Ссылка сохранена'};
    } else {
        return { success: false, message: 'Введите ссылку на обмен' };
    }
};

Profile.activatePromo = async (promo, localUser) => {
    if (localUser === null) return { success: false, message: 'Ошибка'};

    const user = await User.getUser(localUser.steamid, 'steam');

    if (promo.length <= 0) return { success: false, message: 'Введите промокод' };

    const PromoBD = await MySQL.Query(`SELECT * FROM promocodes WHERE code = '${promo}'`);
    if (!PromoBD[0]) return { success: false, message: 'Промокод не найден' };

    const PromoUSE = await MySQL.Query(`SELECT * FROM promocodes_used WHERE code_id = ${PromoBD[0]['id']} AND user_id = ${user.id}`);
    if (PromoUSE[0]) return { success: false, message: 'Промокод уже использован вами' };

    if (PromoBD[0]['count'] <= 0) return { success: false, message: 'Промокод закончился' };

    if (PromoBD[0]['type'] === 1) {
        const Opens = await MySQL.Query(`SELECT * FROM games WHERE user_id = ${user.id}`);
        if (!Opens[0]) return { success: false, message: 'Откройте один кейс' };

        await MySQL.Query(`UPDATE promocodes SET count = ${PromoBD[0]['count'] - 1} WHERE code = '${promo}'`);
        await MySQL.Query(`INSERT INTO promocodes_used SET code_id = ${PromoBD[0]['id']}, type = 1, usin = 1, percent = 0, user_id = ${user.id}`);
        await User.updateBalance(user.id, parseInt(user.balance) + parseInt(PromoBD[0]['price']));

        return { success: true, message: `Ваш баланс пополнен на ${PromoBD[0]['price']}Р` };
    } else if (PromoBD[0]['type'] === 2) {

    } else if (PromoBD[0]['type'] === 3) {
        return { success: false, message: 'Нельзя использовать промокод для кейсов' };
    }
};

module.exports = Profile;