// Mysql Initialization
const mysql = require('mysql2/promise');
const mysql1 = require('mysql');
var env = process.env.NODE_ENV || 'production';
let con
let con1;
if(env==="development"){
  // MySql pool setting
  con = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: 'a#4%6&8',
    database: 'chatBotTest',
    // debug: true,
  });
  con1 = mysql1.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: '!@#Ab1233',
    database: 'chatBotTest',
    // debug: true,
  });
} else {
    // MySql pool setting
  con = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: '!@#Ab1233',
    database: 'chatbot',
    // debug: true,
  });
  con1 = mysql1.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: '!@#Ab1233',
    database: 'chatbot',
    // debug: true,
  });
}

module.exports = {
  con,
  con1,
};
