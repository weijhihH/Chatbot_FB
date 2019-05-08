const express = require('express');
const mysql = require('mysql');
const axios = require('axios');
const bodyParser = require('body-parser');
const cst = require('./util/constant.js');
const key = require('./util/key.js');

const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// MySql Connected
const db = mysql.createPool({
  connectionLimit: 100,
  host: key.MYSQL.host,
  user: key.MYSQL.user,
  password: key.MYSQL.password,
  database: key.MYSQL.database,
});

// 檢查 accessToken and expired, lognin api 沒檢查
app.use(`/api/${cst.API_VERSION}/:id`, (req, res, next) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  if (accessToken) {
    db.query(`select * from user where accessToken = '${accessToken}';`, (error, result) => {
      if (error) {
        console.log('check token ng1');
        res.send({ error: 'DB error' });
        throw error;
      } else if (result.length !== 0 && result[0].expiredTime - Date.now() > 0) {
        console.log('check token ok');
        next();
      } else {
        console.log('check token ng2');
        res.send({ error: 'AccessToken was not matched in DB' });
      }
    });
  } else {
    console.log('check token ng');
    res.send({ error: 'AccessToken was not found' });
  }
});

// 由 facebook api 找到個人擁有的 page list
function findPagesList(accessToken) {
  return new Promise((resolve, reject) => {
    axios.get('https://graph.facebook.com/me/accounts', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        if (res.data.data.length === 0) {
          return reject(new Error('can\'t get page list'));
        }
        return resolve(res);
      })
      .catch(error => reject(new Error(error)));
  });
}

// 處理 facebook weebhook 訂閱事件
function pageSubscribed(data) {
  return new Promise((resolve, reject) => {
    const arrayPromise = [];
    data.forEach((arr) => {
      // console.log('forEachLoop', arr);
      arrayPromise.push(axios({
        method: 'POST',
        url: `https://graph.facebook.com/${arr.id}/subscribed_apps`,
        headers: { Authorization: `Bearer ${arr.access_token}` },
        data: {
          subscribed_fields: 'messages, messaging_postbacks, message_reads, messaging_checkout_updates',
        },
      }).then(res => (res.data)).catch((error) => {
        // console.log('error messages form FacebookPageSubscribed: ', error.data);
        reject(error.response.data);
      }));
    });
    Promise.all(arrayPromise)
      .then((res) => {
        resolve(res);
      });
  });
}


app.get('/api/signin', (req, res) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
  const expiredTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 day
  axios.get(url)
    .then((response) => {
    // 由 fb api 取得個人資訊
      const data = {
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        accessToken,
        expiredTime,
      };
      return data;
    })
    .then((profile) => {
      // 將個人資訊存成入 DB , 並且回傳 cookie
      db.getConnection((err, connection) => {
        if (err) throw err;
        connection.query(`select * from user where id = '${profile.id}';`, (err, result) => {
          if (err) {
            connection.release();
            res.send({ error: 'Invalid Token' });
          } else if (result.length === 0) {
            // DB 找不到會員資料, 新增一筆
            connection.beginTransaction((error) => {
              if (error) {
                connection.release();
                res.send({ error: 'Database Query Error' });
              }
              connection.query('insert into user set?', profile, (error) => {
                connection.release();
                if (error) {
                  res.send({ error: 'Database Query Error' });
                  return connection.rollback();
                }
                return connection.commit((error) => {
                  if (error) {
                    return connection.rollback(() => {
                      res.send({ error: 'Database Query Error' });
                      throw error;
                    });
                  }
                  res.cookie('Authorization', profile.accessToken);
                  return res.send({ data: profile });
                });
              });
            }); // Mysql Transaction
          } else if (result.length !== 0) {
            // DB 有會員資料, 故更新資料庫
            connection.query(`update user set ? where id = '${profile.id}'`, profile, (error) => {
              connection.release();
              if (error) {
                res.send({ error: 'Database Query Error' });
                return connection.rollback();
              }
              return connection.commit((error) => {
                if (error) {
                  return connection.rollback(() => {
                    res.send({ error: 'Database Query Error' });
                    throw error;
                  });
                }
                res.cookie('Authorization', profile.accessToken);
                return res.send({ data: profile });
              });
            });
          }
        });
      });
    }).catch((error) => {
      res.send(error);
      // console.log('error:', error);
    });
});


// 將 pages 存入資料庫
function listAddedToken(pageLists, longLivedToken, accessToken) {
  return new Promise((resolve, reject) => {
    const arrayPromise = [];
    for (let i = 0; i < pageLists.length; i++) {
      arrayPromise.push(pageLists[i]);
      arrayPromise[i].longLivedToken = longLivedToken[i].access_token;
      db.getConnection((err, connection) => {
        if (err) {
          connection.release();
          reject(err);
        }
        const querySelect = `SELECT pages.* FROM user LEFT JOIN pages on user.id = pages.id where user.accessToken = '${accessToken}' and pages.pageId = '${pageLists[i].id}'`;
        connection.query(querySelect, (err, result) => {
          if (err) {
            connection.release();
            reject(err);
          }
          const dataInputDB = {
            // id: result[0].id,
            pageName: pageLists[i].name,
            pageId: pageLists[i].id,
            pageAccessToken: longLivedToken[i].access_token,
          };
          if (result.length > 0) {
            dataInputDB.id = result[0].id;
            // console.log('dataInputDB: ', dataInputDB);
            const queryUpdate = `update pages set ? where pages.pageId = '${pageLists[i].id}'`;
            connection.query(queryUpdate, dataInputDB, (err, result) => {
              if (err) {
                connection.release();
                reject(err);
              }
              resolve(result);
              // console.log('123123213', result);
            });
          } else {
            const querySelectFindId = `select * from user where user.accessToken = '${accessToken}'`;
            connection.query(querySelectFindId, (err, result) => {
              if (err) {
                connection.release();
                reject(err);
              } else if (result.length === 0) {
                connection.release();
                reject({ error: 'Invalid accessToken' });
              } else {
                dataInputDB.id = result[0].id;
                const queryInsert = 'insert into pages set ?;';
                connection.query(queryInsert, dataInputDB, (err, result) => {
                  connection.release();
                  if (err) {
                    // console.log(err);
                    reject(err);
                  }
                  resolve(result);
                });
              }
            });
          }
        });
      });
    }
  });
}

// get facebook Long-lived token
// GET / https://graph.facebook.com/oauth/access_token
// client_id, client_secret, grant_type= fb_exchange_token, fb_exchange_token
// Expires time from 2 hours extend to 2 mounths.
// FB PageAccessToken exchange to long-lived token from short-lived token
function getLongLivedToken(pageListsArray) {
  return new Promise((resolve, reject) => {
    const arrayPromise = [];
    pageListsArray.forEach((arr) => {
      arrayPromise.push(axios({
        method: 'GET',
        url: 'https://graph.facebook.com/oauth/access_token',
        params: {
          client_id: key.FB.APP_Client_ID,
          client_secret: key.FB.APP_SECRECT_KEY,
          grant_type: 'fb_exchange_token',
          fb_exchange_token: arr.access_token,
        },
      }).then((res) => {
        return (res.data);
      }).catch((error) => {
        reject(new Error(error));
      }));
    });
    Promise.all(arrayPromise)
      .then((res) => {
        resolve(res);
      })
      .catch(error => new Error(error));
  });
}


app.get(`/api/${cst.API_VERSION}/profile`, async (req, res) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  try {
    // 用 facebook accessToken 找到對應個人有幾個粉絲頁(fb page)
    const findPagesListResult = await findPagesList(accessToken);
    const pageLists = findPagesListResult.data.data;
    // 取得長期權杖
    const longLivedToken = await getLongLivedToken(pageLists);
    await listAddedToken(pageLists, longLivedToken, accessToken);

    // 將資料存入DB , id(user,foreign key),page_id,page_name,page_accessToken,expired_in
    //
    // longLivedToken
    await pageSubscribed(pageLists);
    res.send({ data: pageLists });
  } catch (error) {
    console.log(error);
    res.send({ error: '123' });
  }
});


// Global function
// 進去資料庫找資料 , greetingMessage
function checkGreetingMessage(pageId) {
  return new Promise((resolve, reject) => {
    const query = `select * from greetingMessage where pageId = ${pageId}`;
    db.query(query, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 機器人相關內容
app.get(`/api/${cst.API_VERSION}/webhook/greeting/:pageId`, async (req, res) => {
  console.log(req.query.pageId);
  const { pageId } = req.query;
  try {
    const checkGreetingMessageResult = await checkGreetingMessage(pageId);
    if (checkGreetingMessageResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      res.send({ data: checkGreetingMessageResult[0].text });
    }
  } catch (error) {
    res.send({ error: 'someting error happened' });
  }
});

// 設置 Greeting message , 第一次聊天看到的訊息
app.post(`/api/${cst.API_VERSION}/webhook/greeting`, async (req, res) => {
  const { pageId } = req.body.data;
  const greetingText = req.body.data.text;
  const requestBody = {
    get_started: {
      payload: "getStarted",
    },
    greeting: [
      {
        locale: "default",
        text: greetingText,
      },
    ],
  };
  try {
    // Find pageAccessToken
    const pageAccessToken = await dbFindPageAccessToken(pageId);
    console.log('pageAccessToken', pageAccessToken);
    // SET Greeting request to FB;
    const fetchSetGreetingResult = await fetchSetGreeting(pageAccessToken, requestBody);
    console.log('fetchSetGreetingResult', fetchSetGreetingResult);
    // 判別資料是否已經在資料庫存在
    const checkGreetingMessageResult = await checkGreetingMessage(pageId);
    console.log('checkGreetingMessageResult', checkGreetingMessageResult);
    // 將資料存入資料庫
    const dataIntoGreetingMessageDB = {
      pageId,
      text: greetingText,
    };
    const queryInputData = `insert into greetingMessage set ?`;
    const queryUpdatedData = `update greetingMessage set ? where pageId ='${pageId}'`;
    if (checkGreetingMessageResult.length === 0) {
      // 資料庫無資料, 存一筆新的
      await greetingMessageDbUsed(queryInputData, dataIntoGreetingMessageDB);
      // console.log(insertToDB);
      res.send({ data: 'Inserted to DB' });
    } else {
      // 資料庫有資料, 更新資料
      await greetingMessageDbUsed(queryUpdatedData, dataIntoGreetingMessageDB);
      // console.log(updateToDB);
      res.send({ data: 'Updated to DB' });
    }
  } catch (error) {
    // console.log(error);
    res.send({ error: "someting error happened" });
  }


  function greetingMessageDbUsed(query, data) {
    return new Promise((resolve, reject) => {
      db.query(query, data, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  function fetchSetGreeting(pageAccessToken, requestBody) {
    return new Promise((resolve, reject) => {
      axios({
        method: 'POST',
        url: 'https://graph.facebook.com/v3.2/me/messenger_profile',
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
          'Content-Type': 'application/json',
        },
        data: requestBody,
      }).then((res) => {
        resolve(res.data);
      }).catch((error) => {
        reject(error.data);
      });
    });
  }
});

// 進資料庫用 pageId 找 page's accessToken
function dbFindPageAccessToken(pageId) {
  return new Promise((resolve, reject) => {
    db.query(`select * from pages where pageId = '${pageId}'`, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result[0].pageAccessToken);
    });
  });
}

app.get(`/api/${cst.API_VERSION}/webhook/wellcomeMessage/:pageId`, async (req, res) => {
  const input = {
    pageId: req.query.pageId,
    payload: req.query.payload,
  };
  const selectInput = `select * from sendMessage where pageId = '${input.pageId}' and payload = '${input.payload}'`;

  const queryResultForPageId = await querySelectResultsFromSendMessage(selectInput);
  // console.log(queryResultForPageId)
  if (queryResultForPageId.length === 0) {
    res.send({ data: "NoData" });
  } else {
    res.send({ data: queryResultForPageId[0] });
  }
});

app.post(`/api/${cst.API_VERSION}/webhook/wellcomeMessage`, async (req, res) => {
  const response = req.body;
  const info = {
    attachment: {
      type: "template",
      payload: {
        template_type: response.data.message_type,
        text: response.data.text,
        buttons: response.data.buttons,
      },
    },
  };
  // console.log('1000', req.body);
  // console.log('1001', info.attachment.payload);
  // console.log('123123123123: ', info)
  const queryInput = {
    pageId: response.pageId,
    position: response.position,
    handleType: response.handleType,
    event: response.event,
    payload: response.payload,
    source: response.source,
    info: JSON.stringify(info),
  };
  try {
    const selectInput = `select * from sendMessage where pageId = '${queryInput.pageId}' and payload = '${queryInput.payload}'`;
    const queryResultForPageId = await querySelectResultsFromSendMessage(selectInput);
    console.log('queryResultForPageId123: ', queryResultForPageId.length);
    if (queryResultForPageId.length === 0) {
      // 資料庫中無資料, 需存入一筆新的
      db.getConnection((error, connection) => {
        if (error) {throw error;}
        const queryInputNew = `insert into sendMessage set ?`;
        connection.query(queryInputNew, queryInput, (error) => {
          connection.release();
          if (error) {throw error;}
          res.send({ data: 'data has been saved' });
        });
      });
    } else {
      console.log('data was found in db.');
      const { pageId } = queryResultForPageId[0];
      // 資料庫有現有資料, 故更新資料
      const queryInputUpdated = `update sendMessage set ? where pageId = '${pageId}' and payload = 'getStarted'`;
      db.getConnection((error, connection) => {
        if (error) {
          // console.log('error', error)
          throw error;
        }
        connection.query(queryInputUpdated, queryInput, (error, result) => {
          connection.release();
          if (error) {throw error;}
          // console.log('ok', result);
          res.send({ data: 'data has been updated' });
        });
      });
    }
  } catch (error) {
    console.log(error);
    res.send({ error });
  }
});

// 用 pageId 確認是否在資料庫中
function querySelectResultsFromSendMessage(selectQuery) {
  return new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error) {
        return reject(error);
      }
      connection.query(selectQuery, (error,result) => {
        connection.release();
        if (error) {
          return reject(error);
        }
        return resolve(result);
      });
    });
  });
}


app.get(`/api/${cst.API_VERSION}/webhook/moreSetting/:pageId`, async (req, res) => {
  try {
    const { pageId } = req.query;
    const selectQuery = `select * from sendMessage where pageId = '${pageId}' and source = 'moreSetting'`;
    const queryResult = await queryDataDromDB(selectQuery);
    console.log('queryResult', queryResult.length);
    if (queryResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      res.send({ data: queryResult });
    }
  } catch (error) {
    console.log('error', error);
    res.send({ error: 'someting error happened' });
  }
});

// 找資料
function queryDataDromDB(query) {
  return new Promise((resolve, reject) => {
    db.query(query, (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });
}

// 讀取 db 資料給前端 - people profile
app.get(`/api/${cst.API_VERSION}/webhook/people/:pageId`, (req, res) => {
  const { pageId } = req.query;
  const selectQuery = `select * from people where pageId = '${pageId}'`;
  console.log('pageId', pageId);
  db.query(selectQuery, (err, result) => {
    if (err) {
      res.send({ error: 'db had error' });
    }
    res.send({ data: result });
  });
});

app.get(`/api/${cst.API_VERSION}/broadcast/:pageId`, async (req, res) => {
  try {
    const { pageId } = req.query;
    const selectQueryInSendmessage = `select * from sendMessage where pageId = '${pageId}' and source = 'broadcast'`;
    const selectQuerybroadcastSet = `select * from broadcastSet where pageId = '${pageId}'`;
    const selectQuerybroadcastRepeat = `select rule.rule from broadcastRepeat left join rule on broadcastRepeat.ruleId = rule.ruleid where pageId ='${pageId}'`;

    const selectQueryInSendmessageResult = await queryDataDromDB(selectQueryInSendmessage);
    if (selectQueryInSendmessageResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      const selectQuerybroadcastSetResult = await queryDataDromDB(selectQuerybroadcastSet);
      if (selectQuerybroadcastSetResult[0].repeat === 0) {
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
        });
      } else {
        const selectQuerybroadcastRepeatResult = await queryDataDromDB(selectQuerybroadcastRepeat);
        const repeatDate = [];
        selectQuerybroadcastRepeatResult.forEach((e) => {
          repeatDate.push(e.rule);
        });
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
          repeatDate,
        });
      }
    }
  } catch (error) {
    console.log('error', error);
    res.send({ error: 'something error happened' });
  }
});


// 將 broadcast 設定資料存入資料庫中
app.post(`/api/${cst.API_VERSION}/broadcast`, async (req, res) => {
  const response = req.body;
  const source = 'broadcast';
  console.log('api/broadcast', response);
  try {
    // 整理要寫入 db 的資料 (整理寫進 sendMessage table)
    const inputContent = await insertContent(response.data);
    console.log('123123123123', inputContent);
    await messageDBUpdated(response.data[0].pageId, inputContent, source);
    await insertTobroadcastSet(response.data[0]);
    if (response.data[0].repeatDate.length !== 0) {
      await insertTobroadcastRepeat(response.data[0].pageId, response.data[0].repeatDate);
    } else {
      const delQuery = `delete from broadcastRepeat where pageId ='${response.data[0].pageId}'`;
      await queryDataDromDB(delQuery);
    }
    res.send({ data: 'data has been saved' });
  } catch (error) {
    console.log('error: ', error);
    res.send({ error: 'error in DB' });
  }
});

// 更多設定頁面 api
app.post(`/api/${cst.API_VERSION}/webhook/moreSetting`, async (req, res) => {
  const response = req.body;
  const source = 'moreSetting';
  // 先區分資料的來源

  try {
  // 整理要寫入 db 的資料
    const inputContent = await insertContent(response.data);
    // console.log('inputContent',inputContent)
    const moreSettingUpdatedResult = await messageDBUpdated(req.body.data[0].pageId, inputContent, source);
    console.log('result', moreSettingUpdatedResult);
    res.send({ data: 'data has been saved' });
  } catch (error) {
    // console.log('err',error)
  }
});

// 整理前端送進來的資料 - moreSetting
function insertContent(input) {
  const insertContent = [];
  return new Promise((resolve) => {
    input.forEach((e) => {
      const arr = [e.pageId, e.position, e.handleType, e.event, e.payload, e.source];
      if (e.event === 'message') {
        arr.push(JSON.stringify(e.message));
      } else if (e.event === 'attachment') {
        const info = JSON.stringify({
          attachment: {
            type: "template",
            payload: {
              template_type: e.message.template_type,
              text: e.message.text,
              buttons: e.message.buttons,
            },
          },
        });
        arr.push(info);
      }
      insertContent.push(arr);
      return resolve(insertContent);
    });
  });
}

// 將資料存入資料庫 or update 資料
function messageDBUpdated(pageId, insertContent, source) {
  return new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error) {
        return reject(error);
      }
      connection.beginTransaction((error) => {
        if (error) {
          connection.release();
          return reject(error);
        }
        const delQuery = `delete from sendMessage where pageId = '${pageId}' and source = '${source}'`;
        connection.query(delQuery, (error) => {
          if (error) {
            connection.release();
            return connection.rollback(() => {
              reject(error);
            });
          }
          // const insertQuery = `insert into sendMessage set ?`
          const insertQuery = "insert into sendMessage (`pageId`,`position`,`handleType`,`event`,`payload`,`source`,`info`) values ?";
          connection.query(insertQuery, [insertContent], (error, result) => {
            connection.release();
            if (error) {
              return connection.rollback(() => {
                reject(error);
              });
            }
            connection.commit((error) => {
              if (error) {
                return connection.rollback(() => {
                  reject(error);
                });
              }
              return resolve(result);
            });
          });
        });
      });
    });
  });
}


// 將 broadcast setting 存入 broadcastSet 內
function insertTobroadcastSet(input) {
  return new Promise((resolve, reject) => {
    // 判斷有無要 repeat
    // broadcast 有週期的話, repeat = true , 反之為 false
    let repeat;
    if (input.repeatDate.length === 0) {
      repeat = false;
    } else {
      repeat = true;
    }

    const inertQueryToBroadcastSet = `insert into broadcastSet set ?`;
    const updateQueryToBroadcastSet = `update broadcastSet set ? where pageId = '${input.pageId}'`;
    const contentForBroadcastSet = {
      pageId: input.pageId,
      startDate: input.date,
      startTime: input.time,
      timezone: input.timezone,
      repeat,
    };

    db.getConnection((err, connection) => {
      if (err) {
        return reject(err);
      }
      connection.beginTransaction((err) => {
        if (err) {
          return reject(err);
        }
        connection.query(`select * from broadcastSet where pageId = '${input.pageId}'`, (err, result) => {
          if (err) {
            connection.release();
            connection.rollback(() => reject(err));
          }
          if (result.length === 0) {
            // 資料庫無資料, 新增
            connection.query(inertQueryToBroadcastSet, contentForBroadcastSet, (err, result) => {
              connection.release();
              if (err) {
                connection.rollback(() => reject(err));
              }
              connection.commit((err) => {
                if (err) {
                  connection.rollback();
                  return reject(err);
                }
                return resolve(result);
              });
            });
          } else {
            // update 資料
            connection.query(updateQueryToBroadcastSet, contentForBroadcastSet, (err, result) => {
              connection.release();
              if (err) {
                connection.rollback(() => reject(err));
              }
              connection.commit((err) => {
                if (err) {
                  connection.rollback();
                  return reject(err);
                }
                return resolve(result);
              });
            });
          }
        });
      }); // transaction
    });
  });
}

// 將 broadcast repeat setting 存入 broadcastRepeat 內
function insertTobroadcastRepeat(pageId, input) {
  return new Promise((resolve, reject) => {
    const insertContent = [];
    input.forEach((e) => {
      switch (e) {
        case 'sunday':
          insertContent.push([pageId, 7]);
          break;
        case 'monday':
          insertContent.push([pageId, 1]);
          break;
        case 'tuesday':
          insertContent.push([pageId, 2]);
          break;
        case 'wednesday':
          insertContent.push([pageId, 3]);
          break;
        case 'thursday':
          insertContent.push([pageId, 4]);
          break;
        case 'friday':
          insertContent.push([pageId, 5]);
          break;
        case 'saturday':
          insertContent.push([pageId, 6]);
          break;
        default:
          break;
      }
    });
    console.log('insertContent', insertContent);
    db.getConnection((err, connection) => {
      if (err) {
        return reject(err);
      }
      connection.beginTransaction((err) => {
        if (err) {
          return reject(err);
        }
        const delQuery = `delete from broadcastRepeat where pageId = '${pageId}' and ruleId between 1 and 7`;
        const insertQuery = "insert into broadcastRepeat (`pageId`,`ruleId`) values ?";

        // 舊資料先清掉
        connection.query(delQuery, (err, result) => {
          if (err) {
            connection.release();
            return connection.rollback(() => {
              reject(err);
            });
          }
          connection.query(insertQuery, [insertContent], (err, result) => {
            connection.release();
            if (err) {
              return connection.rollback(() => {
                reject(err);
              });
            }
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  reject(err);
                });
              }
              return resolve(result);
            });
          });
        });
      }); // end of transaction
    }); // end of getConnection
  });
}


async function insetProfileToDb(psid, pageAccessToken, pageId, lastSeenTime) {
  try {
    // 1.找資料庫有無相符合的資料 PSID
    const queryResult = await selectPSIDFromDb(psid);
    if (queryResult.length > 0) {
      // 2-a. 有找到資料, 將 lastSeen 資料更新到資料庫中
      const updateToDbResult = await updatelastSeenToDb(lastSeenTime, psid);
      return updateToDbResult;
    }
    // 2-b. 無找到資料, 跟 fb 要個人資料, 並且存入到資料庫中
    const getProfile = await getProfileFromFb(psid, pageAccessToken);
    await insertNewProfileToDb(getProfile, pageId, lastSeenTime);
    // 第一次建立完資料, 順便把 pageId 綁定 label (綁定區域&性別&時區)
    const checkLabelsResult = await checkLabels(getProfile);
    console.log('checkLabelsResult', checkLabelsResult);
    if (checkLabelsResult.length !== 0) {
      const addUserToFacebookLabelsResult = await addUserToFacebookLabels(checkLabelsResult, pageAccessToken, psid);
      return addUserToFacebookLabelsResult;
    }
    return 'no Update Data';
  } catch (error) {
    return error;
  }
}

// 確認資料庫有無現成的資料 - labels
function checkLabels(getProfile) {
  return new Promise((resolve, reject) => {
    const { data } = getProfile;
    const query = `select * from labels where label_name = 'locale${data.locale}' or label_name = 'genderIs${data.gender}' or label_name = 'timezone${data.timezone}'`;
    db.query(query, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}
// 確認使用者時區是否已經在有對應的 label_id = timezoneXXX
// 沒有的話要新增 label, 並且將回應的 label_id 添加到現有 query reuslt
// function(){....}


// 確認使用者地區是否已經在有對應的 label_id = localeXXX
// 沒有的話要新增 label, 並且將回應的 label_id 添加到現有 query reuslt
// function(){....}

// 將使用者加入標籤
// Broadcast 群發給特定的群組用,綁標籤
function addUserToFacebookLabels(response, accessToken, psid) {
  return new Promise((resolve, reject) => {
    const promiseArr = [];
    response.forEach((arr) => {
      promiseArr.push(axios({
        method: 'POST',
        url: `https://graph.facebook.com/v2.11/${arr.label_id}/label?access_token=${accessToken}`,
        data: {
          user: psid,
        },
      })
        .then((res) => {
          console.log('res.data', res.data);
          return res.data;
        })
        .catch((err) => {
          console.log('err.data', err.response.data);
          return (err.response.data);
        }),);
    });
    Promise.all(promiseArr)
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

// 將資料存入資料庫
function insertNewProfileToDb(getProfile, pageId, lastSeenTime) {
  return new Promise((resolve, reject) => {
    const query = `insert into people set ?`;
    const { data } = getProfile;
    const content = {
      pageId,
      PSID: data.id,
      name: data.name,
      locale: data.locale,
      timezone: data.timezone,
      gender: data.gender,
      lastSeen: lastSeenTime,
      signedUp: lastSeenTime,
    };
    db.query(query, content, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 將資料update進資料庫
function updatelastSeenToDb(lastSeenTime, psid) {
  return new Promise((resolve, reject) => {
    const query = `update people set ? where PSID = '${psid}'`;
    const content = {
      lastSeen: lastSeenTime,
      times: 1,
    };
    db.query(query, content, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 確認資料庫有無 psid
function selectPSIDFromDb(psid) {
  return new Promise((resolve, reject) => {
    const query = `select * from people where PSID = '${psid}'`;
    db.query(query, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 跟 fb 要資料 (user profile)
function getProfileFromFb(psid, pageAccessToken) {
  return new Promise((resolve, reject) => {
    const fields = 'name,profile_pic,locale,timezone,gender';
    const url = `https://graph.facebook.com/${psid}?fields=${fields}&access_token=${pageAccessToken}`;
    axios({
      method: 'GET',
      url,
    }).then(res => resolve(res)).catch(err => reject(err));
  });
}

// Creates the endpoint for our webhook
app.post('/webhook', async (req, res) => {
  console.log('message', req.body.entry);

  // Parse the request body from the POST
  const { body } = req;
  const pageId = req.body.entry[0].id;
  const psid = req.body.entry[0].messaging[0].sender.id;
  const lastSeenTime = parseInt(req.body.entry[0].time);
  // use pageId to get facebook accesstoken
  try {
    const pageAccessToken = await dbFindPageAccessToken(pageId);
    // console.log('abcde:', body.object);

    const insetProfileToDbResult = await insetProfileToDb(psid, pageAccessToken, pageId, lastSeenTime);
    console.log('8888', insetProfileToDbResult);


    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {
      body.entry.forEach(async (entry) => {
      // console.log('123', entry.messaging[0]);
      
        // Gets the body of the webhook event
        let webhook_event = entry.messaging[0];
        console.log('webhook_event', webhook_event);
        // Get the sender PSID
        let sender_psid = webhook_event.sender.id;
        // console.log('Sender PSID: ' + sender_psid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        let response;
        if (webhook_event.message) {
          response = await handleMessage(pageId, webhook_event.message);
          // callSendAPI(sender_psid, response, pageAccessToken)
          callSendAPI(sender_psid, response, pageAccessToken);
        } else if (webhook_event.postback) {
        // response 包裝成 array , 要考慮可能一次回超過一句
          response = await handlePostback(pageId, webhook_event.postback);
          callSendAPI(sender_psid, response, pageAccessToken);
        }
      });

      // Return a '200 OK' response to all events
      res.status(200).send('EVENT_RECEIVED');
    } else {
    // Return a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  } catch (err) {
    console.log('12345', err);
  }
});


// backup
// Handles messages events
function handleMessage(pageId, received_message) {
  return new Promise((resolve, reject) => {
    const payload = received_message.text;
    console.log('payload', payload);
    // Check if the message contains text
    if (received_message.text) {
      const query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}'`;
      db.query(query, (error, result) => {
        if (error) {
          return reject(error);
        }
        if (result.length !== 0) {
          const response = result.map(e => JSON.parse(e.info));
          // console.log('response', response)
          return resolve(response);
        }
        console.log('loop 1');
        // 看到不懂的文字,強制回去 getStart
        const queryGetStarted = `select * from sendMessage where pageId = '${pageId}' and payload = 'getStarted'`;
        db.query(queryGetStarted, (error, result) => {
          if (error) {
            console.log('error', error);
            return reject(error);
          }
          const response = result.map(e => JSON.parse(e.info));
          console.log('response', response);
          return resolve(response);
        });
        // return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
      });
    }
  });
}


function handlePostback(pageId, received_postback) {
  return new Promise((resolve, reject) => {
    // Get the payload for the postback
    const { payload } = received_postback;
    // console.log('payload',payload)
    // 從資料找到對應到 payload 的資料
    const query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}'`;
    // Set the response based on the postback payload
    db.query(query, (error, result) => {
      if (error) {
        return reject(error);
      }
      if (result.length !== 0) {
        const response = result.map(e => JSON.parse(e.info));
        // console.log('response', response)
        return resolve(response);
      }

      // 看到不懂的文字,強制回去 getStart
      const queryGetStarted = `select * from sendMessage where pageId = '${pageId}' and payload = 'getStarted'`;
      db.query(queryGetStarted, (error, result) => {
        if (error) {
          return reject(error);
        }
        const response = result.map(e => JSON.parse(e.info));
        return resolve(response);
      });
      // return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
    });
  });
}


// Sends response messages via the Send API
function callSendAPI(sender_psid, response, accessToken) {
  response.forEach((arr) => {
    // Construct the message body
    const request_body = {
      recipient: {
        id: sender_psid,
      },
      message: arr,
    };
    console.log('999', request_body);
    // 回傳訊息給 page
    axios({
      method: 'post',
      url: 'https://graph.facebook.com/v3.2/me/messages',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: request_body,
    }).then(() => console.log('res: ', 'ok'))
      .catch(err => console.log('err: ', err));
  });
}


// 機器人相關內容

// 建立連結 get_started ( post to facebook messenger platform)
// payload = 'getStarted'
function fbMessengerPlatformGetStarted(accessToken) {
  return new Promise((resolve, reject) => {
    axios('https://graph.facebook.com/v3.2/me/messenger_profile', {
      method: 'post',
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        get_started: {
          payload: 'getStarted',
        },
      },
    })
      .then((res) => {
        // console.log('res:,' , res.data)
        resolve(res.data);
      })
      .catch((error) => {
        // console.log('error', error.data)
        reject(error.data);
      });
  });
}


app.listen('3001', () => {
  console.log('Server connected on port 3001');
});
