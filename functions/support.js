import MySQL from '../modules/mysql.js';
import User  from '../functions/user.js';

const Support = {};

Support.createTicket = async (userId, theme, message) => {
    const user = await User.getUser(userId);

    if (!user) return { success: false, message: 'Ошибка' };
};

module.exports = Support;