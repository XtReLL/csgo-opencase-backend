import MySQL from '../modules/mysql.js';

const User = {};

User.getUser = async (id, type = 'id') => {
    let user = [];
    if (type === 'id') {
        user = await MySQL.Query(`SELECT * FROM users WHERE id = ${id}`);
    } else {
        user = await MySQL.Query(`SELECT * FROM users WHERE steamid = ${id}`);
    }

    if (!user[0]) return false;

    return user[0];
};

User.updateBalance = async (id, balance) => {
    await MySQL.Query(`UPDATE users SET balance = ${balance} WHERE id = ${id}`);

    return true;
};

User.getBalance = async (id) => {
    const user = await User.getUser(id);

    return user['balance'];
};

module.exports = User;