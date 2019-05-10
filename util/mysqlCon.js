// Mysql Initialization
const mysql = require('mysql2/promise');
const mysql1 = require('mysql');
// MySql pool setting
const con = mysql.createPool({
  connectionLimit: 100,
  host: 'localhost',
  user: 'root',
  password: '!@#Ab1233',
  database: 'chatbot',
  // debug: true,
});
const con1 = mysql1.createPool({
  connectionLimit: 100,
  host: 'localhost',
  user: 'root',
  password: '!@#Ab1233',
  database: 'chatbot',
  // debug: true,
});

module.exports = {
  con,
  con1,
};
