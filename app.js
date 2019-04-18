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
        // console.log('666', res.data);
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

// 找 pages 內所有資訊
function selectPagesInfromation() {
  db.query('select * from pages', (error, result) => {
    if (error) throw error;
    return (result);
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
                console.log('111')
                connection.release();
                res.send({ error: 'Database Query Error' });
              }
              connection.query('insert into user set?', profile, (error) => {
                connection.release();
                if (error) {
                  console.log('222')
                  res.send({ error: 'Database Query Error' });
                  return connection.rollback();
                }
                console.log('333')
                connection.commit((error) => {
                  console.log('444')
                  if (error) {
                    return connection.rollback(() => {
                      console.log('555')
                      res.send({ error: 'Database Query Error' });
                      throw error;
                    });
                  }
                  console.log('666')
                  res.cookie('Authorization', profile.accessToken);
                  res.send({ data: profile });
                });
              });
            }); // Mysql Transaction
          } else if (result.length !== 0) {
            // DB 有會員資料, 故更新資料庫
            connection.query('update user set ?', profile, (error) => {
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
      console.log('error:', error);
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
                    console.log(err);
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
        // console.log('res data for getLongLivedToken', res.data);
        return (res.data);
      }).catch((error) => {
        // console.log('error for getLongLivedToken', error);
        reject(error);
      }));
    });
    Promise.all(arrayPromise)
    .then((res) => {
      resolve(res);
    });
  });
}

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
  const VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
    
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});


// 測試用
app.get('/test', (req, res) => {
  console.log('req: ', req.body);
  res.send({ data: 'test api' });
});

// 機器人相關內容

//設置 Greeting message , 第一次聊天看到的訊息
app.post(`/api/${cst.API_VERSION}/webhook/greeting`, async (req, res) => {
  const requestBody = {
    "get_started": {
      "payload":"getStarted"
    },
    "greeting":[
      {
        "locale": "default",
        "text": req.body.data.text
      }
    ]
  };
  try {
    const pageAccessToken = await dbFindPageAccessToken(req)
    const result = await fetchSetGreeting(pageAccessToken, requestBody)
    res.send({result});
  } 
  catch (error) {
    res.send({error: "someting error happening"});
  }

  // 進資料庫用 pageId 找 page's accessToken
  function dbFindPageAccessToken(req){
    return new Promise ((resolve, reject) => {
      db.query(`select * from pages where pageId = '${req.body.data.pageId}'`, (err, result) => {
        if (err) {
          reject(err)
        }
        resolve(result[0].pageAccessToken)
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

app.get(`/api/${cst.API_VERSION}/webhook/greeting`, (req, res) =>{
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');

})

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
  // const VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
      
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        console.log('1231111', webhook_event.message)
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;

  // Check if the message contains text
  if (received_message.text) {    

    // // Create the payload for a basic text message
    // response = {
    //   "text": `You sent the message: "${received_message.text}". Now send me an image!`
    // }

    // response = {
    //   // "message":{
    //     "attachment":{
    //       "type":"template",
    //       "payload":{
    //         "template_type":"button",
    //         "text":"What do you want to do next?",
    //         "buttons":[
    //           {
    //             "type":"postback",
    //             "title":"test 123",
    //             "payload":"Visit Messenger"
    //           }
    //         ]
    //       }
    //     }
    //   // }
    // }

    response = {"text": "What are you up to?"}
      
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  } 
  // Sends the response message
  callSendAPI(sender_psid, response);  
}


// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  };
  // 回傳訊息給 page
  axios({
    method: 'post',
    url: 'https://graph.facebook.com/v3.2/me/messages',
    headers: {
      'Authorization' : `Bearer ${PAGE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data : request_body
  }).then(res => console.log('res: ', 'ok'))
  .catch(err => console.log('err: ', err))
}

// 機器人相關內容

// 建立連結 get_started ( post to facebook messenger platform)
function fbMessengerPlatformGetStarted(accessToken) {
  return new Promise((resolve, reject) => {
    // let accessToken = 'EAALux5Ptc6QBADQfic0MZCiRI3OiwZAHQF0nzHeZC3d8KUaV39UeocoIxt9K54wATrD03zqG2yNMLiimk3BeE5t3RtnZCp9J06LBFSL48KlPPzX5eHTRAqReP373x8GHPPpz6UR3ZApb2R5zfEHzYI5WSOvQ551SaFdJlBmjpCx3IqDQhoWbU'
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

// 建立 get_started wellcome message 



app.listen('3001', () => {
  console.log('Server connected on port 3001');
});

// Mysql

