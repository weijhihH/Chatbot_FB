/* eslint-disable arrow-parens */
/* eslint-disable semi */
/* eslint-disable no-undef */
// 引入 mysql setting
const mysqlcon = require('./util/mysqlCon');

const pool = mysqlcon.con;

// function insert(query) {
//   return pool.getConnection()
//     .then(con => {
//       return con.query('START TRANSACTION')
//         .then(() => {
//           return con.query(query)
//         })
//         .then(() => con.query('COMMIT'))
//         .catch(err => {
//           con.query('ROLLBACK')
//           return err;
//         });
//     })
// }

const query = `insert into labels (label_id, label_name) values (103, 'Men3')`

async function insertAsync(query) {
  const con = await pool.getConnection();
  try {
    await con.query('START TRANSACTION');
    await con.query(query);
    await con.query('COMMIT');
    await con.release();
  } catch (err) {
    await con.query('ROLLBACK');
    await con.release();
    return err;
  }
}

console.log(insertAsync(query));
