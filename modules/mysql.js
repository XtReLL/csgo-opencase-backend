import MySQL    from 'mysql';
import Config   from '../variables/config.js';

// Additional function

const pool = MySQL.createPool({
    connectionLimit: 10,
    database: Config.bd.table,
    host: Config.bd.server,
    user: Config.bd.username,
    password: Config.bd.password
});

// Export function

const Mysql = {
    Query: function (sql, props) {
        return new Promise(function (resolve, reject) {
            pool.getConnection(function (err, connection) {
                connection.query(
                    sql, props,
                    function (err, res) {
                        if (err) reject(err);
                        else resolve(res);
                    }
                );
                connection.release();
            });
        });
    }
};

module.exports = Mysql;