import MySQL from '../modules/mysql.js';

const Cases = {};

Cases.loadCases = async () => {
    const cases = [];

    const Casess = await MySQL.Query(`SELECT * FROM cases ORDER BY nomer ASC`);
    for (const casesBD of Casess) {
        cases.push(casesBD);
    }

    return cases;
};

Cases.loadCase = async (id) => {
    const box = await MySQL.Query(`SELECT * FROM cases WHERE id = ${id}`);

    if (!box[0]) return { success: false };

    const items = [];
    const Items = await MySQL.Query(`SELECT * FROM items WHERE case_id = ${box[0]['id']}`);

    let Roulette = [];
    let counter = -1;

    for (const item of Items) {
        const name = item['market_name'].split(' | ');
        let screenName = '';
        if (name[0] && name[1]) {
            screenName = `${name[0]} | ${name[1]}`;
        } else {
            screenName = name[0];
        }
        items.push({
            type: item['type'],
            image: `https://steamcommunity-a.akamaihd.net/economy/image/class/730/${item['classid']}/60fx60f.png`,
            name: screenName
        });


            for (let i = 0; i <= 16; i++) {
                Roulette[counter++] = [name[0], item['type'], item['classid'], name[1]];
            }

    }

    const opens = await MySQL.Query(`SELECT COUNT('*') FROM games WHERE case_id = ${box[0]['id']}`);

    return {
        success: true,
        box: {
            image: box[0]['images'],
            name: box[0]['name'],
            price: box[0]['price'],
            type: box[0]['type'],
            opens: opens[0]['COUNT(\'*\')']
        },
        items: items,
        roulette: shuffle(Roulette)
    }
};

Cases.getCase = async (id) => {
    const box = await MySQL.Query(`SELECT * FROM cases WHERE id = ${id}`);

    if (!box[0]) return false;

    return box[0];
};

Cases.setProfit = async (id, profit) => {
    const box = await Cases.getCase(id);

    if (!box) return false;

    await MySQL.Query(`UPDATE cases SET profit = ${profit} WHERE id = ${box.id}`);
};

const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

module.exports = Cases;