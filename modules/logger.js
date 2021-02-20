import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

const myFormat = printf(info => {
    return `${info.timestamp}: ${info.message}`;
});

const Logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'application.log' })
    ]
});

module.exports = Logger;