// 引入 mysql setting
const mysqlcon = require('../util/mysqlCon');

const pool = mysqlcon.con;

module.exports = {
  // 驗證 accessToken
  async accessTokenChecked(accessToken) {
    const con = await pool.getConnection();
    try {
      const result = await con.query(`select * from user where accessToken = '${accessToken}';`);
      con.release();
      return result[0];
    } catch (err) {
      con.release();
      throw new Error(err);
    }
  },
  async signIn(profile) {
    const con = await pool.getConnection();
    try {
      await con.query('START TRANSACTION');
      const findUserList = await con.query(`select * from user where id = '${profile.id}';`);
      if (findUserList[0].length === 0) {
        await con.query('insert into user set?', profile);
      } else if (findUserList[0].length !== 0) {
        await con.query(`update user set ? where id = '${profile.id}'`, profile);
      }
      await con.query('COMMIT');
      await con.release();
      return true;
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },
  // 將 pageInformation 存入 talbe
  async pageDataToDB(accessToken, pageId, dataInputDB) {
    const con = await pool.getConnection();
    const data = JSON.parse(JSON.stringify(dataInputDB));
    try {
      await con.query('START TRANSACTION');
      // 確認是否已經有存在於 table
      const selectResult = await con.query(`SELECT pages.* FROM user LEFT JOIN pages on user.id = pages.id 
        where user.accessToken = '${accessToken}' and pages.pageId = '${pageId}'`);
      if (selectResult[0].length > 0) {
        data.id = selectResult[0][0].id;
        // 更新 page資訊, longliveToken資訊更新
        await con.query(`update pages set ? where pages.pageId = '${pageId}'`, data);
      } else {
        // 查詢使用者是否存在於 table
        const selectFromUserDB = await con.query(`select * from user where user.accessToken = '${accessToken}'`);
        if (selectFromUserDB[0].length === 0) {
          return new Error({ error: 'Invalid accessToken' });
        }
        data.id = selectFromUserDB[0][0].id;
        // 將使用者 page infromation 存入 db
        await con.query('insert into pages set ?;', data);
      }
      await con.query('COMMIT');
      await con.release();
      return true;
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },
  // select query
  async singleSelect(table, condition) {
    const con = await pool.getConnection();
    try {
      let result;
      let content;
      if (condition) {
        console.log(1111);
        content = [table, condition];
        result = await con.query('select * from ?? where ?', content);
      } else {
        result = await con.query('select * from ??', table);
        console.log(22222);
      }
      await con.release();
      return result[0];
    } catch (err) {
      await con.release();
      throw new Error(err);
    }
  },
  async insert(table, insertcontent) {
    const con = await pool.getConnection();
    try {
      const content = [table, insertcontent];
      const result = await con.query('insert into ?? set ?', content);
      await con.query('START TRANSACTION');
      await con.query('COMMIT');
      await con.release();
      console.log(111, result[0]);
      return result[0];
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },
  async update(table, insertcontent, condition) {
    const con = await pool.getConnection();
    try {
      let content;
      let result;
      await con.query('START TRANSACTION');
      if (table && insertcontent && condition) {
        content = [table, insertcontent, condition];
        result = await con.query('update ?? set ? where ?', content);
      } else if (table && insertcontent && !condition) {
        content = [table, insertcontent];
        result = await con.query('update ?? set ? where ?', content);
      }
      await con.query('COMMIT');
      await con.release();
      return result[0];
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },

};
