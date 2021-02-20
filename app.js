import Logger from './modules/logger.js';
import MySQL from './modules/mysql.js';
import Settings from './variables/settings.js';
import rp from 'request-promise';
import csv from 'csvtojson';

MySQL.Query('SELECT * FROM settings').then((settings) => {

    Settings.namesite = settings[0].namesite;
    Settings.appId = settings[0].appId;
    Settings.ssl = settings[0].ssl;
    Settings.domainFrontend = settings[0].domainFrontend;
    Settings.domainBackend = settings[0].domainBackend;

});

const updatePrices = async () => {
    let request = await rp.get('https://market.csgo.com/itemdb/current_730.json');
    request = JSON.parse(request);
    let request_2 = await rp.get(`https://market.csgo.com/itemdb/${request['db']}`);
    csv({
        noheader: true,
        output: "csv"
    })
        .fromString(request_2)
        .then(async (csvRow) => {
            for (let csvv of csvRow) {
                let item = csvv[0].split(';');
                if (item[0] !== 'c_classid') {
                    if (typeof item[11] !== "undefined") {
                        let type = item[5].slice(1, -1);
                        let price = parseInt(item[2] / 100);
                        if (type !== 'базового класса') {
                            const itemMin = await checkMinItem(item, csvRow, price);
                            let market_hash_name = '';
                            if (itemMin[11] === '') {
                                market_hash_name = itemMin[12].slice(1, -1);
                            } else {
                                market_hash_name = itemMin[11].slice(1, -1);
                            }
                            await MySQL.Query(`UPDATE items SET price = ${parseInt(itemMin[2] / 100)} WHERE market_hash_name = "${market_hash_name}"`);
                        }
                    }
                }
            }
        });
};

const getItems = async () => {
    let request = await rp.get('https://market.csgo.com/itemdb/current_730.json');
    request = JSON.parse(request);
    let request_2 = await rp.get(`https://market.csgo.com/itemdb/${request['db']}`);
    csv({
        noheader: true,
        output: "csv"
    })
        .fromString(request_2)
        .then(async (csvRow) => {
            for (let csvv of csvRow) {
                let item = csvv[0].split(';');
                if (item[0] !== 'c_classid') {
                    if (typeof item[11] !== "undefined") {
                        let market_name = item[10].slice(1, -1);
                        market_name = market_name.split('(');
                        let market_hash_name = '';
                        if (item[11] === '') {
                            market_hash_name = item[12].slice(1, -1);
                        } else {
                            market_hash_name = item[11].slice(1, -1);
                        }
                        let type = item[5].slice(1, -1);
                        let price = parseInt(item[2] / 100);
                        if (type !== 'базового класса') {
                            const selectItem = await MySQL.Query(`SELECT * FROM all_items WHERE market_hash_name = "${market_hash_name}"`);
                            if (!selectItem[0]) {
                                const itemMin = await checkMinItem(item, csvRow, price);
                                let market_name = itemMin[10].slice(1, -1);
                                market_name = market_name.split('(');
                                let market_hash_name = '';
                                if (itemMin[11] === '') {
                                    market_hash_name = itemMin[12].slice(1, -1);
                                } else {
                                    market_hash_name = itemMin[11].slice(1, -1);
                                }
                                let type = '';
                                if (itemMin[5].indexOf('"') !== -1) {
                                    type = itemMin[5].slice(1,-1);
                                } else {
                                    type = itemMin[5];
                                }
                                await MySQL.Query(`INSERT INTO all_items SET market_name = "${market_name[0]}", market_hash_name = "${market_hash_name}",
                                    classid = ${itemMin[0]}, instanceid = ${itemMin[1]}, price = ${parseInt(itemMin[2] / 100)}, type = '${getRarity(type)}'`);
                            }
                        }
                    }
                }
            }
        })
};

const checkMinItem = async (itemD, items, price) => {
    let old_market_hash_name = '';
    if (itemD[11] === '') {
        old_market_hash_name = itemD[12].slice(1, -1);
    } else {
        old_market_hash_name = itemD[11].slice(1, -1);
    }
    let returnItem = itemD;
    await asyncForEach((items), async item1 => {
        let item = item1[0].split(';');
        if (item[0] !== 'c_classid') {
            if (typeof item[11] !== "undefined") {
                let market_name = item[10].slice(1, -1);
                market_name = market_name.split('(');
                let market_hash_name = '';
                if (item[11] === '') {
                    market_hash_name = item[12].slice(1, -1);
                } else {
                    market_hash_name = item[11].slice(1, -1);
                }
                let type = item[5].slice(1, -1);

                if (market_hash_name === old_market_hash_name) {
                    let price1 = parseInt(item[2] / 100);
                    if (parseInt(price1.toString()) < parseInt(price.toString())) {
                        returnItem = item;
                    }
                }
            }
        }
    });

    return returnItem;
};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const getRarity = (typeRus) => {
    let rarity = 'common';

    let type = typeRus.toLowerCase();

    switch (type) {
        case 'армейское качество':
            rarity = 'milspec';
            break;
        case 'нож':
            rarity = 'rare';
            break;
        case 'запрещенное':
            rarity = 'restricted';
            break;
        case 'засекреченное':
            rarity = 'classified';
            break;
        case 'тайное':
            rarity = 'covert';
            break;
        case 'ширпотреб':
            rarity = 'common';
            break;
        case 'промышленное качество':
            rarity = 'common';
            break;
        case '★':
            rarity = 'rare';
            break;
    }

    return rarity;
};


setTimeout(async () => {
    require('./express/app.js');
}, 1000);

setInterval(async () => {
    await updatePrices();
}, 60000 * 240);