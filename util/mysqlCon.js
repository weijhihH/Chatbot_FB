// Mysql Initialization
const mysql = require('mysql2/promise');
const mysql1 = require('mysql');
const key = require('./key.js')
var env = process.env.NODE_ENV || 'production';
let con
let con1;
if(env==="development"){
  // MySql pool setting
  con = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: key.MYSQL.APP_SECRECT_KEY,
    database: 'chatBotTest',
    // debug: true,
  });
  con1 = mysql1.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: key.MYSQL.APP_SECRECT_KEY,
    database: 'chatBotTest',
    // debug: true,
  });
} else {
    // MySql pool setting
  con = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: key.MYSQL.APP_SECRECT_KEY,
    database: 'chatbot',
    // debug: true,
  });
  con1 = mysql1.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: key.MYSQL.APP_SECRECT_KEY,
    database: 'chatbot',
    // debug: true,
  });
}

module.exports = {
  con,
  con1,
};
