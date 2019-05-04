/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-plusplus */
/* eslint-disable no-shadow */
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

// // 檢查各個 api 的 accessToken
// app.use(`/api/${cst.API_VERSION}/:id`,(req, res, next) => {
//   let accessToken = req.get('Authorization');
//   if (accessToken) {
//     accessToken = accessToken.replace('Bearer ', '');
//     db.query(`select * from user where accessToken = '${accessToken}';`, (error, result) => {
//       if (error) {
//         res.send({ error: 'DB error' });
//         throw error;
//       } else if (result.length !== 0 && result[0].expiredTime - Date.now() > 0) {
//         next();
//       } else {
//         res.send({ error: 'AccessToken was not matched in DB' });
//       }
//     });
//   } else {
//     res.send({ error: 'AccessToken was not found' });
//   }
// });

// 由 facebook api 找到個人擁有的 page list
function findPagesList(accessToken) {
  return new Promise((resolve, reject) => {
    axios.get('https://graph.facebook.com/me/accounts', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        console.log('777',res.data.data.length)
        if(res.data.data.length === 0){
          return reject({error: `can't get page list`})
        }
        console.log('666', res.data);
        resolve(res);
      })
      .catch((error) => {
        console.log('777', error.message);
        reject(error.message);
      });
  });
}

// 處理 facebook weebhook 訂閱事件
function pageSubscribed(data) {
  return new Promise((resolve, reject) => {
    // console.log(data)
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
      }).then((res) => {
        console.log('res',res)
        // if(res.data === 'successed') {
        //   db.getConnection((err, connection) => {
        //     if (err) throw err;
        //     connection.query(`select id from user where id = '${arr.access_token}'`,(err, result) => {
        //       console.log('123',result[0].id)
        //       if(err){
        //         connection.release();
        //         throw err;
        //       }
        //       connection.query(`update pages set subscribed = subscribed where subscribed = '${result[0].id}'`,(err, result) => {
        //         connection.release();
        //         if (err) throw err;
        //         console.log('response messages form FacebookPageSubscribed: ', res.data);
        //         return (res.data);
        //       })
        //       // result[0].id
        //     })
        //   })
        // }
        return (res.data);
      }).catch((error) => {
        console.log('error messages form FacebookPageSubscribed: ', error.data);
        reject(error.response.data);
      }));
    });
    Promise.all(arrayPromise)
      .then((res) => {
        resolve(res);
      });
  });
}


// 將會員資訊存入DB
app.get(`/api/${cst.API_VERSION}/signin`, (req, res) => {
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
                // console.log('111')
                connection.release();
                res.send({ error: 'Database Query Error' });
              }
              connection.query('insert into user set?', profile, (error) => {
                connection.release();
                if (error) {
                  // console.log('222')
                  res.send({ error: 'Database Query Error' });
                  return connection.rollback();
                }
                // console.log('333')
                connection.commit((error) => {
                  // console.log('444')
                  if (error) {
                    return connection.rollback(() => {
                      // console.log('555')
                      res.send({ error: 'Database Query Error' });
                      throw error;
                    });
                  }
                  // console.log('666')
                  res.cookie('Authorization', profile.accessToken);
                  res.send({ data: profile });
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
              connection.commit((error) => {
                if (error) {
                  return connection.rollback(() => {
                    res.send({ error: 'Database Query Error' });
                    throw error;
                  });
                }
                res.cookie('Authorization', profile.accessToken);

                res.send({ data: profile });
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

app.get(`/api/${cst.API_VERSION}/profile`, async (req, res) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  // console.log('123', accessToken);
  try {
    // 用 facebook accessToken 找到對應個人有幾個粉絲頁(fb page)
    const findPagesListResult = await findPagesList(accessToken);
    const pageLists = findPagesListResult.data.data;
    // console.log('12312312  ', pageLists)
    // 取得長期權杖 
    const longLivedToken = await getLongLivedToken(pageLists);
    await listAddedToken(pageLists, longLivedToken, accessToken);

    // console.log('12839213921: ', pageListsbindLongLivedToken);
    // 將資料存入DB , id(user,foreign key),page_id,page_name,page_accessToken,expired_in
    //
    // longLivedToken
    // console.log('123',longLivedToken)
    const result = await pageSubscribed(pageLists);
    console.log('777: ',result);
    res.send({ data: pageLists });
  } catch (error) {
    console.log(error);
    res.send({ error: error.error });
  }
});




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
        console.log('res data for getLongLivedToken', res.data);
        return (res.data);
      }).catch((error) => {
        console.log('error for getLongLivedToken', error);
        reject(error);
      }));
    });
    Promise.all(arrayPromise)
    .then((res) => {
      resolve(res);
    });
  });
}



// // Adds support for GET requests to our webhook
// app.get('/webhook', (req, res) => {

//   // Your verify token. Should be a random string.
//   let VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
//   console.log('000000000');
    
//   // Parse the query params
//   let mode = req.query['hub.mode'];
//   let token = req.query['hub.verify_token'];
//   let challenge = req.query['hub.challenge'];
    
//   // Checks if a token and mode is in the query string of the request
//   if (mode && token) {
  
//     // Checks the mode and token sent is correct
//     if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
//       // Responds with the challenge token from the request
//       console.log('WEBHOOK_VERIFIED');
//       res.status(200).send(challenge);
    
//     } else {
//       // Responds with '403 Forbidden' if verify tokens do not match
//       res.sendStatus(403);      
//     }
//   }
// });

// 機器人相關內容

app.get(`/api/${cst.API_VERSION}/webhook/greeting/:pageId`, async (req, res) => {
  console.log(req.query.pageId)
  const pageId = req.query.pageId
  try {
    const checkGreetingMessageResult = await checkGreetingMessage(pageId);
    if (checkGreetingMessageResult.length === 0 ){
      res.send({data: 'NoData'});
    } else {
      res.send({data: checkGreetingMessageResult[0].text});
    }
  } 
  catch (error) {
    res.send({error: 'someting error happened'});
  }

})

//設置 Greeting message , 第一次聊天看到的訊息
app.post(`/api/${cst.API_VERSION}/webhook/greeting`, async (req, res) => {
  const pageId = req.body.data.pageId;
  const greetingText = req.body.data.text;
  const requestBody = {
    "get_started": {
      "payload":"getStarted"
    },
    "greeting":[
      {
        "locale": "default",
        "text": greetingText
      }
    ]
  };
  try {
    // Find pageAccessToken
    const pageAccessToken = await dbFindPageAccessToken(pageId);
    // SET Greeting request to FB; 
    await fetchSetGreeting(pageAccessToken, requestBody);
    // 判別資料是否已經在資料庫存在
    const checkGreetingMessageResult = await checkGreetingMessage(pageId);
    // 將資料存入資料庫
    const dataIntoGreetingMessageDB = {
      pageId,
      text: greetingText
    }
    const queryInputData = `insert into greetingMessage set ?`;
    const queryUpdatedData = `update greetingMessage set ? where pageId ='${pageId}'`;
    if (checkGreetingMessageResult.length === 0 ){
      // 資料庫無資料, 存一筆新的
      await greetingMessageDbUsed(queryInputData, dataIntoGreetingMessageDB);
      // console.log(insertToDB);
      res.send({data: 'Inserted to DB'})
    } else {
      // 資料庫有資料, 更新資料
      await greetingMessageDbUsed(queryUpdatedData, dataIntoGreetingMessageDB);
      // console.log(updateToDB); 
      res.send({data: 'Updated to DB'})
    }
  } 
  catch (error) {
    // console.log(error);
    res.send({error: "someting error happened"});
  }


  function greetingMessageDbUsed (query, data){
    return new Promise ((resolve,reject) => {
      db.query(query, data, (err, result) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(result);
        }
      })
    })
  }

  function fetchSetGreeting (pageAccessToken, requestBody){
    return new Promise((resolve,reject) => {
      axios({
        method: 'POST',
        url:'https://graph.facebook.com/v3.2/me/messenger_profile',
        headers: {
          'Authorization' : `Bearer ${pageAccessToken}`,
          'Content-Type': 'application/json'
        },
        data: requestBody
      }).then((res) => {
        resolve(res.data);
      }).catch((error) => {
        reject(error.data);
      });
    })
  }
})

// Global function
  // 進去資料庫找資料 , greetingMessage
  function checkGreetingMessage (pageId){
    return new Promise((resolve, reject) => {
      const query = `select * from greetingMessage where pageId = ${pageId}`
      db.query(query, (err, result) => {
        if (err){
          return reject(err)
        } else {
          return resolve(result);
        }
      })
    })
  }

  // 進資料庫用 pageId 找 page's accessToken
  function dbFindPageAccessToken(pageId){
    return new Promise ((resolve, reject) => {
      db.query(`select * from pages where pageId = '${pageId}'`, (err, result) => {
        if (err) {
          reject(err)
        }
        resolve(result[0].pageAccessToken)
      })
    })
  }

app.get(`/api/${cst.API_VERSION}/webhook/wellcomeMessage/:pageId`, async (req, res) => {
  const input = {
    pageId:req.query.pageId,
    payload:req.query.payload
  }
  const selectInput = `select * from sendMessage where pageId = '${input.pageId}' and payload = '${input.payload}'`

  let queryResultForPageId = await querySelectResultsFromSendMessage(selectInput)
  // console.log(queryResultForPageId)
  if(queryResultForPageId.length === 0){
    res.send({data: "NoData"})
  } else{
    res.send({data:queryResultForPageId[0]})
  }
})

app.post(`/api/${cst.API_VERSION}/webhook/wellcomeMessage`, async (req, res) => {
  const response = req.body
  const info = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type": response.data.message_type,
          "text": response.data.text,
          "buttons": response.data.buttons
        }
      }
  }
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
    info: JSON.stringify(info)
  }
  try {
    const selectInput = `select * from sendMessage where pageId = '${queryInput.pageId}' and payload = '${queryInput.payload}'`
    let queryResultForPageId = await querySelectResultsFromSendMessage(selectInput)
    console.log('queryResultForPageId123: ', queryResultForPageId.length)
    if ( queryResultForPageId.length === 0 ){
      // 資料庫中無資料, 需存入一筆新的
      db.getConnection((error, connection) => {
        if (error)
        throw error;
        let queryInputNew = `insert into sendMessage set ?`
        connection.query(queryInputNew, queryInput, (error) => {
          connection.release();
          if (error)
          throw error;
          res.send ({data: 'data has been saved'})
        })
      })
    } else {
      console.log('data was found in db.');
      let pageId = queryResultForPageId[0].pageId
      // 資料庫有現有資料, 故更新資料
      let queryInputUpdated = `update sendMessage set ? where pageId = '${pageId}' and payload = 'getStarted'`
      db.getConnection((error, connection) => {
        if (error) {
          // console.log('error', error)
          throw error;
        }
        connection.query(queryInputUpdated, queryInput, (error, result) => {
          connection.release();
          if (error)
          throw error;
          // console.log('ok', result);
          res.send({data: 'data has been updated'});
        })
      })
    }
  } catch (error){
    console.log(error);
    res.send({error : error});
  }
})

// 用 pageId 確認是否在資料庫中
function querySelectResultsFromSendMessage (selectQuery){
  return new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error){
        return reject (error);
      }
      connection.query(selectQuery, (error ,result) => {
        connection.release();
        if(error) {
          return reject(error)
        } else {
          // console.log('test1',result)
          return resolve(result);
        }
      });
    })
  })
}  


app.get(`/api/${cst.API_VERSION}/webhook/moreSetting/:pageId`, async(req, res) => {
  try {
    const pageId = req.query.pageId
    const selectQuery = `select * from sendMessage where pageId = '${pageId}' and source = 'moreSetting'`
    const queryResult = await queryDataDromDB(selectQuery);
    console.log('queryResult', queryResult.length)
    if(queryResult.length === 0){
      res.send({data: 'NoData'})
    } else {
      res.send({data: queryResult})
    }
  } catch(error){
    console.log('error', error)
    res.send({'error': 'someting error happened'})
  }
})

// 找資料
function queryDataDromDB (query){
  return new Promise((resolve,reject) => {
    db.query(query, (error, result) => {
      if (error){
        return reject (error)
      }
      return resolve(result)
    })
  })
}

// 讀取 db 資料給前端 - people profile
app.get(`/api/${cst.API_VERSION}/webhook/people/:pageId`, (req, res) => {
  const pageId = req.query.pageId
  const selectQuery = `select * from people where pageId = '${pageId}'`
  console.log('pageId',pageId)
  db.query(selectQuery, (err, result) => {
    if(err){
      res.send({error: 'db had error'})
    }
    res.send({data: result})
  })
})

app.get(`/api/${cst.API_VERSION}/broadcast/:pageId`, async(req, res) => {
  try{
  const pageId = req.query.pageId
  const selectQueryInSendmessage = `select * from sendMessage where pageId = '${pageId}' and source = 'broadcast'`
  const selectQuerybroadcastSet = `select * from broadcastSet where pageId = '${pageId}'`
  const selectQuerybroadcastRepeat = `select rule.rule from broadcastRepeat left join rule on broadcastRepeat.ruleId = rule.ruleid where pageId ='${pageId}'`

  const selectQueryInSendmessageResult = await queryDataDromDB(selectQueryInSendmessage);
    if(selectQueryInSendmessageResult.length === 0){
      res.send({data: 'NoData'})
    } else {
      const selectQuerybroadcastSetResult = await queryDataDromDB(selectQuerybroadcastSet);
      if(selectQuerybroadcastSetResult[0].repeat === 0){
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
        })
      } else {
        const selectQuerybroadcastRepeatResult = await queryDataDromDB(selectQuerybroadcastRepeat)
        const repeatDate = [];
        selectQuerybroadcastRepeatResult.forEach(e => {
          repeatDate.push(e.rule)
        });
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
          repeatDate: repeatDate
        })
      }
    }
  } catch (error){
    console.log('error',error)
    res.send({error:'something error happened'})
  }
})


// 將 broadcast 設定資料存入資料庫中
app.post(`/api/${cst.API_VERSION}/broadcast`, async (req, res) => {
  const response = req.body;
  const source = 'broadcast';
  console.log('api/broadcast', response);
  try{
    // 整理要寫入 db 的資料 (整理寫進 sendMessage table)
    let inputContent = await insertContent(response.data);
    console.log('123123123123', inputContent)
    await messageDBUpdated(response.data[0].pageId, inputContent, source)
    await insertTobroadcastSet(response.data[0])
    if(response.data[0].repeatDate.length !== 0){
      await insertTobroadcastRepeat(response.data[0].pageId,response.data[0].repeatDate)
    } else {
      const delQuery = `delete from broadcastRepeat where pageId ='${response.data[0].pageId}'`
      await queryDataDromDB(delQuery)
    }
    res.send({data: 'data has been saved'})
  } catch(error){
    console.log('error: ', error)
    res.send({error: 'error in DB'})
  }
})

// 更多設定頁面 api
app.post(`/api/${cst.API_VERSION}/webhook/moreSetting`, async (req, res) => {
  const response = req.body;
  const source = 'moreSetting';
  // 先區分資料的來源

  try{
  // 整理要寫入 db 的資料
  let inputContent = await insertContent(response.data);
  // console.log('inputContent',inputContent)
  let moreSettingUpdatedResult = await messageDBUpdated(req.body.data[0].pageId, inputContent, source)
  console.log('result',moreSettingUpdatedResult);
  res.send({data: 'data has been saved'})
  } catch(error){
    // console.log('err',error)
  }
})

// 整理前端送進來的資料 - moreSetting
function insertContent(input){
  const insertContent = [];
  return new Promise((resolve) => {
    input.forEach(e => {
      const arr= [e.pageId,e.position,e.handleType,e.event,e.payload,e.source];
      if(e.event === 'message'){
        arr.push(JSON.stringify(e.message));
      } else if (e.event === 'attachment'){
        const info = JSON.stringify({
          "attachment":{
            "type":"template",
            "payload":{
              "template_type": e.message.template_type,
              "text": e.message.text,
              "buttons": e.message.buttons
              }
          }
        })
        arr.push(info);
      }
      insertContent.push(arr);
      return resolve(insertContent);
    })
  })
}

// 將資料存入資料庫 or update 資料
function messageDBUpdated(pageId,insertContent,source){
  return new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error){
        return reject(error)
      }
      connection.beginTransaction((error) => {
        if (error){
          connection.release();
          return reject(error)
        }
        const delQuery = `delete from sendMessage where pageId = '${pageId}' and source = '${source}'`
        connection.query(delQuery,(error) => {
          if(error){
            connection.release();
            return connection.rollback(() => {
              reject(error)
            })
          }
          // const insertQuery = `insert into sendMessage set ?`
          const insertQuery = "insert into sendMessage (`pageId`,`position`,`handleType`,`event`,`payload`,`source`,`info`) values ?"
          connection.query(insertQuery, [insertContent], (error, result) => {
            connection.release();
            if(error){
              return connection.rollback(() => {
                reject(error)
              })
            }
            connection.commit((error) => {
              if(error) {
                return connection.rollback(() => {
                  reject(error)
                })
              }
              return resolve(result);
            }) 
          })
        })
      })
    })
  })
}


// 將 broadcast setting 存入 broadcastSet 內
function insertTobroadcastSet(input) {
  return new Promise((resolve, reject) => {
    // 判斷有無要 repeat 
    // broadcast 有週期的話, repeat = true , 反之為 false
    let repeat;
    if(input.repeatDate.length === 0){
      repeat = false;
    } else {
      repeat = true; 
    }

    const inertQueryToBroadcastSet = `insert into broadcastSet set ?`
    const updateQueryToBroadcastSet = `update broadcastSet set ? where pageId = '${input.pageId}'`
    const contentForBroadcastSet = {
      pageId: input.pageId,
      startDate: input.date,
      startTime: input.time,
      timezone: input.timezone,
      repeat: repeat
    }

    db.getConnection((err,connection) => {
      if(err){
        return reject(err)
      }
      connection.beginTransaction((err) => {
        if(err){
          return reject(err)
        }
        connection.query(`select * from broadcastSet where pageId = '${input.pageId}'`, (err, result) => {
          if(err){
            connection.release();
            connection.rollback(() => {
              return reject(err);
            })
          }
          if(result.length === 0){
            // 資料庫無資料, 新增
            connection.query(inertQueryToBroadcastSet, contentForBroadcastSet, (err, result) => {
              connection.release();
              if(err){
                connection.rollback(() => {
                  return reject(err);
                })
              }
              connection.commit((err) => {
                if(err){
                  connection.rollback();
                  return reject(err);
                }
                return resolve(result)
              })
            })
          } else {
            // update 資料
            connection.query(updateQueryToBroadcastSet, contentForBroadcastSet, (err, result) => {
              connection.release();
              if(err){
                connection.rollback(() => {
                  return reject(err);
                })
              }
              connection.commit((err) => {
                if(err){
                  connection.rollback();
                  return reject(err);
                }
                return resolve(result);
              })
            })
          }
        })
      }) // transaction
    })
  }) 
}

// 將 broadcast repeat setting 存入 broadcastRepeat 內
function insertTobroadcastRepeat(pageId,input){
  return new Promise((resolve, reject) => {
    const insertContent = [];
    input.forEach(e => {
      switch (e) {
        case 'sunday':
          insertContent.push([pageId,7])
          break;
        case 'monday':
          insertContent.push([pageId,1])
          break;
        case 'tuesday':
          insertContent.push([pageId,2])
          break;
        case 'wednesday':
          insertContent.push([pageId,3])
          break;
        case 'thursday':
          insertContent.push([pageId,4])
          break;
        case 'friday':
          insertContent.push([pageId,5])
          break;
        case 'saturday':
          insertContent.push([pageId,6])
          break;        
      }
    });
    console.log('insertContent',insertContent)
    db.getConnection((err,connection) => {
      if (err){
        return reject(err)
      }
      connection.beginTransaction((err) => {
        if(err){
          return reject(err)
        }
        const delQuery = `delete from broadcastRepeat where pageId = '${pageId}' and ruleId between 1 and 7`
        const insertQuery = "insert into broadcastRepeat (`pageId`,`ruleId`) values ?"

        // 舊資料先清掉
        connection.query(delQuery,(err, result) => {
          if(err){
            connection.release();
            return connection.rollback(() => {
              reject(err)
            })
          }
          connection.query(insertQuery, [insertContent], (err, result) => {
            connection.release();
            if(err){
              return connection.rollback(() => {
                reject(err)
              })
            }
            connection.commit((err) => {
              if(err) {
                return connection.rollback(() => {
                  reject(err)
                })
              }
              return resolve(result);
            }) 
          })
        })
      }) // end of transaction
    }) // end of getConnection
  })
}



async function insetProfileToDb(psid,pageAccessToken,pageId,lastSeenTime) {
  try{
    // 1.找資料庫有無相符合的資料 PSID
    const queryResult = await selectPSIDFromDb(psid)
    if(queryResult.length > 0 ){
      // 2-a. 有找到資料, 將 lastSeen 資料更新到資料庫中
      const updateToDbResult = await updatelastSeenToDb(lastSeenTime, psid)
      return updateToDbResult
    } else {
      // 2-b. 無找到資料, 跟 fb 要個人資料, 並且存入到資料庫中
      const getProfile = await getProfileFromFb(psid,pageAccessToken)
      const inserNewProfileDataToDb = await insertNewProfileToDb(getProfile, pageId,lastSeenTime)
      return inserNewProfileDataToDb
    }
  } catch(error){
    return error
  }
}

// 將資料存入資料庫
function insertNewProfileToDb(getProfile, pageId, lastSeenTime){
  return new Promise((resolve, reject) => {
    const query = `insert into people set ?`;
    const data = getProfile.data
    const content = {
      pageId: pageId,
      PSID: data.id,
      name: data.name,
      locale: data.locale,
      timezone: data.timezone,
      gender: data.gender,
      lastSeen: lastSeenTime,
      signedUp: lastSeenTime
    }
    db.query(query, content, (err, result) => {
      if (err){
      return reject (err)}
      return resolve(result);
    })
  })
}

// 將資料update進資料庫
function updatelastSeenToDb(lastSeenTime, psid){
  return new Promise((resolve, reject) => {
    const query = `update people set ? where PSID = '${psid}'`
    const content = {
      lastSeen : lastSeenTime,
      times: 1
    }
    db.query(query, content, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}

// 確認資料庫有無 psid
function selectPSIDFromDb(psid){
  return new Promise((resolve, reject) => {
    const query = `select * from people where PSID = '${psid}'`
    db.query(query, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    })
  })
}

// 跟 fb 要資料 (user profile)
function getProfileFromFb(psid,pageAccessToken){
  return new Promise((resolve, reject) => {
    const fields = 'name,profile_pic,locale,timezone,gender'
    const url = `https://graph.facebook.com/${psid}?fields=${fields}&access_token=${pageAccessToken}`
    axios({
      method: 'GET',
      url: url
    }).then((res) => {
      return resolve(res)
    }).catch((err) => {
      return reject(err)
    })
  })
}

// Creates the endpoint for our webhook 
app.post('/webhook', async (req, res) => {
  console.log('message',req.body.entry);

  // Parse the request body from the POST
  let body = req.body;
  let pageId = req.body.entry[0].id
  let psid = req.body.entry[0].messaging[0].sender.id
  let lastSeenTime = parseInt(req.body.entry[0].time)
  // use pageId to get facebook accesstoken
  try {
  const pageAccessToken = await dbFindPageAccessToken(pageId)
  // console.log('abcde:', body.object);

  const insetProfileToDbResult = await insetProfileToDb(psid,pageAccessToken,pageId,lastSeenTime);
  console.log('8888', insetProfileToDbResult)
  

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(async function(entry) {
      // console.log('123', entry.messaging[0]);

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log('webhook_event', webhook_event)
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      // console.log('Sender PSID: ' + sender_psid);
      
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      let response;
      if (webhook_event.message) {
        response = await handleMessage(pageId, webhook_event.message);       
        // callSendAPI(sender_psid, response, pageAccessToken)
        callSendAPI(sender_psid, response, pageAccessToken)
      } else if (webhook_event.postback) {
        // response 包裝成 array , 要考慮可能一次回超過一句 
        response = await handlePostback(pageId, webhook_event.postback);
        callSendAPI(sender_psid, response, pageAccessToken)
      }
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

  } catch(err){
    console.log('12345', err);
  }

});

// // backup
// // Handles messages events
// function handleMessage(sender_psid, received_message, accessToken) {
//   let response;

//   // Check if the message contains text
//   if (received_message.text) {    

//     // // Create the payload for a basic text message

//     response = {"text": "What are you up to?"}
  
//   } else if (received_message.attachments) {
//     // Get the URL of the message attachment
//     response = [{"text": "抱歉~看不懂這是什麼???"}]
//   // Sends the response message
//   callSendAPI(sender_psid, response, accessToken);  
// }

// backup
// Handles messages events
function handleMessage(pageId, received_message) {
  return new Promise((resolve, reject) => {
  let payload = received_message.text;
  console.log('payload',payload)
  // Check if the message contains text
    if (received_message.text){
      let query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}' and handleType = 'message'`
      db.query(query, (error, result) => {
        if(error) {
          return reject (error);
        }
        if(result.length !==0){
          const response = result.map( e => JSON.parse(e.info))
          // console.log('response', response)
          return resolve(response)
        } else {
          return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
        }
      })
    }
  })
}


// Handles messaging_postbacks events
// function handlePostback(sender_psid, received_postback, accessToken) {
//   let response;
//   // Get the payload for the postback
//   let payload = received_postback.payload;

//   // Set the response based on the postback payload
//   if (payload === 'yes') {
//     response = { "text": "Thanks!" }
//   } else if (payload === 'no') {
//     response = { "text": "Oops, try sending another image." }
//   }
//   // Send the message to acknowledge the postback
//   callSendAPI(sender_psid, response, accessToken);
// }



function handlePostback(pageId, received_postback) {
  return new Promise((resolve, reject) => {
    // Get the payload for the postback
    let payload = received_postback.payload;
    // console.log('payload',payload)
    // 從資料找到對應到 payload 的資料
    let query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}' and handleType = 'postback'`
    // Set the response based on the postback payload
    db.query(query, (error, result) => {
      if (error) {
        return reject (error);
      }
      if (result.length !== 0){
        const response = result.map( e => JSON.parse(e.info))
        // console.log('response', response)
        return resolve(response)
      } else {
        return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
      }
    })
  })
}


// 測試範例,可以刪除
// let query = `select * from sendMessage where pageId = '413245412820200' and handleType = 'message'`
// db.query(query, (error, result) => {
//   if (error) {
//     return reject (error);
//   }
//   if (result.length !== 0){
//     const map1 = result.map(e => JSON.parse(e.info))
//     console.log('99999',map1)
//   } else {
//     return console.log('999')
//   }
// })

// Sends response messages via the Send API
function callSendAPI(sender_psid, response, accessToken) {
  response.forEach(arr => {
    // Construct the message body
    let request_body = {
      "recipient": {
        "id": sender_psid
      },
      "message": arr
    };
    console.log('999',request_body)
    // 回傳訊息給 page
    axios({
      method: 'post',
      url: 'https://graph.facebook.com/v3.2/me/messages',
      headers: {
        'Authorization' : `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data : request_body
    }).then(() => console.log('res: ', 'ok'))
    .catch(err => console.log('err: ', err))
  })
}

// // backup 
// // Sends response messages via the Send API
// function callSendAPI(sender_psid, response, accessToken) {
//   // Construct the message body
//   let request_body = {
//     "recipient": {
//       "id": sender_psid
//     },
//     "message": response
//   };
//   console.log('999',request_body)
//   // 回傳訊息給 page
//   axios({
//     method: 'post',
//     url: 'https://graph.facebook.com/v3.2/me/messages',
//     headers: {
//       'Authorization' : `Bearer ${accessToken}`,
//       'Content-Type': 'application/json'
//     },
//     data : request_body
//   }).then(() => console.log('res: ', 'ok'))
//   .catch(err => console.log('err: ', err))
// }


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
          payload:'getStarted'
        }
      }
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

// // 存東西測試用
// const testContent = {
//   pageId:413245412820200,
//   position:0,
//   payload:'getStarted',
//   info: JSON.stringify({
//     "attachment":{
//       "type":"template",
//       "payload":{
//         "template_type": "button",
//         "text": '測試一下',
//         "buttons": [
//           {
//             "type":"postback",
//             "title":"666",
//             "payload":"777",
//           },
//           {
//             "type":"postback",
//             "title":"888",
//             "payload":"999",
//           }
//         ]
//       }
//     }
//   })
// }
// db.query(`update sendMessage set ? where pageId = '${testContent.pageId}'`,testContent,(err, result) => {
//   if(err)
//   throw err;
//   console.log(result)
// })


app.listen('3001', () => {
  console.log('Server connected on port 3001');
});

// Mysql

