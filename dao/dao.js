// 引入 mysql setting
const mysqlcon = require('../util/mysqlCon');

const pool = mysqlcon.con;

module.exports = {
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
  // 將 pageInformation 存入 table
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
  // 查詢 broadcastRepeat & rule tables
  async SelectRuleLeftJoinbroadcastRepeatTable(pageId) {
    const con = await pool.getConnection();
    try {
      const query = `select rule.rule from broadcastRepeat left join rule 
      on broadcastRepeat.ruleId = rule.ruleid where pageId ='${pageId}'`;
      const result = await con.query(query);
      await con.release();
      return result[0];
    } catch (err) {
      await con.release();
      throw new Error(err);
    }
  },
  // select query - No Transaction
  async singleSelect(table, conditionOne, operator, conditionTwo) {
    const con = await pool.getConnection();
    try {
      let result;
      let content;
      if (conditionOne && !operator && !conditionTwo) {
        content = [table, conditionOne];
        result = await con.query('select * from ?? where ?', content);
      } else if (conditionOne && conditionTwo) {
        content = [table, conditionOne, conditionTwo];
        result = await con.query(`select * from ?? where ? ${operator} ?`, content);
      } else {
        result = await con.query('select * from ??', table);
      }
      await con.release();
      return result[0];
    } catch (err) {
      await con.release();
      throw new Error(err);
    }
  },
  // insert query
  async insert(table, insertcontent) {
    const con = await pool.getConnection();
    try {
      const content = [table, insertcontent];
      const result = await con.query('insert into ?? set ?', content);
      await con.query('START TRANSACTION');
      await con.query('COMMIT');
      await con.release();
      return result[0];
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },
  // update query
  async update(table, insertcontent, condition, operator, conditionTwo) {
    const con = await pool.getConnection();
    try {
      let content;
      let result;
      await con.query('START TRANSACTION');
      if (table && insertcontent && condition && !operator && !conditionTwo) {
        content = [table, insertcontent, condition];
        result = await con.query('update ?? set ? where ?', content);
      } else if (table && insertcontent && !condition && !operator && !conditionTwo) {
        content = [table, insertcontent];
        result = await con.query('update ?? set ? where ?', content);
      } else if (table && insertcontent && condition && operator && conditionTwo) {
        content = [table, insertcontent, condition, conditionTwo];
        result = await con.query(`update ?? set ? where ? ${operator} ?`, content);
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
  // del query
  async del(table, conditionOne, operator, conditionTwo) {
    const con = await pool.getConnection();
    try {
      let content;
      let result;
      await con.query('START TRANSACTION');
      if (table && conditionOne && operator && conditionTwo) {
        content = [table, conditionOne, conditionTwo];
        result = await con.query(`delete from ?? where ? ${operator} ?`, content);
      } else if (table && !conditionOne && !operator && !conditionTwo) {
        content = [table];
        result = await con.query(`delete from ??`, content);
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
  // broadcast 資料更新
  async broadcastDataUpdated(pageId, SendMessagecontent, source, broadcastSetContent, broadcastRepeatContent) {
    const con = await pool.getConnection();
    try {
      console.log(broadcastSetContent.repeat);
      await con.query('START TRANSACTION');
      await con.query(`delete from sendMessage where pageId ='${pageId}' and source = '${source}'`);
      await con.query('insert into sendMessage (`pageId`,`position`,`handleType`,`event`,`payload`,`source`,`info`) values ?', [SendMessagecontent]);
      const broadcastSetSelectedresult = await con.query(`select * from broadcastSet where pageId = '${pageId}'`);
      if (broadcastSetSelectedresult.length === 0) {
        await con.query('insert into broadcastSet set ?', broadcastSetContent);
      } else {
        await con.query(`update broadcastSet set ? where pageId = '${pageId}'`, broadcastSetContent);
      }
      if (broadcastSetContent.repeat) {
        await con.query(`delete from broadcastRepeat where pageId = '${pageId}' and ruleId between 1 and 7`);
        await con.query('insert into broadcastRepeat (`pageId`,`ruleId`) values ?', [broadcastRepeatContent]);
      } else {
        await con.query(`delete from broadcastRepeat where pageId ='${pageId}'`);
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
  // moreSeetingDataUpdated 資料更新
  async moreSeetingDataUpdated(pageId, SendMessagecontent, source) {
    const con = await pool.getConnection();
    try {
      await con.query('START TRANSACTION');
      await con.query(`delete from sendMessage where pageId ='${pageId}' and source = '${source}'`);
      await con.query('insert into sendMessage (`pageId`,`position`,`handleType`,`event`,`payload`,`source`,`info`) values ?', [SendMessagecontent]);
      await con.query('COMMIT');
      await con.release();
      return true;
    } catch (err) {
      await con.query('ROLLBACK');
      await con.release();
      throw new Error(err);
    }
  },
};
